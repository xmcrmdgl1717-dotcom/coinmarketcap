const express = require('express');
const cmc = require('../providers/cmc');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const trendingList = await cmc.fetchTrending();
    res.json({ data: trendingList });
  } catch (err) {
    res.status(502).json({ error: 'trending unavailable' });
  }
});
module.exports = router;
