const express = require('express');
const path = require('path');
const config = require('./config');
const app = express();

// 跨域设置
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// 静态文件服务
app.use(express.static(path.join(__dirname, '..', 'public')));

// 挂载所有 API 路由
app.use('/api/listing', require('./routes/listing'));
app.use('/api/global', require('./routes/global'));
app.use('/api/trending', require('./routes/trending'));
app.use('/api/derivatives', require('./routes/derivatives'));
app.use('/api/news', require('./routes/news')); // <-- 挂载新闻路由

app.get('/api/health', (req, res) => res.json({ ok: true }));
const PORT = process.env.PORT || config.port || 3001;
app.listen(PORT, () => console.log(`BFF listening on port ${PORT}`));
