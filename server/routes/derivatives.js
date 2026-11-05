const express = require('express');
const cache = require('../utils/cache');
const { dedupe } = require('../utils/inflight');
const cmc = require('../providers/cmc');
const router = express.Router();

router.get('/', async (req, res) => {
  const key = 'derivatives';
  const cached = cache.get(key);
  if (cached) return res.json({ ...cached, cached: true });

  try {
    const result = await dedupe(key, async () => {
      const r = await cmc.fetchDerivatives();
      cache.set(key, r, 60 * 1000);
      return r;
    });
    return res.json({ ...result, cached: false });
  } catch (err) {
    res.status(502).json({ error: 'derivatives unavailable' });
  }
});
module.exports = router;
