const express = require('express');
const cache = require('../utils/cache');
const { dedupe } = require('../utils/inflight');
const config = require('../config');
const cmc = require('../providers/cmc');
const coinlore = require('../providers/coinlore');

const router = express.Router();

// ==========================================
// 获取全量币种数据 (用于前端一次性拉取)
// ==========================================
router.get('/all', async (req, res) => {
  const key = 'listing:all';
  const cached = cache.get(key);
  if (cached) return res.json({ ...cached, cached: true });

  try {
    const result = await dedupe(key, async () => {
      try {
        let allData = [];
        let start = 1;
        const limit = 5000; // CMC 单次请求最大限制
        let totalCount = Infinity;

        // 循环拉取直到没有更多数据
        while (start <= totalCount) {
          const r = await cmc.fetchListing({ start, limit });
          allData.push(...r.data);
          totalCount = r.totalCount;
          start += limit;
          if (r.data.length < limit) break;
        }
        
        const finalRes = { data: allData, totalCount: allData.length, source: 'cmc' };
        cache.set(key, finalRes, 5 * 60 * 1000); // 缓存 5 分钟
        return finalRes;
      } catch (err) {
        console.warn('[listing/all] CMC failed, fallback CoinLore:', err.message);
        const r = await coinlore.fetchListing({ start: 1, limit: 10000 });
        cache.set(key, r, 5 * 60 * 1000);
        return { ...r, fallback: true };
      }
    });
    return res.json({ ...result, cached: false });
  } catch (err) {
    console.error('[listing/all] all providers failed:', err.message);
    return res.status(502).json({ error: 'data source unavailable' });
  }
});

// ==========================================
// 原有分页接口 (保持兼容)
// ==========================================
router.get('/', async (req, res) => {
  const start = Math.max(1, parseInt(req.query.start, 10) || 1);
  const limit = Math.min(5000, Math.max(1, parseInt(req.query.limit, 10) || 100));
  const key = `listing:${start}:${limit}`;

  const cached = cache.get(key);
  if (cached) return res.json({ ...cached, cached: true });

  try {
    const result = await dedupe(key, async () => {
      try {
        const r = await cmc.fetchListing({ start, limit });
        cache.set(key, r, config.cache.listing);
        return r;
      } catch (err) {
        console.warn('[listing] CMC failed, fallback CoinLore:', err.message);
        const r = await coinlore.fetchListing({ start, limit });
        cache.set(key, r, config.cache.listing);
        return { ...r, fallback: true };
      }
    });
    return res.json({ ...result, cached: false });
  } catch (err) {
    console.error('[listing] all providers failed:', err.message);
    return res.status(502).json({ error: 'data source unavailable' });
  }
});

module.exports = router;
