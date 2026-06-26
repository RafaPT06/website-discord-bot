const express = require('express');

const router = express.Router();

router.get('/discord', (req, res) => {
  res.status(501).json({
    ok: false,
    error: 'Discord OAuth is not implemented yet.',
  });
});

router.get('/callback', (req, res) => {
  res.status(501).json({
    ok: false,
    error: 'Discord OAuth callback is not implemented yet.',
  });
});

module.exports = { router };
