(function () {
  'use strict';

  const API_BASE = 'https://coinmarketcapweb.onrender.com/api';
  const PAGE_START = 201;
  const PAGE_LIMIT = 100;
  const REFRESH_INTERVAL = 30000;

  // ---------- 格式化 ----------
  function formatPrice(price) {
    if (price == null || isNaN(price)) return '--';
    if (price >= 1) return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 0.01) return '$' + price.toFixed(4);
    if (price >= 0.0001) return '$' + price.toFixed(6);
    return '$' + price.toFixed(8);
  }
  function formatCompact(num) {
    if (num == null || isNaN(num)) return '--';
    const abs = Math.abs(num);
    if (abs >= 1e12) return '$' + (num / 1e12).toFixed(2) + 'T';
    if (abs >= 1e9) return '$' + (num / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return '$' + (num / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return '$' + (num / 1e3).toFixed(2) + 'K';
    return '$' + num.toFixed(2);
  }
  function formatSupply(num) {
    if (num == null || isNaN(num)) return '--';
    const abs = Math.abs(num);
    if (abs >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (abs >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return String(num);
  }
  function formatPercent(pct) {
    if (pct == null || isNaN(pct)) return '--';
    return Math.abs(pct).toFixed(2) + '%';
  }

  // ---------- 解析 __NEXT_DATA__ ----------
  function parseInitialData() {
    const el = document.getElementById('__NEXT_DATA__');
    if (!el) return null;
    try {
      const json = JSON.parse(el.textContent);
      const queries = json?.props?.pageProps?.dehydratedState?.queries || [];
      const q = queries.find(
        (x) => Array.isArray(x?.queryKey) && x.queryKey[0] === 'homepage-data'
      );
      const list = q?.state?.data?.data?.listing?.cryptoCurrencyList;
      if (!Array.isArray(list)) return null;
      return list.map((item) => {
        const usd = item.quotes?.find((x) => x.name === 'USD') || item.quotes?.[0] || {};
        return {
          id: item.id,
          rank: item.cmcRank,
          name: item.name,
          symbol: item.symbol,
          slug: item.slug,
          price: usd.price ?? 0,
          percentChange1h: usd.percentChange1h ?? 0,
          percentChange24h: usd.percentChange24h ?? 0,
          percentChange7d: usd.percentChange7d ?? 0,
          marketCap: usd.marketCap ?? 0,
          volume24h: usd.volume24h ?? 0,
          circulatingSupply: item.circulatingSupply ?? 0,
          maxSupply: item.maxSupply ?? null,
        };
      });
    } catch (e) {
      console.warn('[inject] parse __NEXT_DATA__ failed', e);
      return null;
    }
  }

  // ---------- DOM 绑定 ----------
  function getDataRows() {
    return Array.from(document.querySelectorAll('tbody tr[style*="cursor:pointer"]'));
  }

  function extractCells(tr) {
    const tds = tr.querySelectorAll('td');
    return {
      priceCell: tds[3],
      pct1hCell: tds[4],
      pct24hCell: tds[5],
      pct7dCell: tds[6],
      marketCapCell: tds[7],
      volumeCell: tds[8],
      supplyCell: tds[9],
    };
  }

  let rowBindings = [];

  function bindRows(data) {
    const rows = getDataRows();
    rowBindings = rows.slice(0, data.length).map((tr, idx) => {
      const item = data[idx];
      tr.setAttribute('data-coin-id', String(item.id));
      return { tr, cells: extractCells(tr), coinId: item.id };
    });
  }

  // ---------- 单元格更新 ----------
  function updatePriceCell(cell, price) {
    if (!cell) return;
    const container = cell.querySelector('[class*="Price__PriceTransition"]');
    if (container) container.textContent = formatPrice(price);
    else cell.textContent = formatPrice(price);
  }

  function updatePercentCell(cell, pct) {
    if (!cell) return;
    const wrapper = cell.querySelector('span[class*="PercentageView"]');
    if (!wrapper) return;
    const textNodes = Array.from(wrapper.childNodes).filter((n) => n.nodeType === 3);
    if (textNodes.length > 0) textNodes[0].textContent = formatPercent(pct);
    wrapper.style.color = pct >= 0 ? '#16C784' : '#EA3943';
  }

  function updateMoneyCell(cell, text) {
    if (!cell) return;
    const spans = cell.querySelectorAll('span');
    for (let i = spans.length - 1; i >= 0; i--) {
      if (spans[i].children.length === 0) {
        spans[i].textContent = text;
        return;
      }
    }
    cell.textContent = text;
  }

  function updateSupplyCell(cell, supply) {
    if (!cell) return;
    const valueEl = cell.querySelector('.circulating-supply-value span');
    if (valueEl) valueEl.textContent = formatSupply(supply);
  }

  function updateRow(tr, data) {
    const cells = extractCells(tr);
    if (!cells.priceCell) return;
    updatePriceCell(cells.priceCell, data.price);
    updatePercentCell(cells.pct1hCell, data.percentChange1h);
    updatePercentCell(cells.pct24hCell, data.percentChange24h);
    updatePercentCell(cells.pct7dCell, data.percentChange7d);
    updateMoneyCell(cells.marketCapCell, formatCompact(data.marketCap));
    updateMoneyCell(cells.volumeCell, formatCompact(data.volume24h));
    updateSupplyCell(cells.supplyCell, data.circulatingSupply);
  }

  function applyData(data) {
    if (!Array.isArray(data) || !data.length) return;
    const byId = new Map(data.map((d) => [d.id, d]));
    for (const b of rowBindings) {
      const item = byId.get(b.coinId);
      if (item) updateRow(b.tr, item);
    }
  }

  // ---------- 拉取 ----------
  async function fetchListing() {
    try {
      const res = await fetch(`${API_BASE}/listing?start=${PAGE_START}&limit=${PAGE_LIMIT}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (Array.isArray(json.data)) applyData(json.data);
    } catch (e) {
      console.warn('[inject] fetch listing failed:', e.message);
    }
  }

  // ---------- 启动 ----------
  function start() {
    const initial = parseInitialData();
    if (initial && initial.length) {
      bindRows(initial);
      applyData(initial); // 用源码数据先“点亮”一次，保证格式统一
    }
    fetchListing();
    setInterval(fetchListing, REFRESH_INTERVAL);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
