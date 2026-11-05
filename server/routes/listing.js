const express = require('express');
const cache = require('../utils/cache');
const cmc = require('../providers/cmc');
const router = express.Router();

// ==========================================
// 核心：从币安获取实时价格与涨跌幅
// ==========================================
async function getBinanceData() {
  try {
    // 使用 24hr 接口，同时获取最新价和 24h 涨跌幅
    const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
    
    const data = await res.json();
    const map = {};
    
    // 遍历币安数据，提取 USDT 交易对
    data.forEach(item => {
      if (item.symbol.endsWith('USDT')) {
        // 将 BTCUSDT 截取为 BTC
        const symbol = item.symbol.replace('USDT', '');
        map[symbol] = {
          price: parseFloat(item.lastPrice),
          percentChange24h: parseFloat(item.priceChangePercent)
        };
      }
    });
    return map;
  } catch (e) {
    console.error('[Binance] 获取实时数据失败:', e.message);
    return {}; // 失败则返回空对象，后续会自动降级使用 CMC 数据
  }
}

// ==========================================
// 行情列表路由
// ==========================================
router.get('/', async (req, res) => {
  const start = Math.max(1, parseInt(req.query.start, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
  const key = `listing:${start}:${limit}`;
  
  // 缓存时间设为 5 秒，配合前端的高频刷新
  const cached = cache.get(key);
  if (cached) return res.json(cached);

  try {
    // 并行请求：CMC 获取基础数据，Binance 获取实时价格
    const [cmcResult, binanceData] = await Promise.all([
      cmc.fetchListing({ start, limit }),
      getBinanceData()
    ]);

    // 合并数据：用币安的实时数据覆盖 CMC 的缓存数据
    const finalData = cmcResult.data.map(coin => {
      // 特殊处理 USDT 稳定币
      if (coin.symbol === 'USDT') {
        coin.price = 1.00;
        coin.percentChange24h = 0.00;
        return coin;
      }

      // 如果币安有这个币种的数据，进行覆盖
      if (binanceData[coin.symbol]) {
        coin.price = binanceData[coin.symbol].price;
        coin.percentChange24h = binanceData[coin.symbol].percentChange24h;
      }
      
      return coin;
    });

    const result = {
      data: finalData,
      totalCount: cmcResult.totalCount
    };

    // 缓存 5 秒
    cache.set(key, result, 5 * 1000);
    return res.json(result);

  } catch (err) {
    console.error('[listing] 所有数据源失败:', err.message);
    return res.status(200).json({ data: [] });
  }
});

module.exports = router;
