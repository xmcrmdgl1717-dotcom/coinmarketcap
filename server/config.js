require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT) || 3001,
  cmc: {
    baseUrl: 'https://pro-api.coinmarketcap.com',
    apiKey: process.env.CMC_API_KEY || '',
    listingPath: process.env.CMC_LISTING_PATH || '/public-api/v1/cryptocurrency/listings/latest',
    globalPath: process.env.CMC_GLOBAL_PATH || '/public-api/v1/global-metrics/quotes/latest',
    fearGreedPath: process.env.CMC_FEAR_GREED_PATH || '/public-api/v1/fear-and-greed/latest',
    timeout: 10000,
  },
  cache: {
    listing: 30 * 1000,
    global: 60 * 1000,
    fearGreed: 120 * 1000,
  },
};
