require('dotenv').config();
const createApp = require('./app');

const PORT = process.env.PORT || 3000;
const app = createApp();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`EVE diagnostics backend listening on port ${PORT}`);
});
