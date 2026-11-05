const express = require('express');
const cache = require('../utils/cache');
const cmc = require('../providers/cmc');
const router = express.Router();

router.get('/', async (req, res) => {
  const key = 'global-metrics';
  const cached = cache.get(key);
  if (cached) return res.json({ ...cached, cached: true });

  try {
    const [globalData, fearGreed] = await Promise.all([
      cmc.fetchGlobal(),
      cmc.fetchFearGreed(),
    ]);
    const result = { ...globalData, fearGreed };
    cache.set(key, result, 60 * 1000); // 缓存 1 分钟
    return res.json(result);
  } catch (err) {
    console.error('[global] failed:', err.message);
    return res.status(502).json({ error: 'global metrics unavailable' });
  }
});
module.exports = router;
