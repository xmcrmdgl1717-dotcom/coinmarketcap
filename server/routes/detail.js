const express = require('express');
const cache = require('../utils/cache');
const router = express.Router();

// 清洗 K 线数据，确保升序、数字类型
function cleanKlines(klines) {
  if (!Array.isArray(klines)) return [];
  return klines.map(k => ({
    time: parseInt(k.time),
    open: parseFloat(k.open),
    high: parseFloat(k.high),
    low: parseFloat(k.low),
    close: parseFloat(k.close)
  })).filter(k => !isNaN(k.time) && !isNaN(k.close)).sort((a, b) => a.time - b.time);
}

async function fetchOKXDetail(symbol) {
  try {
    const instId = `${symbol.toUpperCase()}-USDT`;
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

    // OKX 返回的 K 线是 [时间, 开, 高, 低, 收, 量...]，时间倒序
    const rawKlines = klineData.data.map(k => ({
      time: parseInt(k[0]) / 1000,
      open: k[1],
      high: k[2],
      low: k[3],
      close: k[4]
    }));
    
    // 清洗并升序
    const klines = cleanKlines(rawKlines);

    const pct1h = 0; 
    const pct7d = klines.length > 1 ? ((price - klines[0].open) / klines[0].open) * 100 : 0;

    return { price, pct1h, pct24h, pct7d, vol24h, klines, source: 'OKX' };
  } catch (e) {
    return null;
  }
}

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

    const rawKlines = klineData.map(k => ({
      time: parseInt(k[0]) / 1000,
      open: k[1],
      high: k[2],
      low: k[3],
      close: k[4]
    }));

    const klines = cleanKlines(rawKlines);

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
      cache.set(key, result, 10 * 1000);
      return res.json(result);
    }
    
    return res.status(404).json({ error: 'Detail not available' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
