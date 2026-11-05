const express = require('express');
const cache = require('../utils/cache');
const { dedupe } = require('../utils/inflight');
const config = require('../config');
const cmc = require('../providers/cmc');
const coinlore = require('../providers/coinlore');

const router = express.Router();

// 1. 新增：全量拉取接口
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

        // 循环拉取直到获取全部数据
        while (start <= totalCount) {
          const r = await cmc.fetchListing({ start, limit });
          allData.push(...r.data);
          totalCount = r.totalCount;
          start += limit;
          if (r.data.length < limit) break;
        }
        
        const finalRes = { data: allData, totalCount: allData.length, source: 'cmc' };
        cache.set(key, finalRes, 5 * 60 * 1000); // 全量数据缓存 5 分钟
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

// 2. 原有分页接口保留（用于部分局部刷新）
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
