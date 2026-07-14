const express = require('express');
const path = require('path');
const { router: publicApiRouter } = require('./routes/publicApi');
const { router: ownerAdminRouter } = require('./routes/ownerAdmin');
const { router: authRouter } = require('./routes/auth');
const { notFoundHandler } = require('./middleware/notFound');

const SITE_VERSION = String(
  process.env.RAILWAY_GIT_COMMIT_SHA
  || process.env.RAILWAY_DEPLOYMENT_ID
  || process.env.SOURCE_VERSION
  || process.env.GIT_COMMIT
  || `local-${Date.now()}`
).trim();

function createApp() {
  const app = express();
  const publicPath = path.join(__dirname, '..', 'public');

  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/api/site-version', (req, res) => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store',
    });
    res.json({ ok: true, version: SITE_VERSION });
  });

  app.get('/', (req, res) => res.sendFile(path.join(publicPath, 'index.html')));
  app.get('/dashboard', (req, res) => res.sendFile(path.join(publicPath, 'dashboard.html')));
  app.get('/demo', (req, res) => res.sendFile(path.join(publicPath, 'demo.html')));
  app.get('/demo/dashboard', (req, res) => res.sendFile(path.join(publicPath, 'demo.html')));
  app.get('/demo/settings', (req, res) => res.sendFile(path.join(publicPath, 'demo.html')));
  app.get('/demo/server/:guildId', (req, res) => res.sendFile(path.join(publicPath, 'demo.html')));
  app.get('/demo/server/:guildId/:section', (req, res) => res.sendFile(path.join(publicPath, 'demo.html')));
  app.get('/dashboard/settings', (req, res) => res.sendFile(path.join(publicPath, 'dashboard.html')));
  app.get('/dashboard/server/:guildId', (req, res) => res.sendFile(path.join(publicPath, 'dashboard.html')));
  app.get('/dashboard/server/:guildId/:section', (req, res) => res.sendFile(path.join(publicPath, 'dashboard.html')));
  app.get('/docs', (req, res) => res.sendFile(path.join(publicPath, 'docs.html')));
  app.get('/documentation', (req, res) => res.redirect('/docs'));
  app.get('/commands', (req, res) => res.redirect('/docs'));
  app.get('/changelog', (req, res) => res.sendFile(path.join(publicPath, 'changelog.html')));

  app.use(express.static(publicPath));

  app.use('/api', ownerAdminRouter);
  app.use('/api', publicApiRouter);
  app.use('/auth', authRouter);

  app.get('*', notFoundHandler(publicPath));

  return app;
}

module.exports = { createApp };
