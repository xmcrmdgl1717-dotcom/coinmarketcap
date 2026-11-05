(function () {
  'use strict';

  const API_BASE = 'https://coinmarketcapweb.onrender.com/api';
  let currentPage = 1;
  const PAGE_SIZE = 100;

  // --- 格式化函数 ---
  function formatPrice(p) {
    if (p == null || isNaN(p) || p === 0) return '--';
    if (p >= 1) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (p >= 0.01) return '$' + p.toFixed(4);
    if (p >= 0.0001) return '$' + p.toFixed(6);
    return '$' + p.toFixed(8);
  }
  function formatCompact(n) {
    if (n == null || isNaN(n) || n === 0) return '--';
    const a = Math.abs(n);
    if (a >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (a >= 1e3) return '$' + (n / 1e3).toFixed(2) + 'K';
    return '$' + n.toFixed(2);
  }
  function formatSupply(n) {
    if (n == null || isNaN(n) || n === 0) return '--';
    const a = Math.abs(n);
    if (a >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (a >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return String(n);
  }
  function formatPercent(p) {
    if (p == null || isNaN(p)) return '--';
    return Math.abs(p).toFixed(2) + '%';
  }

  // --- 渲染顶部卡片 ---
  async function renderTopCards() {
    try {
      const [globalRes, trendingRes, derivativesRes] = await Promise.all([
        fetch(`${API_BASE}/global`),
        fetch(`${API_BASE}/trending`),
        fetch(`${API_BASE}/derivatives`),
      ]);

      const global = globalRes.ok ? await globalRes.json() : {};
      const trending = trendingRes.ok ? await trendingRes.json() : {};
      const derivatives = derivativesRes.ok ? await derivativesRes.json() : {};

      // 1. Market Status 渲染
      const fg = global.fearGreed || {};
      document.getElementById('fg-value').textContent = fg.value ?? '--';
      document.getElementById('fg-label').textContent = fg.classification ?? 'Neutral';
      
      const mcapStr = formatCompact(global.totalMarketCap);
      const mcapChange = global.marketCapChange24h || 0;
      const mcapColor = mcapChange >= 0 ? 'text-up' : 'text-down';
      const mcapArrow = mcapChange >= 0 ? '▲' : '▼';
      document.getElementById('global-mcap').innerHTML = `${mcapStr} <span class="${mcapColor}">${mcapArrow} ${formatPercent(mcapChange)}</span>`;

      // 2. Trending Coins 渲染
      const trendList = trending.data || [];
      let trendHtml = '';
      trendList.slice(0, 5).forEach((coin, i) => {
        const pct = coin.percentChange24h || 0;
        const cls = pct >= 0 ? 'text-up' : 'text-down';
        trendHtml += `
          <div class="trend-row">
            <div class="trend-left">
              <span style="color:var(--text-secondary); width:12px;">${i + 1}</span>
              <img src="https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png" onerror="this.style.display='none'"/>
              <span>${coin.symbol}</span>
            </div>
            <div>
              <span style="font-weight:600;">${formatPrice(coin.price)}</span>
              <span class="${cls}" style="margin-left:8px;font-size:12px;">${pct >= 0 ? '▲' : '▼'} ${formatPercent(pct)}</span>
            </div>
          </div>
        `;
      });
      document.getElementById('trending-list').innerHTML = trendHtml || '<div style="color:var(--text-secondary); text-align:center; padding:20px;">暂无数据</div>';

      // 3. Derivatives 渲染
      const derHtml = `
        <div class="stat-row"><span class="stat-label">All Liquidations (24h)</span><span class="stat-value">${formatCompact(derivatives.totalLiquidations)}</span></div>
        <div class="stat-row"><span class="stat-label">Long</span><span class="stat-value text-up">${formatCompact(derivatives.longLiquidations)}</span></div>
        <div class="stat-row"><span class="stat-label">Short</span><span class="stat-value text-down">${formatCompact(derivatives.shortLiquidations)}</span></div>
        
        <div class="mini-chart">
           <div class="bar" style="height:80%; background:#ea3943;"></div>
           <div class="bar" style="height:30%; background:#16c784;"></div>
           <div class="bar" style="height:50%; background:#ea3943;"></div>
           <div class="bar" style="height:90%; background:#16c784;"></div>
           <div class="bar" style="height:20%; background:#ea3943;"></div>
           <div class="bar" style="height:40%; background:#16c784;"></div>
           <div class="bar" style="height:60%; background:#ea3943;"></div>
           <div class="bar" style="height:70%; background:#16c784;"></div>
        </div>

        <div class="ms-bottom">
            <div class="inner-card">
                <div class="stat-row"><span class="stat-label">Open Interest</span><span class="stat-value">${formatCompact(derivatives.openInterest)}</span></div>
            </div>
            <div class="inner-card">
                <div class="stat-row"><span class="stat-label">Volume (24h)</span><span class="stat-value">${formatCompact(derivatives.volume24h)}</span></div>
            </div>
        </div>
      `;
      document.getElementById('derivatives-content').innerHTML = derHtml;

    } catch (e) {
      console.warn('[topCards] 数据加载失败:', e);
    }
  }

  // --- 渲染底部表格 ---
  function renderTable(coins) {
    const tbody = document.getElementById('crypto-tbody');
    if (!tbody) return;
    const pageInfo = document.getElementById('page-info');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    if (!coins || coins.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:50px;">当前页没有数据或接口请求失败。</td></tr>';
      return;
    }

    let html = '';
    coins.forEach(coin => {
      const rank = coin.rank || coin.cmcRank || '-';
      const name = coin.name || 'Unknown';
      const symbol = coin.symbol || '?';
      const id = coin.id || 0;
      const price = coin.price || 0;
      const p1 = coin.percentChange1h || 0;
      const p24 = coin.percentChange24h || 0;
      const p7 = coin.percentChange7d || 0;
      const mcap = coin.marketCap || 0;
      const vol = coin.volume24h || 0;
      const supply = coin.circulatingSupply || 0;

      const c1 = p1 >= 0 ? 'text-up' : 'text-down';
      const c24 = p24 >= 0 ? 'text-up' : 'text-down';
      const c7 = p7 >= 0 ? 'text-up' : 'text-down';
      const a1 = p1 >= 0 ? '▲' : '▼';
      const a24 = p24 >= 0 ? '▲' : '▼';
      const a7 = p7 >= 0 ? '▲' : '▼';

      html += `
        <tr>
          <td>${rank}</td>
          <td>
            <div class="coin-info" onclick="alert('【币种详情】\\n名称: ${name}\\n符号: ${symbol}\\n价格: ${formatPrice(price)}\\n市值: ${formatCompact(mcap)}')">
              <img src="https://s2.coinmarketcap.com/static/img/coins/64x64/${id}.png" onerror="this.src='https://s2.coinmarketcap.com/static/cloud/img/coinmarketcap_1.svg'"/>
              <span class="coin-name">${name}</span>
              <span class="coin-symbol">${symbol}</span>
            </div>
          </td>
          <td>${formatPrice(price)}</td>
          <td class="${c1}">${a1} ${formatPercent(p1)}</td>
          <td class="${c24}">${a24} ${formatPercent(p24)}</td>
          <td class="${c7}">${a7} ${formatPercent(p7)}</td>
          <td>${formatCompact(mcap)}</td>
          <td>${formatCompact(vol)}</td>
          <td>${formatSupply(supply)} ${symbol}</td>
          <td><img src="https://s3.coinmarketcap.com/generated/sparklines/web/7d/2781/${id}.svg" class="sparkline" onerror="this.style.display='none'"/></td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    if (pageInfo) pageInfo.textContent = `Page ${currentPage}`;
    if (btnPrev) btnPrev.disabled = currentPage === 1;
    if (btnNext) btnNext.disabled = coins.length < PAGE_SIZE;
  }

  async function loadPageData(page) {
    const tbody = document.getElementById('crypto-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:50px;color:#616e85;">正在加载第 ${page} 页数据...</td></tr>`;

    try {
      const start = (page - 1) * PAGE_SIZE + 1;
      const res = await fetch(`${API_BASE}/listing?start=${start}&limit=${PAGE_SIZE}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      renderTable(json.data);
    } catch (e) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:50px;color:#ea3943;">加载失败: ${e.message}</td></tr>`;
    }
  }

  async function init() {
    renderTopCards();
    loadPageData(currentPage);

    document.getElementById('btn-prev')?.addEventListener('click', () => {
      if (currentPage > 1) { currentPage--; loadPageData(currentPage); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });
    document.getElementById('btn-next')?.addEventListener('click', () => {
      currentPage++; loadPageData(currentPage); window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
