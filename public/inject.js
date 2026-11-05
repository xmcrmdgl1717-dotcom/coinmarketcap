(function () {
  'use strict';

  const API_BASE = 'https://coinmarketcapweb.onrender.com/api';
  
  let currentPage = 1; // 默认展示第 1 页，确保有数据
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
  function renderTable(coins) {
    const tbody = document.getElementById('crypto-tbody');
    if (!tbody) return;

    const pageInfo = document.getElementById('page-info');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    if (!coins || coins.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 50px;">当前页没有数据。</td></tr>';
      return;
    }

    let html = '';
    coins.forEach(coin => {
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
    if(pageInfo) pageInfo.textContent = `Page ${currentPage}`;
    if(btnPrev) btnPrev.disabled = currentPage === 1;
    if(btnNext) btnNext.disabled = coins.length < PAGE_SIZE; // 如果不满100条，说明是最后一页
  }

  // 加载指定页的数据
  async function loadPageData(page) {
    const tbody = document.getElementById('crypto-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 50px; color: #616e85;">正在加载第 ${page} 页数据... (Render 冷启动需等待 30-50 秒)</td></tr>`;
    }

    try {
      const start = (page - 1) * PAGE_SIZE + 1;
      const url = `${API_BASE}/listing?start=${start}&limit=${PAGE_SIZE}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
      const json = await res.json();
      
      let rawList = [];
      if (Array.isArray(json)) rawList = json;
      else if (json.data && Array.isArray(json.data)) rawList = json.data;
      else if (json.data && json.data.listing && json.data.listing.cryptoCurrencyList) rawList = json.data.listing.cryptoCurrencyList;
      
      renderTable(rawList);

    } catch (e) {
      console.error('Data load failed:', e);
      let errorMsg = e.message;
      if (e.name === 'AbortError') errorMsg = "请求超时。Render 免费后端正在唤醒，请刷新重试。";
      
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align:center; padding: 50px; color: #ea3943;">
              <strong>数据加载失败</strong><br><br>${errorMsg}
            </td>
          </tr>
        `;
      }
    }
  }

  // 初始化
  async function init() {
    // 1. 渲染 Trending Coins 卡片 (写死拉取前 5 个)
    try {
      const resTop = await fetch(`${API_BASE}/listing?start=1&limit=5`);
      const jsonTop = await resTop.json();
      let topList = jsonTop.data || (jsonTop.data && jsonTop.data.listing && jsonTop.data.listing.cryptoCurrencyList) || [];
      
      if (topList.length > 0) {
        const trendingContainer = document.getElementById('trending-coins');
        if (trendingContainer) {
          let trendingHtml = '';
          topList.slice(0, 5).forEach((coin, idx) => {
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
      }
    } catch(e) { console.log('Trending coins load failed', e); }

    // 2. 加载第 1 页表格数据
    loadPageData(currentPage);

    // 3. 绑定翻页按钮事件
    document.getElementById('btn-prev').addEventListener('click', () => {
      if (currentPage > 1) { 
        currentPage--; 
        loadPageData(currentPage); 
        window.scrollTo({ top: 0, behavior: 'smooth' }); 
      }
    });
    document.getElementById('btn-next').addEventListener('click', () => {
      currentPage++; 
      loadPageData(currentPage); 
      window.scrollTo({ top: 0, behavior: 'smooth' }); 
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
