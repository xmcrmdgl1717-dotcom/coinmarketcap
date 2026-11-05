const express = require('express');
const cache = require('../utils/cache');
const { dedupe } = require('../utils/inflight');
const config = require('../config');
const cmc = require('../providers/cmc');
const coinlore = require('../providers/coinlore');

const router = express.Router();

router.get('/', async (req, res) => {
  const start = Math.max(1, parseInt(req.query.start, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
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
