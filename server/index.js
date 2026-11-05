const express = require('express');
const path = require('path');
const config = require('./config');

const app = express();

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/listing', require('./routes/listing'));
app.use('/api/global', require('./routes/global'));
app.use('/api/fear-greed', require('./routes/fearGreed'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(config.port, () => {
  console.log(`BFF listening on http://localhost:${config.port}`);
});
