const path = require('path');

function notFoundHandler(publicPath) {
  return (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
      return res.status(404).json({ ok: false, error: 'Route not found.' });
    }

    return res.status(404).sendFile(path.join(publicPath, '404.html'));
  };
}

module.exports = { notFoundHandler };
