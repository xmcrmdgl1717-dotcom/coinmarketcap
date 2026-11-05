const express = require('express');
const cache = require('../utils/cache');
const { dedupe } = require('../utils/inflight');
const config = require('../config');
const cmc = require('../providers/cmc');

const router = express.Router();

router.get('/', async (req, res) => {
  const key = 'fearGreed';
  const cached = cache.get(key);
  if (cached) return res.json({ ...cached, cached: true });

  try {
    const result = await dedupe(key, async () => {
      const r = await cmc.fetchFearGreed();
      cache.set(key, r, config.cache.fearGreed);
      return r;
    });
    return res.json({ ...result, cached: false });
  } catch (err) {
    console.error('[fear-greed] failed:', err.message);
    return res.status(502).json({ error: 'fear and greed unavailable' });
  }
});

module.exports = router;
