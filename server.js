require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { createApp } = require('./server/app');

const app = createApp();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Meowz website running on port ${PORT}`);
});
