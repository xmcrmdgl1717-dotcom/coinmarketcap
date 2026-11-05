const express = require('express');
const cache = require('../utils/cache');
const router = express.Router();

const CACHE_KEY = 'crypto_daily_news';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 缓存 24 小时

// 绝对兜底数据（接口全挂时使用）
const fallbackNews = [
  { title: 'Bitcoin Market Update', description: 'Stay updated with the latest Bitcoin price movements and institutional adoption.', url: '#' },
  { title: 'Ethereum Ecosystem', description: 'Explore new developments in the ETH network, Layer 2 scaling, and DeFi.', url: '#' },
  { title: 'Crypto Trends 2024', description: 'Discover what is shaping the crypto market this year, from AI to RWA.', url: '#' }
];

// 源1：cryptocurrency.cv
async function fetchSource1() {
  const res = await fetch('https://cryptocurrency.cv/api/news?limit=10', { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error('Source1 HTTP ' + res.status);
  const data = await res.json();
  const list = data.articles || data.data || data || [];
  if (!list || !list.length) throw new Error('Source1 empty');
  return list.map(item => ({
    title: item.title || item.name,
    description: item.description || item.summary || item.body || '',
    url: '#'
  }));
}

// 源2：CryptoCompare (极其稳定)
async function fetchSource2() {
  const res = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN', { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error('Source2 HTTP ' + res.status);
  const data = await res.json();
  const list = data.Data || [];
  if (!list || !list.length) throw new Error('Source2 empty');
  return list.map(item => ({
    title: item.title,
    description: item.body,
    url: '#'
  }));
}

// 源3：RSS to JSON (Cointelegraph)
async function fetchSource3() {
  const res = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://cointelegraph.com/rss', { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error('Source3 HTTP ' + res.status);
  const data = await res.json();
  const list = data.items || [];
  if (!list || !list.length) throw new Error('Source3 empty');
  return list.map(item => ({
    title: item.title,
    description: item.description,
    url: '#'
  }));
}

router.get('/', async (req, res) => {
  const cached = cache.get(CACHE_KEY);
  if (cached) return res.json(cached);

  let rawArticles = [];
  let success = false;

  // 尝试源1
  try {
    rawArticles = await fetchSource1();
    success = true;
  } catch (e) { console.warn('[News] 源1失败:', e.message); }

  // 尝试源2
  if (!success) {
    try {
      rawArticles = await fetchSource2();
      success = true;
    } catch (e) { console.warn('[News] 源2失败:', e.message); }
  }

  // 尝试源3
  if (!success) {
    try {
      rawArticles = await fetchSource3();
      success = true;
    } catch (e) { console.warn('[News] 源3失败:', e.message); }
  }

  // 全部失败，返回兜底数据
  if (!success || rawArticles.length === 0) {
    console.log('[News] 所有新闻源均失效，返回默认新闻');
    cache.set(CACHE_KEY, fallbackNews, CACHE_TTL);
    return res.json(fallbackNews);
  }

  // 提取前 3 条并清洗数据
  const topNews = rawArticles.slice(0, 3).map(item => {
    let rawDesc = item.description || '';
    rawDesc = rawDesc.replace(/<[^>]*>?/gm, ''); // 去除 HTML 标签
    const shortDesc = rawDesc.length > 80 ? rawDesc.substring(0, 80) + '...' : rawDesc;
    return {
      title: item.title || 'Latest Crypto News',
      description: shortDesc || 'Stay updated with the latest market trends.',
      url: '#'
    };
  });

  cache.set(CACHE_KEY, topNews, CACHE_TTL);
  return res.json(topNews);
});

module.exports = router;
