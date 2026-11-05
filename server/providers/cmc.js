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

// 1. 行情列表（直接调用 Web 端内部接口）
async function fetchListing({ start, limit }) {
  try {
    const url = new URL('https://api.coinmarketcap.com/data-api/v3/cryptocurrency/listing');
    url.searchParams.set('start', String(start));
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('convert', 'USD');

    const res = await fetchWithTimeout(url, { Accept: 'application/json' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    
    // 解析 Web 端的数据结构
    const list = json.data?.cryptoCurrencyList || [];
    return {
      data: list.map(item => {
        const usd = item.quotes?.find(q => q.name === 'USD') || {};
        return {
          id: item.id,
          rank: item.cmcRank,
          name: item.name,
          symbol: item.symbol,
          price: usd.price ?? 0,
          percentChange1h: usd.percentChange1h ?? 0,
          percentChange24h: usd.percentChange24h ?? 0,
          percentChange7d: usd.percentChange7d ?? 0,
          marketCap: usd.marketCap ?? 0,
          volume24h: usd.volume24h ?? 0,
          circulatingSupply: item.circulatingSupply ?? 0,
        };
      }),
      totalCount: json.data?.totalCount ?? 0,
    };
  } catch (err) {
    console.error('[CMC] fetchListing failed:', err.message);
    return { data: [], totalCount: 0 };
  }
}

// 2. 全球指标
async function fetchGlobal() {
  try {
    const url = new URL('https://api.coinmarketcap.com/data-api/v3/global-metrics/quotes/latest');
    const res = await fetchWithTimeout(url, { Accept: 'application/json' });
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
    const url = new URL('https://api.coinmarketcap.com/data-api/v3/fear-and-greed/latest');
    const res = await fetchWithTimeout(url, { Accept: 'application/json' });
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

// 4. 衍生品与爆仓 (如果该接口在 Web 端不可用，这里会返回 0，但不会报错崩溃)
async function fetchDerivatives() {
  try {
    const url = new URL('https://api.coinmarketcap.com/data-api/v3/derivatives/liquidations/quotes/latest');
    url.searchParams.set('convert', 'USD');
    const res = await fetchWithTimeout(url, { Accept: 'application/json' });
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

async function fetchTrending() {
  const result = await fetchListing({ start: 1, limit: 5 });
  return result.data;
}

module.exports = { fetchListing, fetchGlobal, fetchFearGreed, fetchDerivatives, fetchTrending };
