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

function sanitizeDetectedGrid(value) {
  const rows = Number(value?.rows);
  const cols = Number(value?.cols);
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || rows > 80 || cols > 80) {
    throw new Error('The browser did not return a valid detected grid.');
  }
  const seen = new Set();
  const cells = [];
  for (const raw of Array.isArray(value?.cells) ? value.cells : []) {
    const row = Number(raw?.row);
    const col = Number(raw?.col);
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 1 || col < 1 || row > rows || col > cols) continue;
    const key = `${row}:${col}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cells.push({ row, col });
  }
  cells.sort((a, b) => (a.row - b.row) || (a.col - b.col));
  if (cells.length < 4 || cells.length > 600) throw new Error('The browser could not detect a usable set of dark grid boxes.');
  return { rows, cols, cells };
}

function gridAscii(grid) {
  const active = new Set(grid.cells.map((cell) => `${cell.row}:${cell.col}`));
  return Array.from({ length: grid.rows }, (_, r) =>
    Array.from({ length: grid.cols }, (_, c) => active.has(`${r + 1}:${c + 1}`) ? '#' : '.').join('')
  ).join('\n');
}

function sanitizeMetadata(value, grid) {
  const active = new Set(grid.cells.map((cell) => `${cell.row}:${cell.col}`));
  const letterMap = new Map();
  for (const raw of Array.isArray(value?.visibleLetters) ? value.visibleLetters : []) {
    const row = Number(raw?.row);
    const col = Number(raw?.col);
    const key = `${row}:${col}`;
    if (!active.has(key)) continue;
    const letter = String(raw?.letter || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1);
    if (letter) letterMap.set(key, letter);
  }
  const words = (Array.isArray(value?.words) ? value.words : [])
    .map((word) => String(word || '').trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 250);
  if (!words.length) throw new Error('OpenAI could not read the available word list.');
  return {
    title: String(value?.title || 'Imported puzzle').trim().slice(0, 120) || 'Imported puzzle',
    rows: grid.rows,
    cols: grid.cols,
    cells: grid.cells.map((cell) => ({ ...cell, visibleLetter: letterMap.get(`${cell.row}:${cell.col}`) || '' })),
    words,
  };
}

router.get('/tools/puzzle', requireOwner, (req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.sendFile(path.join(privateAssetsPath, 'puzzle-importer.html'));
});

router.post('/api/private-tools/puzzle/import', requireOwner, async (req, res) => {
  const originalImageDataUrl = String(req.body?.originalImageDataUrl || '');
  const overlayImageDataUrl = String(req.body?.overlayImageDataUrl || '');
  if (!isSupportedImageDataUrl(originalImageDataUrl) || !isSupportedImageDataUrl(overlayImageDataUrl)) {
    return res.status(400).json({ ok: false, error: 'Upload a supported puzzle screenshot under the size limit.' });
  }

  let detectedGrid;
  try {
    detectedGrid = sanitizeDetectedGrid(req.body?.detectedGrid);
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }

  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return res.status(503).json({ ok: false, error: 'OPENAI_API_KEY is not configured on the website service.' });
  const model = String(process.env.OPENAI_PUZZLE_MODEL || 'gpt-5.6').trim();

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'words', 'visibleLetters'],
    properties: {
      title: { type: 'string' },
      words: { type: 'array', items: { type: 'string' } },
      visibleLetters: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['row', 'col', 'letter'],
          properties: {
            row: { type: 'integer' },
            col: { type: 'integer' },
            letter: { type: 'string' },
          },
        },
      },
    },
  };

  const map = gridAscii(detectedGrid);
  const instruction = [
    'This is a fill-in word puzzle. The browser has already detected the physical dark grid boxes algorithmically.',
    'You MUST NOT add, remove, move, infer, or reconstruct any grid squares. Grid geometry is authoritative and is not your task.',
    `The detected grid has ${detectedGrid.rows} rows and ${detectedGrid.cols} columns. In the map below, # is a real writable square and . is empty space:`,
    map,
    'The first image is the original page and should be used to read the puzzle title and the dark printed word bank.',
    'The second image is the same page with the algorithmically detected boxes outlined in red. Use it only to locate letters that are visibly prefilled inside those detected boxes.',
    'Return every dark printed available word exactly as shown, preserving spaces and hyphens. Ignore word-length headings, page numbers, faint reverse-side text and bleed-through.',
    'For visibleLetters, return only letters that are clearly printed in detected # squares. Use the 1-based row and column coordinates from the supplied grid map. Do not guess letters.',
    'Do not solve the puzzle and do not return answer placements.',
  ].join('\n');

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        store: false,
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: instruction },
            { type: 'input_image', image_url: originalImageDataUrl, detail: 'high' },
            { type: 'input_image', image_url: overlayImageDataUrl, detail: 'high' },
          ],
        }],
        text: { format: { type: 'json_schema', name: 'puzzle_metadata', strict: true, schema } },
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return res.status(502).json({ ok: false, error: payload?.error?.message || `OpenAI request failed (${response.status}).` });
    const outputText = extractResponseText(payload);
    if (!outputText) return res.status(502).json({ ok: false, error: 'OpenAI returned no puzzle metadata.' });
    let parsed;
    try { parsed = JSON.parse(outputText); }
    catch { return res.status(502).json({ ok: false, error: 'OpenAI returned unreadable puzzle metadata.' }); }
    const puzzle = sanitizeMetadata(parsed, detectedGrid);
    return res.json({ ok: true, puzzle, model, detector: 'browser-rectangles-v1' });
  } catch (err) {
    return res.status(502).json({ ok: false, error: err.message || 'Could not import the puzzle.' });
  }
});

module.exports = { router };
