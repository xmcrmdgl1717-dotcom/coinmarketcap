const express = require('express');
const path = require('path');
const config = require('./config');
const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// API 路由挂载
app.use('/api/listing', require('./routes/listing')); // 之前配好的混合行情源
app.use('/api/global', require('./routes/global'));
app.use('/api/trending', require('./routes/trending'));
app.use('/api/derivatives', require('./routes/derivatives'));
app.use('/api/news', require('./routes/news'));
app.use('/api/detail', require('./routes/detail')); // 新增弹窗详情

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || config.port || 3001;
app.listen(PORT, () => console.log(`BFF listening on port ${PORT}`));
