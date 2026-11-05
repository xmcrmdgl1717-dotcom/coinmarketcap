const express = require('express');
const cache = require('../utils/cache');
const router = express.Router();

// 清洗并确保 K 线绝对合法：时间必须是秒级时间戳，且绝对升序
function cleanKlines(klines) {
  if (!Array.isArray(klines) || klines.length === 0) return [];
  
  const cleaned = klines.map(k => {
    let t = parseInt(k.time || k[0]);
    if (t > 1e11) t = Math.floor(t / 1000); // 毫秒转秒
    
    return {
      time: t,
      open: parseFloat(k.open || k[1]),
      high: parseFloat(k.high || k[2]),
      low: parseFloat(k.low || k[3]),
      close: parseFloat(k.close || k[4])
    };
  }).filter(k => !isNaN(k.time) && !isNaN(k.close) && k.time > 0);

  cleaned.sort((a, b) => a.time - b.time);
  return cleaned;
}

async function fetchOKX(symbol) {
  try {
    const instId = `${symbol.toUpperCase()}-USDT`;
    const [tickerRes, klineRes] = await Promise.all([
      fetch(`https://www.okx.com/api/v5/market/ticker?instId=${instId}`),
      fetch(`https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=1D&limit=7`)
    ]);
    
    if (!tickerRes.ok || !klineRes.ok) return null;
    
    const tickerData = (await tickerRes.json()).data?.[0];
    const klineRaw = (await klineRes.json()).data || [];
    
    if (!tickerData) return null;
    
    const price = parseFloat(tickerData.last);
    const open24h = parseFloat(tickerData.open24h);
    const pct24h = open24h ? ((price - open24h) / open24h) * 100 : 0;
    
    const rawKlines = klineRaw.map(k => ({
      time: k[0], open: k[1], high: k[2], low: k[3], close: k[4]
    }));
    const klines = cleanKlines(rawKlines);

    const pct7d = klines.length > 0 ? ((price - klines[0].open) / klines[0].open) * 100 : 0;

    return { 
      price, pct24h, pct7d, pct1h: 0, 
      vol24h: parseFloat(tickerData.volCcy24h || 0), 
      klines, source: 'OKX' 
    };
  } catch (e) {
    return null;
  }
}

async function fetchBinance(symbol) {
  try {
    const bSymbol = `${symbol.toUpperCase()}USDT`;
    const [tickerRes, klineRes] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${bSymbol}`),
      fetch(`https://api.binance.com/api/v3/klines?symbol=${bSymbol}&interval=1d&limit=7`)
    ]);
    
    if (!tickerRes.ok || !klineRes.ok) return null;
    
    const t = await tickerRes.json();
    const klineRaw = await klineRes.json();
    
    const rawKlines = klineRaw.map(k => ({
      time: k[0], open: k[1], high: k[2], low: k[3], close: k[4]
    }));
    const klines = cleanKlines(rawKlines);

    const price = parseFloat(t.lastPrice);
    const pct7d = klines.length > 0 ? ((price - klines[0].open) / klines[0].open) * 100 : 0;

    return { 
      price, pct24h: parseFloat(t.priceChangePercent || 0), pct7d, pct1h: 0,
      vol24h: parseFloat(t.quoteVolume || 0), klines, source: 'Binance' 
    };
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
    let result = await fetchOKX(symbol);
    if (!result) result = await fetchBinance(symbol);

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
