const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const assetDirectory = path.join(__dirname, '..', 'assets', 'discord-background');
let cachedBackground = null;

function loadBackground() {
  if (cachedBackground) return cachedBackground;

  const chunkFiles = fs
    .readdirSync(assetDirectory)
    .filter((fileName) => /^part-\d+\.b64$/.test(fileName))
    .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));

  if (!chunkFiles.length) {
    throw new Error('Discord background asset chunks are missing.');
  }

  const encodedImage = chunkFiles
    .map((fileName) => fs.readFileSync(path.join(assetDirectory, fileName), 'utf8').trim())
    .join('');

  const image = Buffer.from(encodedImage, 'base64');
  const isWebP = image.length > 12
    && image.subarray(0, 4).toString('ascii') === 'RIFF'
    && image.subarray(8, 12).toString('ascii') === 'WEBP';

  if (!isWebP) {
    throw new Error('Discord background asset is not a valid WebP image.');
  }

  cachedBackground = image;
  return cachedBackground;
}

router.get('/media/discord/fantasy-girl-background.webp', (req, res, next) => {
  try {
    const image = loadBackground();

    res.set({
      'Content-Type': 'image/webp',
      'Content-Length': String(image.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });

    res.end(image);
  } catch (error) {
    next(error);
  }
});

module.exports = { router, loadBackground };
