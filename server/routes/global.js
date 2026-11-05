const express = require('express');
const cache = require('../utils/cache');
const cmc = require('../providers/cmc');
const router = express.Router();

router.get('/', async (req, res) => {
  const key = 'global-metrics';
  const cached = cache.get(key);
  if (cached) return res.json(cached);

  try {
    const [globalData, fearGreed] = await Promise.all([
      cmc.fetchGlobal(),
      cmc.fetchFearGreed(),
    ]);
    const result = { ...globalData, fearGreed };
    cache.set(key, result, 60 * 1000);
    return res.json(result);
  } catch (err) {
    return res.status(502).json({ error: 'global unavailable' });
  }
});
module.exports = router;
