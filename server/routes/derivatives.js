const express = require('express');
const cache = require('../utils/cache');
const cmc = require('../providers/cmc');
const router = express.Router();

router.get('/', async (req, res) => {
  const key = 'derivatives';
  const cached = cache.get(key);
  if (cached) return res.json(cached);

  try {
    const result = await cmc.fetchDerivatives();
    cache.set(key, result, 60 * 1000);
    return res.json(result);
  } catch (err) {
    res.status(502).json({ error: 'derivatives unavailable' });
  }
});
module.exports = router;
