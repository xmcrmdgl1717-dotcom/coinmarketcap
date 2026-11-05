const express = require('express');
const cache = require('../utils/cache');
const cmc = require('../providers/cmc');
const router = express.Router();

router.get('/', async (req, res) => {
  const key = 'global-metrics';
  const cached = cache.get(key);
  if (cached) return res.json(cached);

  try {
    // 1. 拉取 CMC 全局数据 (市值等基础数据)
    const globalData = await cmc.fetchGlobal();
    
    // 2. 拉取 Alternative.me 的恐惧贪婪指数
    let fearGreed = { value: 50, classification: 'Neutral' };
    try {
      const fngRes = await fetch('https://api.alternative.me/fng/');
      if (fngRes.ok) {
        const fngData = await fngRes.json();
        fearGreed = {
          value: parseInt(fngData.data[0].value),
          classification: fngData.data[0].value_classification
        };
      }
    } catch (e) {
      // 若 Alternative.me 失败，回退到 CMC
      fearGreed = await cmc.fetchFearGreed();
    }

    const result = { ...globalData, fearGreed };
    cache.set(key, result, 10 * 1000); // 10秒缓存
    return res.json(result);
  } catch (err) {
    return res.status(200).json({}); 
  }
});
module.exports = router;
