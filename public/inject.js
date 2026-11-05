(function () {
  'use strict';

  // ⚠️ 注意检查这里：确保你的 Render 后端地址完全正确，且没有多余的斜杠
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
    if (!tbody) return;

    const pageInfo = document.getElementById('page-info');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    const totalPages = Math.ceil(allCoins.length / PAGE_SIZE) || 1;
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageData = allCoins.slice(start, start + PAGE_SIZE);

    let html = '';
    pageData.forEach(coin => {
      // 兼容不同 API 可能返回的字段名
      const rank = coin.rank || coin.cmcRank || '-';
      const name = coin.name || 'Unknown';
      const symbol = coin.symbol || '?';
      const id = coin.id || 0;
      
      const price = coin.price || coin.quotes?.USD?.price || 0;
      const p1 = coin.percentChange1h || coin.quotes?.USD?.percent_change_1h || 0;
      const p24 = coin.percentChange24h || coin.quotes?.USD?.percent_change_24h || 0;
      const p7 = coin.percentChange7d || coin.quotes?.USD?.percent_change_7d || 0;
      const mcap = coin.marketCap || coin.quotes?.USD?.market_cap || 0;
      const vol = coin.volume24h || coin.quotes?.USD?.volume_24h || 0;
      const supply = coin.circulatingSupply || coin.circulating_supply || 0;

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
    if(pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    if(btnPrev) btnPrev.disabled = currentPage === 1;
    if(btnNext) btnNext.disabled = currentPage >= totalPages;
  }

  // 初始化并填充 Trending Coins 卡片
  async function init() {
    const tbody = document.getElementById('crypto-tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 50px; color: #616e85;">正在连接服务器 (Render 免费版首次访问可能需要等待 30-50 秒唤醒)...</td></tr>';
    }

    try {
      console.log("[Debug] 发起请求:", `${API_BASE}/listing/all`);
      
      const res = await fetch(`${API_BASE}/listing/all`);
      if (!res.ok) throw new Error(`HTTP 状态码错误: ${res.status}`);
      
      const json = await res.json();
      console.log("[Debug] 收到的 JSON:", json);

      // 兼容多种可能的 JSON 结构
      let rawList = [];
      if (Array.isArray(json)) rawList = json;
      else if (json.data && Array.isArray(json.data)) rawList = json.data;
      else if (json.data && json.data.listing && json.data.listing.cryptoCurrencyList) rawList = json.data.listing.cryptoCurrencyList;
      
      if (rawList.length > 0) {
        // 强转并排序
        allCoins = rawList.sort((a, b) => {
          const rankA = a.rank || a.cmcRank || 9999999;
          const rankB = b.rank || b.cmcRank || 9999999;
          return rankA - rankB;
        });
        
        const urlParams = new URLSearchParams(window.location.search);
        const pageParam = parseInt(urlParams.get('page'), 10);
        if (pageParam && pageParam > 0) currentPage = pageParam;

        renderTable();

        // 填充 Trending Coins 卡片
        const trendingContainer = document.getElementById('trending-coins');
        if (trendingContainer) {
          let trendingHtml = '';
          allCoins.slice(0, 5).forEach((coin, idx) => {
            const symbol = coin.symbol || '?';
            const id = coin.id || 0;
            const price = coin.price || coin.quotes?.USD?.price || 0;
            const p24 = coin.percentChange24h || coin.quotes?.USD?.percent_change_24h || 0;
            
            const pct = p24 >= 0 ? 'text-up' : 'text-down';
            const arrow = p24 >= 0 ? '▲' : '▼';
            trendingHtml += `
              <div class="stat-row">
                <div style="display: flex; gap: 8px; align-items: center;">
                  <span style="color: var(--text-secondary); font-size: 12px;">${idx + 1}</span>
                  <img src="https://s2.coinmarketcap.com/static/img/coins/64x64/${id}.png" style="width: 20px; height: 20px; border-radius: 50%;" onerror="this.style.display='none'"/>
                  <span>${symbol}</span>
                </div>
                <div>
                  <span>${formatPrice(price)}</span>
                  <span class="${pct}" style="margin-left: 8px; font-size: 12px;">${arrow} ${formatPercent(p24)}</span>
                </div>
              </div>
            `;
          });
          trendingContainer.innerHTML = trendingHtml;
        }

        // 绑定翻页
        document.getElementById('btn-prev').addEventListener('click', () => {
          if (currentPage > 1) { currentPage--; renderTable(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        });
        document.getElementById('btn-next').addEventListener('click', () => {
          const total = Math.ceil(allCoins.length / PAGE_SIZE);
          if (currentPage < total) { currentPage++; renderTable(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        });

      } else {
        throw new Error("API 返回成功，但未找到币种数据。返回格式为: " + JSON.stringify(json).substring(0, 100));
      }
    } catch (e) {
      console.error('Data load failed:', e);
      // 把错误直接显示在页面上，方便排查
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align:center; padding: 50px; color: #ea3943;">
              <strong>数据加载失败</strong><br><br>
              错误原因: ${e.message}<br>
              请检查：<br>
              1. 你的 Render 后端服务是否处于唤醒状态（刷新页面重试）。<br>
              2. 后端是否配置了 CORS 允许跨域 (Access-Control-Allow-Origin: *)。<br>
              3. 接口路径是否正确 (${API_BASE}/listing/all)。
            </td>
          </tr>
        `;
      }
    }
  }

  // 等页面元素渲染完成后执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
