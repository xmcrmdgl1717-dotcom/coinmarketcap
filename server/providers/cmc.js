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

// 1. 行情列表
async function fetchListing({ start, limit }) {
  try {
    const url = new URL(config.cmc.baseUrl + '/v1/cryptocurrency/listings/latest');
    url.searchParams.set('start', String(start));
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('convert', 'USD');

    const res = await fetchWithTimeout(url, authHeaders());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    
    return {
      data: (json.data || []).map(item => ({
        id: item.id, rank: item.cmc_rank, name: item.name, symbol: item.symbol,
        price: item.quote?.USD?.price ?? 0,
        percentChange1h: item.quote?.USD?.percent_change_1h ?? 0,
        percentChange24h: item.quote?.USD?.percent_change_24h ?? 0,
        percentChange7d: item.quote?.USD?.percent_change_7d ?? 0,
        marketCap: item.quote?.USD?.market_cap ?? 0,
        volume24h: item.quote?.USD?.volume_24h ?? 0,
        circulatingSupply: item.circulating_supply ?? 0,
      })),
      totalCount: json.status?.total_count ?? 0,
    };
  } catch (err) {
    console.error('[CMC] fetchListing failed:', err.message);
    // 崩溃保护：返回空数据，防止前端 502
    return { data: [], totalCount: 0 };
  }
}

// 2. 全球指标
async function fetchGlobal() {
  try {
    const url = new URL(config.cmc.baseUrl + '/v1/global-metrics/quotes/latest');
    url.searchParams.set('convert', 'USD');
    const res = await fetchWithTimeout(url, authHeaders());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const usd = json.data?.quote?.USD || {};
    return {
      totalMarketCap: usd.total_market_cap ?? 0,
      marketCapChange24h: usd.total_market_cap_yesterday_percentage_change ?? 0,
    };
  } catch (err) {
    console.error('[CMC] fetchGlobal failed:', err.message);
    return { totalMarketCap: 0, marketCapChange24h: 0 };
  }
}

// 3. 恐慌贪婪指数
async function fetchFearGreed() {
  try {
    const url = new URL(config.cmc.baseUrl + '/v3/fear-and-greed/latest');
    const res = await fetchWithTimeout(url, authHeaders());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return {
      value: json.data?.value ?? 50,
      classification: json.data?.value_classification ?? 'Neutral',
    };
  } catch (err) {
    console.error('[CMC] fetchFearGreed failed:', err.message);
    return { value: 50, classification: 'Neutral' };
  }
}

// 4. 衍生品与爆仓
async function fetchDerivatives() {
  try {
    const url = new URL(config.cmc.baseUrl + '/v5/derivatives/liquidations/quotes/latest');
    url.searchParams.set('convert', 'USD');
    const res = await fetchWithTimeout(url, authHeaders());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const data = json.data || {};
    return {
      totalLiquidations: data.total_liquidations_24h || 0,
      longLiquidations: data.long_liquidations_24h || 0,
      shortLiquidations: data.short_liquidations_24h || 0,
      openInterest: data.total_open_interest || 0,
      volume24h: data.total_volume_24h || 0,
    };
  } catch (err) {
    console.error('[CMC] fetchDerivatives failed:', err.message);
    return { totalLiquidations: 0, longLiquidations: 0, shortLiquidations: 0, openInterest: 0, volume24h: 0 };
  }
}

// 5. 趋势币种
async function fetchTrending() {
  const result = await fetchListing({ start: 1, limit: 5 });
  return result.data;
}

module.exports = { fetchListing, fetchGlobal, fetchFearGreed, fetchDerivatives, fetchTrending };
