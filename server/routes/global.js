const express = require('express');
const cache = require('../utils/cache');
const { dedupe } = require('../utils/inflight');
const config = require('../config');
const cmc = require('../providers/cmc');

const router = express.Router();

router.get('/', async (req, res) => {
  const key = 'global';
  const cached = cache.get(key);
  if (cached) return res.json({ ...cached, cached: true });

  try {
    const result = await dedupe(key, async () => {
      const r = await cmc.fetchGlobal();
      cache.set(key, r, config.cache.global);
      return r;
    });
    return res.json({ ...result, cached: false });
  } catch (err) {
    console.error('[global] failed:', err.message);
    return res.status(502).json({ error: 'global metrics unavailable' });
  }
});

module.exports = router;
