const express = require('express');
const path = require('path');
const { router: publicApiRouter } = require('./routes/publicApi');
const { router: authRouter } = require('./routes/auth');
const { notFoundHandler } = require('./middleware/notFound');

function createApp() {
  const app = express();
  const publicPath = path.join(__dirname, '..', 'public');

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(express.static(publicPath));

  app.use('/api', publicApiRouter);
  app.use('/auth', authRouter);

  app.get('*', notFoundHandler(publicPath));

  return app;
}

module.exports = { createApp };
