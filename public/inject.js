(function () {
  'use strict';

  const API_BASE = 'https://coinmarketcapweb.onrender.com/api';
  
  let allCoins = [];
  let currentPage = 3; 
  const PAGE_SIZE = 100;

  // ==========================================
  // 0. 注入我们自己手写的纯净版 CSS
  // ==========================================
  function injectCustomCSS() {
    const style = document.createElement('style');
    style.innerHTML = `
      /* 全局重置 */
      body {
        margin: 0;
        padding: 0;
        background-color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #0d1421;
      }
      #custom-app {
        width: 100%;
        max-width: 1400px;
        margin: 0 auto;
        padding: 20px 16px;
      }
      .page-title {
        font-size: 24px;
        font-weight: 700;
        margin-bottom: 20px;
        color: #0d1421;
      }

      /* 表格样式 */
      .crypto-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
        text-align: right;
      }
      .crypto-table th, .crypto-table td {
        padding: 12px 10px;
        border-bottom: 1px solid #eff2f5;
        white-space: nowrap;
      }
      .crypto-table th {
        font-size: 12px;
        font-weight: 500;
        color: #616e85;
        cursor: pointer;
        text-align: right;
      }
      .crypto-table th:nth-child(1), .crypto-table td:nth-child(1),
      .crypto-table th:nth-child(2), .crypto-table td:nth-child(2),
      .crypto-table th:nth-child(3), .crypto-table td:nth-child(3) {
        text-align: left;
      }
      .crypto-table tbody tr:hover {
        background-color: #f8fafd;
      }

      /* 币种名称区域 */
      .coin-name-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }
      .coin-logo {
        width: 24px;
        height: 24px;
        border-radius: 50%;
      }
      .coin-symbol {
        color: #a6b0c3;
        font-size: 12px;
        margin-left: 4px;
      }

      /* 涨跌颜色 */
      .pct-up { color: #16c784; }
      .pct-down { color: #ea3943; }

      /* 走势图 */
      .sparkline {
        width: 100px;
        height: 30px;
        object-fit: contain;
      }

      /* 翻页控件 */
      .pagination-wrapper {
        display: flex;
        justify-content: flex-start;
        align-items: center;
        margin-top: 20px;
        gap: 8px;
      }
      .page-btn {
        padding: 6px 12px;
        border: 1px solid #cfd6e4;
        border-radius: 6px;
        background: #fff;
        color: #0d1421;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        text-decoration: none;
      }
      .page-btn:hover:not(:disabled) {
        background: #f8fafd;
      }
      .page-btn:disabled {
        color: #a6b0c3;
        cursor: not-allowed;
        border-color: #eff2f5;
      }
      .page-info {
        margin-left: 10px;
        font-size: 14px;
        color: #616e85;
      }
    `;
    document.head.appendChild(style);
  }

  // ==========================================
  // 1. 格式化工具
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
  function renderCustomTable() {
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const pageData = allCoins.slice(startIdx, startIdx + PAGE_SIZE);
    
    let rowsHtml = '';
    pageData.forEach(coin => {
      const pct1hClass = coin.percentChange1h >= 0 ? 'pct-up' : 'pct-down';
      const pct24hClass = coin.percentChange24h >= 0 ? 'pct-up' : 'pct-down';
      const pct7dClass = coin.percentChange7d >= 0 ? 'pct-up' : 'pct-down';
      
      const arrow1h = coin.percentChange1h >= 0 ? '▲' : '▼';
      const arrow24h = coin.percentChange24h >= 0 ? '▲' : '▼';
      const arrow7d = coin.percentChange7d >= 0 ? '▲' : '▼';

      rowsHtml += `
        <tr>
          <td>${coin.rank}</td>
          <td>
            <div class="coin-name-wrap" onclick="alert('【币种详情】\\n名称: ${coin.name}\\n符号: ${coin.symbol}\\n价格: ${formatPrice(coin.price)}\\n市值: ${formatCompact(coin.marketCap)}')">
              <img src="https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png" class="coin-logo" onerror="this.src='https://s2.coinmarketcap.com/static/cloud/img/coinmarketcap_1.svg'"/>
              <span>${coin.name}</span>
              <span class="coin-symbol">${coin.symbol}</span>
            </div>
          </td>
          <td>${formatPrice(coin.price)}</td>
          <td class="${pct1hClass}">${arrow1h} ${formatPercent(coin.percentChange1h)}</td>
          <td class="${pct24hClass}">${arrow24h} ${formatPercent(coin.percentChange24h)}</td>
          <td class="${pct7dClass}">${arrow7d} ${formatPercent(coin.percentChange7d)}</td>
          <td>${formatCompact(coin.marketCap)}</td>
          <td>${formatCompact(coin.volume24h)}</td>
          <td>${formatSupply(coin.circulatingSupply)} ${coin.symbol}</td>
          <td>
            <img src="https://s3.coinmarketcap.com/generated/sparklines/web/7d/2781/${coin.id}.svg" class="sparkline" onerror="this.style.display='none'"/>
          </td>
        </tr>
      `;
    });

    // 整体替换 body 的内容为我们自建的极简骨架
    document.body.innerHTML = `
      <div id="custom-app">
        <div class="page-title">Cryptocurrency Prices by Market Cap</div>
        <table class="crypto-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Price</th>
              <th>1h %</th>
              <th>24h %</th>
              <th>7d %</th>
              <th>Market Cap</th>
              <th>Volume(24h)</th>
              <th>Circulating Supply</th>
              <th>7d Price%</th>
            </tr>
          </thead>
          <tbody id="custom-tbody">
            ${rowsHtml}
          </tbody>
        </table>
        
        <div class="pagination-wrapper">
          <button id="btn-prev" class="page-btn" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
          <span class="page-info">Page ${currentPage} of ${Math.ceil(allCoins.length / PAGE_SIZE)}</span>
          <button id="btn-next" class="page-btn" ${currentPage * PAGE_SIZE >= allCoins.length ? 'disabled' : ''}>Next</button>
        </div>
      </div>
    `;

    // 绑定翻页事件
    document.getElementById('btn-prev').addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderCustomTable();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    document.getElementById('btn-next').addEventListener('click', () => {
      if (currentPage * PAGE_SIZE < allCoins.length) {
        currentPage++;
        renderCustomTable();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // ==========================================
  // 3. 启动应用
  // ==========================================
  async function start() {
    // 1. 在页面最早期注入清洗全局的样式
    injectCustomCSS();
    
    // 2. 显示一个加载提示（此时原网页结构还在，但我们会瞬间覆盖它）
    document.body.innerHTML = '<div style="text-align:center; padding: 50px; font-size: 18px; color: #616e85;">Loading Market Data...</div>';

    try {
      // 3. 请求后端全量数据
      const res = await fetch(`${API_BASE}/listing/all`);
      const json = await res.json();
      
      if (Array.isArray(json.data) && json.data.length > 0) {
        // 4. 按排名严格排序
        allCoins = json.data.sort((a, b) => (a.rank || 9999999) - (b.rank || 9999999));
        
        // 5. 解析 URL 里的页码
        const urlParams = new URLSearchParams(window.location.search);
        const pageParam = parseInt(urlParams.get('page'), 10);
        currentPage = (pageParam && pageParam > 0) ? pageParam : 3;

        // 6. 渲染属于我们的纯净版页面
        renderCustomTable();
      } else {
        document.body.innerHTML = '<div style="text-align:center; padding: 50px;">No data available.</div>';
      }
    } catch (e) {
      console.error('[inject] 数据加载失败:', e.message);
      document.body.innerHTML = '<div style="text-align:center; padding: 50px; color: red;">Failed to load data. Please check your API server.</div>';
    }
  }

  // 因为我们要直接覆盖原网页，所以等 DOM 一准备就绪就立刻执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
