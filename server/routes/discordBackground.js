const express = require('express');
const backgroundHex = require('../assets/discordBackgroundHex');

const router = express.Router();
let cachedImage;

function getImage() {
  if (cachedImage) return cachedImage;

  const image = Buffer.from(backgroundHex, 'hex');
  const valid = image.length > 12
    && image.subarray(0, 4).toString('ascii') === 'RIFF'
    && image.subarray(8, 12).toString('ascii') === 'WEBP';

  if (!valid) throw new Error('Invalid background image data.');

  cachedImage = image;
  return cachedImage;
}

router.get('/media/discord/fantasy-girl-background.webp', (req, res, next) => {
  try {
    const image = getImage();
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

module.exports = { router, getImage };
