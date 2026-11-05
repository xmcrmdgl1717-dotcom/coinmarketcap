const express = require('express');
const path = require('path');
const config = require('./config');

const app = express();

// ==========================================
// 核心：允许前端跨域请求 (CORS)
// ==========================================
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// 静态文件服务
app.use(express.static(path.join(__dirname, '..', 'public')));

// ==========================================
// 挂载所有 API 路由
// ==========================================
app.use('/api/listing', require('./routes/listing'));       // 表格数据
app.use('/api/global', require('./routes/global'));         // 卡片1：全球数据 & 恐慌贪婪
app.use('/api/trending', require('./routes/trending'));     // 卡片2：热门币种
app.use('/api/derivatives', require('./routes/derivatives')); // 卡片3：衍生品爆仓

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || config.port || 3001;
app.listen(PORT, () => {
  console.log(`BFF listening on port ${PORT}`);
});
