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
    rank: item.cmc_rank || item.cmcRank,
    name: item.name,
    symbol: item.symbol,
    slug: item.slug,
    price: usd.price ?? item.price ?? 0,
    percentChange1h: usd.percent_change_1h ?? item.percentChange1h ?? 0,
    percentChange24h: usd.percent_change_24h ?? item.percentChange24h ?? 0,
    percentChange7d: usd.percent_change_7d ?? item.percentChange7d ?? 0,
    marketCap: usd.market_cap ?? item.marketCap ?? 0,
    volume24h: usd.volume_24h ?? item.volume24h ?? 0,
    circulatingSupply: item.circulating_supply ?? item.circulatingSupply ?? 0,
    maxSupply: item.max_supply ?? item.maxSupply ?? null,
  };
}

// 1. 行情列表
async function fetchListing({ start, limit }) {
  const url = new URL(config.cmc.baseUrl + config.cmc.listingPath);
  url.searchParams.set('start', String(start));
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('convert', 'USD');

  const res = await fetchWithTimeout(url, authHeaders());
  if (!res.ok) throw new Error(`CMC listing ${res.status}`);
  const json = await res.json();
  const items = Array.isArray(json.data) ? json.data : [];
  return {
    data: items.map(normalize),
    totalCount: json.status?.total_count ?? items.length,
  };
}

// 2. 全球指标
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
  };
}

// 3. 恐慌贪婪指数
async function fetchFearGreed() {
  const url = new URL(config.cmc.baseUrl + config.cmc.fearGreedPath);
  const res = await fetchWithTimeout(url, authHeaders());
  if (!res.ok) throw new Error(`CMC fear-greed ${res.status}`);
  const json = await res.json();
  return {
    value: json.data?.value ?? 0,
    classification: json.data?.value_classification ?? 'Neutral',
  };
}

// 4. 衍生品与爆仓
async function fetchDerivatives() {
  // 注意：此处使用的是 CMC 公开的衍生品接口路径
  const url = new URL(config.cmc.baseUrl + '/v5/derivatives/liquidations/quotes/latest');
  url.searchParams.set('convert', 'USD');
  const res = await fetchWithTimeout(url, authHeaders());
  if (!res.ok) throw new Error(`CMC derivatives ${res.status}`);
  const json = await res.json();
  const data = json.data || {};
  return {
    totalLiquidations: data.total_liquidations_24h || 0,
    longLiquidations: data.long_liquidations_24h || 0,
    shortLiquidations: data.short_liquidations_24h || 0,
    openInterest: data.total_open_interest || 0,
    volume24h: data.total_volume_24h || 0,
  };
}

// 5. 社区热帖
async function fetchCommunityPosts(limit = 2) {
  // 注意：此处使用的是 CMC 公开的社区接口路径
  const url = new URL(config.cmc.baseUrl + '/v1/content/posts/latest');
  url.searchParams.set('limit', String(limit));
  const res = await fetchWithTimeout(url, authHeaders());
  if (!res.ok) throw new Error(`CMC community ${res.status}`);
  const json = await res.json();
  return {
    posts: (json.data?.list || []).map(p => ({
      author: p.owner?.nickname || 'Anonymous',
      avatar: p.owner?.avatar?.url || '',
      content: p.text_content || '',
      sentiment: p.sentiment === '2.0' || p.sentiment > 0 ? 'Bullish' : p.sentiment === '-6.0' || p.sentiment < 0 ? 'Bearish' : 'Neutral',
      time: p.post_time || '',
    })),
  };
}

module.exports = { 
  fetchListing, 
  fetchGlobal, 
  fetchFearGreed, 
  fetchDerivatives, 
  fetchCommunityPosts 
};
