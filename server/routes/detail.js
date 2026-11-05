const express = require('express');
const cache = require('../utils/cache');
const router = express.Router();

// 获取 OKX 的单币种详情
async function fetchOKXDetail(symbol) {
  try {
    const instId = `${symbol.toUpperCase()}-USDT`;
    // 并行请求 24h ticker 和 7天K线
    const [tickerRes, klineRes] = await Promise.all([
      fetch(`https://www.okx.com/api/v5/market/ticker?instId=${instId}`),
      fetch(`https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=1D&limit=7`)
    ]);
    
    if (!tickerRes.ok || !klineRes.ok) throw new Error('OKX API error');
    
    const tickerData = await tickerRes.json();
    const klineData = await klineRes.json();
    
    if (!tickerData.data || tickerData.data.length === 0) throw new Error('OKX no data');
    
    const t = tickerData.data[0];
    const price = parseFloat(t.last);
    const open24h = parseFloat(t.open24h);
    const vol24h = parseFloat(t.volCcy24h);
    const pct24h = ((price - open24h) / open24h) * 100;

    // 将 OKX K线数据转为标准格式
    const klines = klineData.data.map(k => ({
      time: parseInt(k[0]) / 1000, // 秒级时间戳
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4])
    })).reverse(); // OKX返回是倒序，需要翻转

    // 1小时和7天涨跌幅简单估算 (OKX 没有直接提供，用首尾K线算)
    const pct1h = 0; // 简化处理，可另拉1h K线计算
    const pct7d = klines.length > 1 ? ((price - klines[0].open) / klines[0].open) * 100 : 0;

    return { price, pct1h, pct24h, pct7d, vol24h, klines, source: 'OKX' };
  } catch (e) {
    return null;
  }
}

// 获取 Binance 的单币种详情 (兜底)
async function fetchBinanceDetail(symbol) {
  try {
    const bSymbol = `${symbol.toUpperCase()}USDT`;
    const [tickerRes, klineRes] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${bSymbol}`),
      fetch(`https://api.binance.com/api/v3/klines?symbol=${bSymbol}&interval=1d&limit=7`)
    ]);
    
    if (!tickerRes.ok || !klineRes.ok) throw new Error('Binance API error');
    
    const t = await tickerRes.json();
    const klineData = await klineRes.json();
    
    const price = parseFloat(t.lastPrice);
    const pct24h = parseFloat(t.priceChangePercent);
    const vol24h = parseFloat(t.quoteVolume);

    const klines = klineData.map(k => ({
      time: parseInt(k[0]) / 1000,
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4])
    }));

    const pct1h = 0; 
    const pct7d = klines.length > 1 ? ((price - klines[0].open) / klines[0].open) * 100 : 0;

    return { price, pct1h, pct24h, pct7d, vol24h, klines, source: 'Binance' };
  } catch (e) {
    return null;
  }
}

router.get('/', async (req, res) => {
  const symbol = req.query.symbol;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const key = `detail:${symbol}`;
  const cached = cache.get(key);
  if (cached) return res.json(cached);

  try {
    let result = await fetchOKXDetail(symbol);
    if (!result) result = await fetchBinanceDetail(symbol);

    if (result) {
      cache.set(key, result, 10 * 1000); // 详情缓存10秒
      return res.json(result);
    }
    
    return res.status(404).json({ error: 'Detail not available' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
