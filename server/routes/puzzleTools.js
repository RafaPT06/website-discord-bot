const express = require('express');
const path = require('path');
const { readSession } = require('../authSession');

const router = express.Router();
const privateAssetsPath = path.join(__dirname, '..', 'assets', 'private-tools');
const MAX_IMAGE_DATA_URL_LENGTH = 9_500_000;

function getOwnerId() {
  return process.env.OWNER_ID || process.env.BOT_OWNER_ID || process.env.DASHBOARD_OWNER_ID || '861228909851705366';
}

function requireOwner(req, res, next) {
  const session = readSession(req);
  const wantsHtml = req.method === 'GET' && req.path.startsWith('/tools/');

  if (!session?.user) {
    if (wantsHtml) return res.redirect('/auth/discord');
    return res.status(401).json({ ok: false, error: 'Login required.' });
  }

  if (String(session.user.id) !== String(getOwnerId())) {
    if (wantsHtml) return res.status(403).send('Private tool.');
    return res.status(403).json({ ok: false, error: 'Private tool.' });
  }

  req.sessionData = session;
  return next();
}

function isSupportedImageDataUrl(value) {
  const text = String(value || '');
  return text.length <= MAX_IMAGE_DATA_URL_LENGTH
    && /^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(text);
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim();
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === 'string' && content.text.trim()) return content.text.trim();
    }
  }
  return '';
}

function sanitizePuzzle(value) {
  const rawRows = Number(value?.rows);
  const rawCols = Number(value?.cols);
  if (!Number.isInteger(rawRows) || !Number.isInteger(rawCols)) {
    throw new Error('OpenAI did not return a valid puzzle size.');
  }

  const rows = Math.max(1, Math.min(80, rawRows));
  const cols = Math.max(1, Math.min(80, rawCols));
  const seen = new Set();
  const cells = [];

  for (const raw of Array.isArray(value?.cells) ? value.cells : []) {
    const row = Number(raw?.row);
    const col = Number(raw?.col);
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 1 || col < 1 || row > rows || col > cols) continue;
    const key = `${row}:${col}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const visibleLetter = String(raw?.visibleLetter || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1);
    cells.push({ row, col, visibleLetter });
  }

  cells.sort((a, b) => (a.row - b.row) || (a.col - b.col));

  const words = (Array.isArray(value?.words) ? value.words : [])
    .map((word) => String(word || '').trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 250);

  if (cells.length < 2) throw new Error('OpenAI could not detect enough grid cells.');
  if (!words.length) throw new Error('OpenAI could not detect the available word list.');

  return {
    title: String(value?.title || 'Imported puzzle').trim().slice(0, 120) || 'Imported puzzle',
    rows,
    cols,
    cells,
    words,
  };
}

router.get('/tools/puzzle', requireOwner, (req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.sendFile(path.join(privateAssetsPath, 'puzzle-importer.html'));
});

router.post('/api/private-tools/puzzle/import', requireOwner, async (req, res) => {
  const originalImageDataUrl = String(req.body?.originalImageDataUrl || req.body?.imageDataUrl || '');
  const structureImageDataUrl = String(req.body?.structureImageDataUrl || '');

  if (!isSupportedImageDataUrl(originalImageDataUrl)) {
    return res.status(400).json({ ok: false, error: 'Upload a PNG, JPG or WebP screenshot under the supported size limit.' });
  }
  if (!isSupportedImageDataUrl(structureImageDataUrl)) {
    return res.status(400).json({ ok: false, error: 'Could not prepare the high-contrast grid image. Try uploading the screenshot again.' });
  }

  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(503).json({ ok: false, error: 'OPENAI_API_KEY is not configured on the website service.' });
  }

  const model = String(process.env.OPENAI_PUZZLE_MODEL || 'gpt-5.6').trim();
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'rows', 'cols', 'cells', 'words'],
    properties: {
      title: { type: 'string' },
      rows: { type: 'integer' },
      cols: { type: 'integer' },
      cells: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['row', 'col', 'visibleLetter'],
          properties: {
            row: { type: 'integer' },
            col: { type: 'integer' },
            visibleLetter: { type: 'string' },
          },
        },
      },
      words: { type: 'array', items: { type: 'string' } },
    },
  };

  const instruction = [
    'You are given TWO images of the SAME fill-in word puzzle page.',
    'IMAGE 1 is the original photo. Use IMAGE 1 only for the puzzle title, the printed word bank, and letters that are visibly prefilled inside genuine grid squares.',
    'IMAGE 2 is a deliberately high-contrast structural copy of the same photo. Use IMAGE 2 as the PRIMARY source for deciding which grid squares actually exist.',
    'Do not solve the puzzle, infer word placements, or provide hidden answers.',
    'Printed book pages may show pale reverse-side bleed-through. The structural image is designed to suppress that bleed-through.',
    'Only report writable cells supported by the dark, coherent primary grid in IMAGE 2. Ignore isolated pale/gray/partial box remnants, mirrored shapes, text, shadows, and paper texture.',
    'When IMAGE 1 appears to contain a faint box but IMAGE 2 does not clearly preserve it as part of the dark grid, EXCLUDE that box.',
    'When uncertain whether a square is genuine, EXCLUDE it rather than guessing.',
    'Return the smallest rectangular row/column layout containing all genuine writable squares, with 1-based coordinates.',
    'visibleLetter must be a single A-Z letter only when that letter is clearly printed in the corresponding genuine square in IMAGE 1; otherwise use an empty string.',
    'Transcribe the dark printed available-word list from IMAGE 1 exactly as shown, preserving visible spaces or hyphens.',
    'Ignore page numbers and word-length headings. Use the actual puzzle title if clearly visible; otherwise use Imported puzzle.',
    'Before returning, re-check that every reported cell is visibly supported by IMAGE 2 and remove doubtful cells.',
    'The schema contains no solution field. Do not encode a solution anywhere.',
  ].join(' ');

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        store: false,
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: instruction },
            { type: 'input_text', text: 'IMAGE 1 — original photo for title, word bank, and visible prefilled letters:' },
            { type: 'input_image', image_url: originalImageDataUrl, detail: 'high' },
            { type: 'input_text', text: 'IMAGE 2 — high-contrast structural copy for deciding which grid squares exist:' },
            { type: 'input_image', image_url: structureImageDataUrl, detail: 'high' },
          ],
        }],
        text: {
          format: {
            type: 'json_schema',
            name: 'puzzle_structure',
            strict: true,
            schema,
          },
        },
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.error?.message || `OpenAI request failed (${response.status}).`;
      return res.status(502).json({ ok: false, error: message });
    }

    const outputText = extractResponseText(payload);
    if (!outputText) return res.status(502).json({ ok: false, error: 'OpenAI returned no puzzle structure.' });

    let parsed;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      return res.status(502).json({ ok: false, error: 'OpenAI returned an unreadable puzzle structure.' });
    }

    const puzzle = sanitizePuzzle(parsed);
    return res.json({ ok: true, puzzle, model, preprocessing: 'dual-image-contrast-v1' });
  } catch (err) {
    return res.status(502).json({ ok: false, error: err.message || 'Could not import the puzzle.' });
  }
});

module.exports = { router };
