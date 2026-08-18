const express = require('express');
const fs = require('fs');
const path = require('path');
const { readSession } = require('../authSession');

const router = express.Router();
const importerPath = path.join(__dirname, '..', 'assets', 'private-tools', 'puzzle-importer.html');

function getOwnerId() {
  return process.env.OWNER_ID || process.env.BOT_OWNER_ID || process.env.DASHBOARD_OWNER_ID || '861228909851705366';
}

function requireOwner(req, res, next) {
  const session = readSession(req);
  if (!session?.user) return res.redirect('/auth/discord');
  if (String(session.user.id) !== String(getOwnerId())) return res.status(403).send('Private tool.');
  return next();
}

router.get('/tools/puzzle', requireOwner, async (req, res, next) => {
  try {
    const html = await fs.promises.readFile(importerPath, 'utf8');
    const enhanced = html.replace('</body>', '  <script src="/js/puzzle-library.js"></script>\n</body>');
    res.set('Cache-Control', 'no-store');
    return res.type('html').send(enhanced);
  } catch (err) {
    return next(err);
  }
});

module.exports = { router };
