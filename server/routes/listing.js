const express = require('express');
const cache = require('../utils/cache');
const cmc = require('../providers/cmc');
const router = express.Router();

router.get('/', async (req, res) => {
  const start = Math.max(1, parseInt(req.query.start, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
  const key = `listing:${start}:${limit}`;
  
  const cached = cache.get(key);
  if (cached) return res.json(cached);

  try {
    const result = await cmc.fetchListing({ start, limit });
    cache.set(key, result, 30 * 1000);
    return res.json(result);
  } catch (err) {
    return res.status(502).json({ error: 'data unavailable' });
  }
});
module.exports = router;
