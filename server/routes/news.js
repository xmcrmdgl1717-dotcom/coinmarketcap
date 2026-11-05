const express = require('express');
const cache = require('../utils/cache'); // 复用你现有的缓存工具
const router = express.Router();

// 缓存 key
const CACHE_KEY = 'crypto_daily_news';
// 24小时缓存 (单位毫秒)
const CACHE_TTL = 24 * 60 * 60 * 1000; 

router.get('/', async (req, res) => {
  // 1. 尝试从缓存读取
  const cached = cache.get(CACHE_KEY);
  if (cached) {
    return res.json(cached);
  }

  try {
    // 2. 请求免费新闻接口
    // 这里使用 cryptocurrency.cv 的免费接口，无需 API Key
    const response = await fetch('https://cryptocurrency.cv/api/news?limit=10', {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) throw new Error(`News API HTTP ${response.status}`);
    
    const data = await response.json();
    
    // 3. 提取新闻数据（兼容不同的数据结构）
    // 通常数据在 data.articles 或直接是数组
    const articles = data.articles || data.data || data || [];
    
    if (!articles.length) {
      throw new Error('No articles found from API');
    }

    // 4. 截取前 3 条，并提取标题、描述
    // 注意：不同新闻源的字段名可能不同（如 title/name, description/summary/body）
    const topNews = articles.slice(0, 3).map(item => {
      // 简单处理描述：截取前 80 个字符，避免轮播图文字过长
      let rawDesc = item.description || item.summary || item.body || '';
      // 去除 HTML 标签
      rawDesc = rawDesc.replace(/<[^>]*>?/gm, '');
      const shortDesc = rawDesc.length > 80 ? rawDesc.substring(0, 80) + '...' : rawDesc;
      
      return {
        title: item.title || item.name || 'Latest Crypto News',
        description: shortDesc || 'Stay updated with the latest market trends.',
        url: item.url || item.link || '#'
      };
    });

    // 5. 写入缓存
    cache.set(CACHE_KEY, topNews, CACHE_TTL);
    
    // 6. 返回结果
    return res.json(topNews);

  } catch (err) {
    console.error('[News API] Failed:', err.message);
    // 如果接口挂了，返回 3 条兜底的静态新闻，保证页面不空
    return res.json([
      { title: 'Bitcoin Halving 2024', description: 'The supply shock is coming. Are you ready?', url: '#' },
      { title: 'Ethereum 2.0 Staking', description: 'Earn passive income with your ETH', url: '#' },
      { title: 'DeFi Summer is Back', description: 'Discover the hottest yields on-chain', url: '#' }
    ]);
  }
});

module.exports = router;
