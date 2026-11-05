const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env');
if (process.env.NODE_ENV !== 'production' && fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

module.exports = {
  port: Number(process.env.PORT) || 3001,
  cmc: {
    // 如果没有填写 API Key，强制使用免费的 public-api 路径
    baseUrl: process.env.CMC_API_KEY ? 'https://pro-api.coinmarketcap.com' : 'https://pro-api.coinmarketcap.com/public-api',
    apiKey: process.env.CMC_API_KEY || '',
    timeout: 10000,
  },
  cache: {
    listing: 30 * 1000,
    global: 60 * 1000,
  }
};
