const express = require('express');
const path = require('path');
const { readSession } = require('../authSession');

const router = express.Router();
const privateAssetsPath = path.join(__dirname, '..', 'assets', 'private-tools');

function getOwnerId() {
  return process.env.OWNER_ID || process.env.BOT_OWNER_ID || process.env.DASHBOARD_OWNER_ID || '861228909851705366';
}

function requireOwnerPage(req, res, next) {
  const session = readSession(req);
  if (!session?.user) return res.redirect('/auth/discord');

  const ownerId = getOwnerId();
  if (!ownerId || session.user.id !== ownerId) {
    return res.status(403).send('This Meowz tool is private.');
  }

  req.sessionData = session;
  return next();
}

router.get('/tools', requireOwnerPage, (req, res) => res.redirect('/tools/food-mixer'));

router.get('/tools/food-mixer', requireOwnerPage, (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  return res.sendFile(path.join(privateAssetsPath, 'food-mixer.html'));
});

module.exports = { router };
