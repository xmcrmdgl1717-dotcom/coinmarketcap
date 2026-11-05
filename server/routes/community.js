const express = require('express');
const cache = require('../utils/cache');
const { dedupe } = require('../utils/inflight');
const cmc = require('../providers/cmc');
const router = express.Router();

router.get('/', async (req, res) => {
  const key = 'community-posts';
  const cached = cache.get(key);
  if (cached) return res.json({ ...cached, cached: true });

  try {
    const result = await dedupe(key, async () => {
      const r = await cmc.fetchCommunityPosts(2);
      cache.set(key, r, 120 * 1000);
      return r;
    });
    return res.json({ ...result, cached: false });
  } catch (err) {
    res.status(502).json({ error: 'community posts unavailable' });
  }
});
module.exports = router;
