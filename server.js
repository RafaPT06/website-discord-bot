const express = require('express');

const app = express();

app.use(express.static('public'));

app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    name: 'Ruffles Bot',
    message: 'Website is running',
    updatedAt: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Ruffles website running on port ${PORT}`);
});
