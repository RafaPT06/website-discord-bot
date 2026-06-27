const express = require('express');
const path = require('path');
const { router: publicApiRouter } = require('./routes/publicApi');
const { router: authRouter } = require('./routes/auth');
const { notFoundHandler } = require('./middleware/notFound');

function createApp() {
  const app = express();
  const publicPath = path.join(__dirname, '..', 'public');

  app.disable('x-powered-by');
  app.use(express.json());
  app.get('/', (req, res) => res.sendFile(path.join(publicPath, 'index.html')));
  app.get('/dashboard', (req, res) => res.sendFile(path.join(publicPath, 'dashboard.html')));
  app.get('/dashboard/server/:guildId', (req, res) => res.sendFile(path.join(publicPath, 'dashboard.html')));
  app.get('/docs', (req, res) => res.sendFile(path.join(publicPath, 'docs.html')));
  app.get('/documentation', (req, res) => res.redirect('/docs'));
  app.get('/commands', (req, res) => res.redirect('/docs'));
  app.get('/changelog', (req, res) => res.sendFile(path.join(publicPath, 'changelog.html')));

  app.use(express.static(publicPath));

  app.use('/api', publicApiRouter);
  app.use('/auth', authRouter);

  app.get('*', notFoundHandler(publicPath));

  return app;
}

module.exports = { createApp };
