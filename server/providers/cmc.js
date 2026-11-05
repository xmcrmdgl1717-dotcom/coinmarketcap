const config = require('../config');

async function fetchWithTimeout(url, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.cmc.timeout);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function authHeaders() {
  const headers = { Accept: 'application/json' };
  if (config.cmc.apiKey) headers['X-CMC_PRO_API_KEY'] = config.cmc.apiKey;
  return headers;
}

function normalize(item) {
  const usd = (item.quote && item.quote.USD) || {};
  return {
    id: item.id,
    rank: item.cmc_rank,
    name: item.name,
    symbol: item.symbol,
    slug: item.slug,
    price: usd.price ?? 0,
    percentChange1h: usd.percent_change_1h ?? 0,
    percentChange24h: usd.percent_change_24h ?? 0,
    percentChange7d: usd.percent_change_7d ?? 0,
    marketCap: usd.market_cap ?? 0,
    volume24h: usd.volume_24h ?? 0,
    circulatingSupply: item.circulating_supply ?? 0,
    maxSupply: item.max_supply ?? null,
  };
}

async function fetchListing({ start, limit }) {
  const url = new URL(config.cmc.baseUrl + config.cmc.listingPath);
  url.searchParams.set('start', String(start));
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('convert', 'USD');

  const res = await fetchWithTimeout(url, authHeaders());
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`CMC listing ${res.status}: ${text.slice(0, 160)}`);
  }
  const json = await res.json();
  const items = Array.isArray(json.data) ? json.data : [];
  return {
    data: items.map(normalize),
    totalCount: json.status?.total_count ?? items.length,
    source: 'cmc',
  };
}

async function fetchGlobal() {
  const url = new URL(config.cmc.baseUrl + config.cmc.globalPath);
  const res = await fetchWithTimeout(url, authHeaders());
  if (!res.ok) throw new Error(`CMC global ${res.status}`);
  const json = await res.json();
  const usd = json.data?.quote?.USD || {};
  return {
    totalMarketCap: usd.total_market_cap ?? 0,
    totalVolume24h: usd.total_volume_24h ?? 0,
    marketCapChange24h: usd.total_market_cap_yesterday_percentage_change ?? 0,
    btcDominance: json.data?.btc_dominance ?? 0,
    ethDominance: json.data?.eth_dominance ?? 0,
    activeCryptocurrencies: json.data?.active_cryptocurrencies ?? 0,
    source: 'cmc',
  };
}

async function fetchFearGreed() {
  const url = new URL(config.cmc.baseUrl + config.cmc.fearGreedPath);
  const res = await fetchWithTimeout(url, authHeaders());
  if (!res.ok) throw new Error(`CMC fear-greed ${res.status}`);
  const json = await res.json();
  return {
    value: json.data?.value ?? 0,
    classification: json.data?.value_classification ?? 'Neutral',
    updateTime: json.data?.update_time ?? null,
    source: 'cmc',
  };
}

module.exports = { fetchListing, fetchGlobal, fetchFearGreed };
