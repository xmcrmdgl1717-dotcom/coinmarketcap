const express = require('express');
const cache = require('../utils/cache');
const cmc = require('../providers/cmc');
const router = express.Router();

// ---------- 数据源1: OKX ----------
async function getOKXData() {
  try {
    const res = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT');
    if (!res.ok) throw new Error(`OKX HTTP ${res.status}`);
    const data = await res.json();
    const map = {};
    if (data && data.data) {
      data.data.forEach(item => {
        if (item.instId && item.instId.endsWith('-USDT')) {
          const symbol = item.instId.replace('-USDT', '');
          const price = parseFloat(item.last);
          const open24h = parseFloat(item.open24h);
          if (!isNaN(price) && !isNaN(open24h) && open24h > 0) {
            map[symbol] = {
              price,
              percentChange24h: ((price - open24h) / open24h) * 100
            };
          }
        }
      });
    }
    console.log(`[OKX] 获取到 ${Object.keys(map).length} 个交易对`);
    return map;
  } catch (e) {
    console.error('[OKX] 获取失败:', e.message);
    return {};
  }
}

// ---------- 数据源2: Binance ----------
async function getBinanceData() {
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
    const data = await res.json();
    const map = {};
    data.forEach(item => {
      if (item.symbol && item.symbol.endsWith('USDT')) {
        const symbol = item.symbol.replace('USDT', '');
        const price = parseFloat(item.lastPrice);
        const changePercent = parseFloat(item.priceChangePercent);
        if (!isNaN(price)) {
          map[symbol] = {
            price,
            percentChange24h: isNaN(changePercent) ? 0 : changePercent
          };
        }
      }
    });
    console.log(`[Binance] 获取到 ${Object.keys(map).length} 个交易对`);
    return map;
  } catch (e) {
    console.error('[Binance] 获取失败:', e.message);
    return {};
  }
}

// ---------- 数据源3: CoinGecko (全量补充) ----------
async function getCoinGeckoData() {
  try {
    // 使用免费端点，获取前250个币的USD价格
    const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false');
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    const data = await res.json();
    const map = {};
    data.forEach(item => {
      if (item.symbol) {
        map[item.symbol.toUpperCase()] = {
          price: item.current_price,
          percentChange24h: item.price_change_percentage_24h ?? 0
        };
      }
    });
    console.log(`[CoinGecko] 获取到 ${Object.keys(map).length} 个币种`);
    return map;
  } catch (e) {
    console.error('[CoinGecko] 获取失败:', e.message);
    return {};
  }
}

// ---------- 主路由 ----------
router.get('/', async (req, res) => {
  const start = Math.max(1, parseInt(req.query.start, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
  const key = `listing:${start}:${limit}`;
  
  const cached = cache.get(key);
  if (cached) return res.json(cached);

  try {
    // 并行请求：CMC基础数据 + 三大实时数据源
    const [cmcResult, okxData, binanceData, geckoData] = await Promise.all([
      cmc.fetchListing({ start, limit }),
      getOKXData(),
      getBinanceData(),
      getCoinGeckoData()
    ]);

    const now = Date.now();

    // 核心合并逻辑：按优先级 OKX > Binance > CoinGecko > CMC
    const finalData = cmcResult.data.map(coin => {
      const symbol = coin.symbol.toUpperCase();

      // 稳定币特殊处理
      if (['USDT', 'USDC', 'DAI', 'TUSD', 'BUSD'].includes(symbol)) {
        coin.price = 1.00;
        coin.percentChange24h = 0.00;
        coin.updateTime = now;
        return coin;
      }

      // 1. 优先尝试 OKX
      if (okxData[symbol]) {
        coin.price = okxData[symbol].price;
        coin.percentChange24h = okxData[symbol].percentChange24h;
        coin.updateTime = now;
        coin.source = 'OKX';
        return coin;
      }

      // 2. 其次尝试 Binance
      if (binanceData[symbol]) {
        coin.price = binanceData[symbol].price;
        coin.percentChange24h = binanceData[symbol].percentChange24h;
        coin.updateTime = now;
        coin.source = 'Binance';
        return coin;
      }

      // 3. 再次尝试 CoinGecko
      if (geckoData[symbol]) {
        coin.price = geckoData[symbol].price;
        coin.percentChange24h = geckoData[symbol].percentChange24h;
        coin.updateTime = now;
        coin.source = 'CoinGecko';
        return coin;
      }

      // 4. 最终兜底：保留 CMC 原数据
      coin.updateTime = now;
      coin.source = 'CMC';
      return coin;
    });

    const result = {
      data: finalData,
      totalCount: cmcResult.totalCount
    };

    // 缓存3秒
    cache.set(key, result, 3 * 1000);
    return res.json(result);

  } catch (err) {
    console.error('[listing] 数据源全部失败:', err.message);
    return res.status(200).json({ data: [] });
  }
});

module.exports = router;
