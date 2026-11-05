const express = require('express');
const path = require('path');
const config = require('./config');

const app = express();

// ==========================================
// 核心：允许前端跨域请求 (CORS)
// ==========================================
app.use((req, res, next) => {
  // 允许任何前端域名访问
  res.setHeader('Access-Control-Allow-Origin', '*');
  // 允许的请求方法
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  // 允许的请求头
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
  
  // 拦截浏览器的预检请求 (OPTIONS)，直接返回 200 放行
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// 静态文件服务
app.use(express.static(path.join(__dirname, '..', 'public')));

// 挂载路由
app.use('/api/listing', require('./routes/listing'));
app.use('/api/global', require('./routes/global'));
app.use('/api/fear-greed', require('./routes/fearGreed'));

// 健康检查接口
app.get('/api/health', (req, res) => res.json({ ok: true }));

// 启动服务
const PORT = process.env.PORT || config.port || 3001;
app.listen(PORT, () => {
  console.log(`BFF listening on port ${PORT}`);
});
