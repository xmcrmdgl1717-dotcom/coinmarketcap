const TIMEOUT = 10000;

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// CoinLore 一次返回全量，我们在内存里做分页
let cachedAll = null;
let cachedAt = 0;
const CACHE_MS = 60 * 1000;

async function loadAll() {
  if (cachedAll && Date.now() - cachedAt < CACHE_MS) return cachedAll;
  const res = await fetchWithTimeout('https://api.coinlore.net/api/tickers/');
  if (!res.ok) throw new Error(`CoinLore ${res.status}`);
  const json = await res.json();
  const list = Array.isArray(json.data) ? json.data : [];
  cachedAll = list.map((item) => ({
    id: Number(item.id),
    rank: Number(item.rank),
    name: item.name,
    symbol: item.symbol,
    slug: item.nameid,
    price: parseFloat(item.price_usd) || 0,
    percentChange1h: parseFloat(item.percent_change_1h) || 0,
    percentChange24h: parseFloat(item.percent_change_24h) || 0,
    percentChange7d: parseFloat(item.percent_change_7d) || 0,
    marketCap: parseFloat(item.market_cap_usd) || 0,
    volume24h: parseFloat(item.volume24) || 0,
    circulatingSupply: parseFloat(item.csupply) || 0,
    maxSupply: item.msupply ? parseFloat(item.msupply) : null,
  }));
  cachedAt = Date.now();
  return cachedAll;
}

async function fetchListing({ start, limit }) {
  const all = await loadAll();
  const from = Math.max(0, start - 1);
  return {
    data: all.slice(from, from + limit),
    totalCount: all.length,
    source: 'coinlore',
  };
}

module.exports = { fetchListing };
