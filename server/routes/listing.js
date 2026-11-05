const express = require('express');
const cache = require('../utils/cache');
const cmc = require('../providers/cmc');
const router = express.Router();

// 核心：从 OKX (欧易) 获取精准的实时数据
// 使用 OKX 是因为国内服务器连接极其稳定，不会像币安那样被墙
async function getRealTimeCryptoData() {
  try {
    // OKX 的 tickers 接口返回全量币种，国内直连非常快
    const res = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT');
    if (!res.ok) throw new Error(`OKX HTTP ${res.status}`);
    
    const data = await res.json();
    const map = {};
    
    if (data && data.data) {
      data.data.forEach(item => {
        // OKX 交易对格式如 "BTC-USDT"
        if (item.instId.endsWith('-USDT')) {
          const symbol = item.instId.replace('-USDT', '');
          const price = parseFloat(item.last);
          const open24h = parseFloat(item.open24h);
          
          if (!isNaN(price) && !isNaN(open24h) && open24h > 0) {
            // 计算 24h 涨跌幅
            const percentChange24h = ((price - open24h) / open24h) * 100;
            map[symbol] = { price, percentChange24h };
          }
        }
      });
    }
    return map;
  } catch (e) {
    console.error('[Crypto Market] 获取实时数据失败:', e.message);
    return {}; // 失败降级为 CMC 数据
  }
}

// ==========================================
// 行情列表路由
// ==========================================
router.get('/', async (req, res) => {
  const start = Math.max(1, parseInt(req.query.start, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
  const key = `listing:${start}:${limit}`;
  
  // 缓存时间降至 3 秒，让高频刷新更极致
  const cached = cache.get(key);
  if (cached) return res.json(cached);

  try {
    // 并行请求：CMC 拿排名/市值，OKX 拿实时价格
    const [cmcResult, realTimeData] = await Promise.all([
      cmc.fetchListing({ start, limit }),
      getRealTimeCryptoData()
    ]);

    const now = Date.now(); // 后端当前时间戳

    // 合并数据
    const finalData = cmcResult.data.map(coin => {
      // 特殊处理：稳定币
      if (coin.symbol === 'USDT' || coin.symbol === 'USDC' || coin.symbol === 'DAI') {
        coin.price = 1.00;
        coin.percentChange24h = 0.00;
        coin.updateTime = now;
        return coin;
      }

      // 如果 OKX 有数据，直接覆盖
      if (realTimeData[coin.symbol]) {
        coin.price = realTimeData[coin.symbol].price;
        coin.percentChange24h = realTimeData[coin.symbol].percentChange24h;
      }
      
      // 注入一个更新时间戳，前端用来证明刷新了
      coin.updateTime = now;
      
      return coin;
    });

    const result = {
      data: finalData,
      totalCount: cmcResult.totalCount
    };

    // 缓存 3 秒
    cache.set(key, result, 3 * 1000);
    return res.json(result);

  } catch (err) {
    console.error('[listing] 所有数据源失败:', err.message);
    return res.status(200).json({ data: [] });
  }
});

module.exports = router;
