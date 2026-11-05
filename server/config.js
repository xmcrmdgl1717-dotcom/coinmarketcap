const fs = require('fs');
const path = require('path');

// 仅在本地开发且存在 .env 文件时加载，Render 环境跳过
const envPath = path.resolve(process.cwd(), '.env');
if (process.env.NODE_ENV !== 'production' && fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

module.exports = {
  port: Number(process.env.PORT) || 3001,
  cmc: {
    // 如果没有 API Key，必须走 /public-api。如果有 Key，请改成 'https://pro-api.coinmarketcap.com'
    baseUrl: process.env.CMC_API_KEY ? 'https://pro-api.coinmarketcap.com' : 'https://pro-api.coinmarketcap.com/public-api',
    apiKey: process.env.CMC_API_KEY || '',
    timeout: 10000,
  },
  cache: {
    listing: 30 * 1000, // 30秒
    global: 60 * 1000,  // 1分钟
  }
};
