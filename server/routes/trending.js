const express = require('express');
const cmc = require('../providers/cmc');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await cmc.fetchListing({ start: 1, limit: 5 });
    res.json({ data: result.data });
  } catch (err) {
    res.status(502).json({ error: 'trending unavailable' });
  }
});
module.exports = router;
