(function () {
  'use strict';

  const API_BASE = 'https://coinmarketcapweb.onrender.com/api';
  let allCoins = [];
  let currentPage = 3; 
  const PAGE_SIZE = 100;

  // 格式化函数
  function formatPrice(p) {
    if (p == null || isNaN(p)) return '--';
    if (p >= 1) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (p >= 0.01) return '$' + p.toFixed(4);
    if (p >= 0.0001) return '$' + p.toFixed(6);
    return '$' + p.toFixed(8);
  }
  function formatCompact(n) {
    if (n == null || isNaN(n)) return '--';
    const a = Math.abs(n);
    if (a >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (a >= 1e3) return '$' + (n / 1e3).toFixed(2) + 'K';
    return '$' + n.toFixed(2);
  }
  function formatSupply(n) {
    if (n == null || isNaN(n)) return '--';
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

  // 渲染表格
  function renderTable() {
    const tbody = document.getElementById('crypto-tbody');
    const pageInfo = document.getElementById('page-info');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    const totalPages = Math.ceil(allCoins.length / PAGE_SIZE);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageData = allCoins.slice(start, start + PAGE_SIZE);

    let html = '';
    pageData.forEach(coin => {
      const p1 = coin.percentChange1h || 0;
      const p24 = coin.percentChange24h || 0;
      const p7 = coin.percentChange7d || 0;
      
      const c1 = p1 >= 0 ? 'text-up' : 'text-down';
      const c24 = p24 >= 0 ? 'text-up' : 'text-down';
      const c7 = p7 >= 0 ? 'text-up' : 'text-down';
      const a1 = p1 >= 0 ? '▲' : '▼';
      const a24 = p24 >= 0 ? '▲' : '▼';
      const a7 = p7 >= 0 ? '▲' : '▼';

      html += `
        <tr>
          <td>${coin.rank}</td>
          <td>
            <div class="coin-info" onclick="alert('【币种详情】\\n名称: ${coin.name}\\n符号: ${coin.symbol}\\n价格: ${formatPrice(coin.price)}\\n市值: ${formatCompact(coin.marketCap)}')">
              <img src="https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png" onerror="this.src='https://s2.coinmarketcap.com/static/cloud/img/coinmarketcap_1.svg'"/>
              <span class="coin-name">${coin.name}</span>
              <span class="coin-symbol">${coin.symbol}</span>
            </div>
          </td>
          <td>${formatPrice(coin.price)}</td>
          <td class="${c1}">${a1} ${formatPercent(p1)}</td>
          <td class="${c24}">${a24} ${formatPercent(p24)}</td>
          <td class="${c7}">${a7} ${formatPercent(p7)}</td>
          <td>${formatCompact(coin.marketCap)}</td>
          <td>${formatCompact(coin.volume24h)}</td>
          <td>${formatSupply(coin.circulatingSupply)} ${coin.symbol}</td>
          <td><img src="https://s3.coinmarketcap.com/generated/sparklines/web/7d/2781/${coin.id}.svg" class="sparkline" onerror="this.style.display='none'"/></td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    btnPrev.disabled = currentPage === 1;
    btnNext.disabled = currentPage >= totalPages;
  }

  // 初始化并填充 Trending Coins 卡片
  async function init() {
    try {
      const res = await fetch(`${API_BASE}/listing/all`);
      const json = await res.json();
      
      if (Array.isArray(json.data) && json.data.length > 0) {
        allCoins = json.data.sort((a, b) => (a.rank || 9999999) - (b.rank || 9999999));
        
        // 填第一页，满足用户看到的默认状态
        const urlParams = new URLSearchParams(window.location.search);
        const pageParam = parseInt(urlParams.get('page'), 10);
        if (pageParam && pageParam > 0) currentPage = pageParam;

        renderTable();

        // 填充 Trending Coins 卡片数据（取前 5 个作为示例）
        const trendingContainer = document.getElementById('trending-coins');
        let trendingHtml = '';
        allCoins.slice(0, 5).forEach((coin, idx) => {
          const pct = coin.percentChange24h >= 0 ? 'text-up' : 'text-down';
          const arrow = coin.percentChange24h >= 0 ? '▲' : '▼';
          trendingHtml += `
            <div class="stat-row">
              <div style="display: flex; gap: 8px; align-items: center;">
                <span style="color: var(--text-secondary); font-size: 12px;">${idx + 1}</span>
                <img src="https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png" style="width: 20px; height: 20px; border-radius: 50%;"/>
                <span>${coin.symbol}</span>
              </div>
              <div>
                <span>${formatPrice(coin.price)}</span>
                <span class="${pct}" style="margin-left: 8px; font-size: 12px;">${arrow} ${formatPercent(coin.percentChange24h)}</span>
              </div>
            </div>
          `;
        });
        trendingContainer.innerHTML = trendingHtml;

        // 绑定翻页
        document.getElementById('btn-prev').addEventListener('click', () => {
          if (currentPage > 1) { currentPage--; renderTable(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        });
        document.getElementById('btn-next').addEventListener('click', () => {
          const total = Math.ceil(allCoins.length / PAGE_SIZE);
          if (currentPage < total) { currentPage++; renderTable(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        });
      }
    } catch (e) {
      console.error('Data load failed:', e);
    }
  }

  init();
})();
