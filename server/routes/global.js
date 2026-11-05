const express = require('express');
const cache = require('../utils/cache');
const cmc = require('../providers/cmc');
const router = express.Router();

router.get('/', async (req, res) => {
  const key = 'global-metrics';
  const cached = cache.get(key);
  if (cached) return res.json(cached);
  
  try {
    const globalData = await cmc.fetchGlobal();
    const fearGreed = await cmc.fetchFearGreed();
    const result = { ...globalData, fearGreed };
    cache.set(key, result, 60 * 1000);
    return res.json(result);
  } catch (err) {
    return res.status(200).json({}); // 确保不返回 502
  }
});
module.exports = router;
