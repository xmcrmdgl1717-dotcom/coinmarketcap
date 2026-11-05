(function () {
  'use strict';

  // 你的 Render 后端地址
  const API_BASE = 'https://coinmarketcapweb.onrender.com/api';
  
  let allCoins = [];
  let currentPage = 3; // 默认展示第 3 页
  const PAGE_SIZE = 100;

  // ==========================================
  // 1. 格式化数据
  // ==========================================
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

  // ==========================================
  // 2. 渲染纯净表格
  // ==========================================
  function renderTable() {
    const tbody = document.getElementById('crypto-tbody');
    const pageInfo = document.getElementById('page-info');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    const totalPages = Math.ceil(allCoins.length / PAGE_SIZE);
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const pageData = allCoins.slice(startIdx, startIdx + PAGE_SIZE);

    let html = '';
    pageData.forEach(coin => {
      const p1h = coin.percentChange1h || 0;
      const p24h = coin.percentChange24h || 0;
      const p7d = coin.percentChange7d || 0;
      
      const c1h = p1h >= 0 ? 'up' : 'down';
      const c24h = p24h >= 0 ? 'up' : 'down';
      const c7d = p7d >= 0 ? 'up' : 'down';

      const a1h = p1h >= 0 ? '▲' : '▼';
      const a24h = p24h >= 0 ? '▲' : '▼';
      const a7d = p7d >= 0 ? '▲' : '▼';

      html += `
        <tr>
          <td>${coin.rank}</td>
          <td>
            <div class="coin-info" onclick="alert('【币种详情】\\n名称: ${coin.name}\\n符号: ${coin.symbol}\\n价格: ${formatPrice(coin.price)}\\n市值: ${formatCompact(coin.marketCap)}')">
              <img src="https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png" onerror="this.src='https://s2.coinmarketcap.com/static/cloud/img/coinmarketcap_1.svg'"/>
              <span>${coin.name}</span>
              <span class="coin-symbol">${coin.symbol}</span>
            </div>
          </td>
          <td>${formatPrice(coin.price)}</td>
          <td class="${c1h}">${a1h} ${formatPercent(p1h)}</td>
          <td class="${c24h}">${a24h} ${formatPercent(p24h)}</td>
          <td class="${c7d}">${a7d} ${formatPercent(p7d)}</td>
          <td>${formatCompact(coin.marketCap)}</td>
          <td>${formatCompact(coin.volume24h)}</td>
          <td>${formatSupply(coin.circulatingSupply)} ${coin.symbol}</td>
          <td>
            <img src="https://s3.coinmarketcap.com/generated/sparklines/web/7d/2781/${coin.id}.svg" class="sparkline" onerror="this.style.display='none'"/>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    btnPrev.disabled = currentPage === 1;
    btnNext.disabled = currentPage >= totalPages;
  }

  // ==========================================
  // 3. 初始化加载数据
  // ==========================================
  async function init() {
    try {
      const res = await fetch(`${API_BASE}/listing/all`);
      const json = await res.json();
      
      if (Array.isArray(json.data) && json.data.length > 0) {
        // 强制按排名升序
        allCoins = json.data.sort((a, b) => (a.rank || 9999999) - (b.rank || 9999999));
        
        // 解析 URL 页码
        const urlParams = new URLSearchParams(window.location.search);
        const pageParam = parseInt(urlParams.get('page'), 10);
        if (pageParam && pageParam > 0) {
          currentPage = pageParam;
        }

        renderTable();

        // 绑定翻页按钮
        document.getElementById('btn-prev').addEventListener('click', () => {
          if (currentPage > 1) {
            currentPage--;
            renderTable();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        });

        document.getElementById('btn-next').addEventListener('click', () => {
          const totalPages = Math.ceil(allCoins.length / PAGE_SIZE);
          if (currentPage < totalPages) {
            currentPage++;
            renderTable();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        });
      } else {
        document.getElementById('crypto-tbody').innerHTML = '<tr><td colspan="10" style="text-align:center;">No data available.</td></tr>';
      }
    } catch (e) {
      console.error('Data load failed:', e);
      document.getElementById('crypto-tbody').innerHTML = '<tr><td colspan="10" style="text-align:center;color:red;">Failed to load data. Please check your API.</td></tr>';
    }
  }

  // 页面加载后立即执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
