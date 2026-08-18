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
  const imageDataUrl = String(req.body?.imageDataUrl || '');
  if (!isSupportedImageDataUrl(imageDataUrl)) {
    return res.status(400).json({ ok: false, error: 'Upload a PNG, JPG or WebP screenshot under the supported size limit.' });
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
    'Read this fill-in word puzzle photo and transcribe its STRUCTURE ONLY.',
    'Do not solve the puzzle, infer placements, or provide hidden answers.',
    'IMPORTANT: this is photographed from a printed book page, so ink from the reverse side often shows through as pale ghost squares, pale mirrored text, or partial shapes. Those are NOT part of the active puzzle.',
    'Identify the active/front-side puzzle by ink strength and consistency: genuine grid boxes have clearly darker, sharper borders with consistent stroke weight. Reverse-side bleed-through is lighter, lower-contrast, often incomplete, offset, mirrored, or visibly underneath the front-side content.',
    'When uncertain whether a square is real or bleed-through, EXCLUDE it. Prefer missing one doubtful ghost square over adding a faint square that is not part of the front-side grid.',
    'Only include boxes whose borders visually match the dark primary grid. Ignore any pale box pattern visible behind or between those dark boxes.',
    'Use the dark printed word bank and dark title as additional evidence for which side of the page is the active side; ignore pale reversed or translucent words from the back of the sheet.',
    'Return the smallest rectangular row/column grid that contains every genuine front-side writable square.',
    'For cells, list every genuine front-side writable square exactly once using 1-based row and column coordinates.',
    'visibleLetter must contain a single letter only when that letter is clearly printed inside a genuine front-side square; otherwise use an empty string.',
    'Transcribe every available word from the dark printed word bank exactly as shown, including spaces or hyphens when visible.',
    'Ignore page numbers, word-length headings, shadows, paper texture, faint show-through from the other side of the paper, and decorative marks.',
    'Before returning, visually re-check every reported cell and remove any cell that is noticeably lighter or less sharply outlined than the main grid boxes.',
    'Use the actual puzzle title for title when it is clearly visible; otherwise use Imported puzzle.',
    'The output schema intentionally has no answer-placement field. Do not encode or reveal a solution anywhere.',
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
            { type: 'input_image', image_url: imageDataUrl, detail: 'high' },
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
    return res.json({ ok: true, puzzle, model });
  } catch (err) {
    return res.status(502).json({ ok: false, error: err.message || 'Could not import the puzzle.' });
  }
});

module.exports = { router };
