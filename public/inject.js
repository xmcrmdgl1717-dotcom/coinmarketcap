(function () {
  'use strict';

  const API_BASE = 'https://coinmarketcapweb.onrender.com/api';
  
  let allCoins = [];
  let currentPage = 3; 
  const PAGE_SIZE = 100;

  // ==========================================
  // 0. 终极物理删除（把不需要的 HTML 直接抠掉）
  // ==========================================
  function forceRemoveElements() {
    // 1. 在 head 注入最高优先级的 CSS（防止页面打开瞬间闪烁）
    if (!document.getElementById('cmc-force-css')) {
      const style = document.createElement('style');
      style.id = 'cmc-force-css';
      style.innerHTML = `
        /* 顶部的 4 个大卡片 (Market Status, Trending Coins 等) */
        .leaRTT { display: none !important; }
        
        /* 中间的 AI 标签 (Topic, Try Agentic Charts 等) */
        [data-test="homepage-ai-insights"], .jsdkmm { display: none !important; }
        
        /* 表格上方的工具栏 (All Networks, Filters, Columns 等) */
        [data-test="table-control"] { display: none !important; }
        
        /* 顶部导航和二级菜单 */
        .rLYzrW_global-header, [data-test="global-header"] { display: none !important; }
        [data-test="homepage-table-header"] { display: none !important; }
        
        /* 标题和底部所有东西 */
        .style__HeaderWrapper-sc-402f0830-1 { display: none !important; }
        [data-test="global-newsletter"], [data-test="global-footer"], 
        [data-test="global-bottom-stats-bar"], footer, .inner-banner { display: none !important; }
        
        /* 页面贴顶 */
        .main-content { padding-top: 10px !important; }
        .style__HomepageContainer-sc-402f0830-2 { padding-top: 0 !important; }
      `;
      document.head.appendChild(style);
    }

    // 2. 物理删除 DOM 节点
    const selectors = [
      '.leaRTT', 
      '[data-test="homepage-ai-insights"]', 
      '.jsdkmm', 
      '[data-test="table-control"]',
      '.rLYzrW_global-header',
      '[data-test="homepage-table-header"]',
      '.style__HeaderWrapper-sc-402f0830-1',
      '[data-test="global-newsletter"]',
      '[data-test="global-footer"]',
      '[data-test="global-bottom-stats-bar"]',
      'footer',
      '.inner-banner'
    ];

    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        // 直接从 DOM 树中移除
        el.remove(); 
      });
    });
  }

  // 3. 启动“守卫”，只要 React 敢偷偷重建，就立刻秒杀
  function startGuard() {
    forceRemoveElements();
    // 轮询清理，因为 React 可能会在几百毫秒后重绘
    setInterval(forceRemoveElements, 200); 
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
  // 2. 渲染表格
  // ==========================================
  function renderTable(page) {
    const tbody = document.querySelector('tbody');
    if (!tbody) return;
    const templateRow = tbody.querySelector('tr[style*="cursor:pointer"]') || tbody.querySelector('tr');
    if (!templateRow) return;

    const startIdx = (page - 1) * PAGE_SIZE;
    const pageData = allCoins.slice(startIdx, startIdx + PAGE_SIZE);
    
    const skeletonRows = Array.from(tbody.querySelectorAll('tr')).filter(tr => !tr.hasAttribute('style'));
    tbody.innerHTML = '';
    skeletonRows.forEach(tr => tbody.appendChild(tr));

    pageData.forEach((coin) => {
      const tr = templateRow.cloneNode(true);
      tr.setAttribute('data-coin-id', String(coin.id));
      
      const rankP = tr.querySelectorAll('td')[1].querySelector('p');
      if (rankP) rankP.textContent = coin.rank;

      const link = tr.querySelectorAll('td')[2].querySelector('a');
      if (link) {
        link.href = 'javascript:void(0);';
        const img = link.querySelector('img.coin-logo');
        if (img) img.src = `https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png`;
        const nameP = link.querySelector('.coin-item-name');
        if (nameP) nameP.textContent = coin.name;
        const symbolP = link.querySelector('.coin-item-symbol');
        if (symbolP) symbolP.textContent = coin.symbol;
      }

      const tds = tr.querySelectorAll('td');
      
      const priceContainer = tds[3].querySelector('[class*="Price__PriceTransition"]');
      if (priceContainer) priceContainer.textContent = formatPrice(coin.price);

      [coin.percentChange1h, coin.percentChange24h, coin.percentChange7d].forEach((pct, i) => {
        const cell = tds[4 + i];
        const wrapper = cell.querySelector('span[class*="PercentageView"]');
        if (wrapper) {
          const textNodes = Array.from(wrapper.childNodes).filter(n => n.nodeType === 3);
          if (textNodes.length > 0) textNodes[0].textContent = formatPercent(pct);
          wrapper.style.color = pct >= 0 ? '#16C784' : '#EA3943';
        }
      });

      const spans8 = tds[7].querySelectorAll('span');
      for (let i = spans8.length - 1; i >= 0; i--) {
        if (spans8[i].children.length === 0) { spans8[i].textContent = formatCompact(coin.marketCap); break; }
      }
      const spans9 = tds[8].querySelectorAll('span');
      for (let i = spans9.length - 1; i >= 0; i--) {
        if (spans9[i].children.length === 0) { spans9[i].textContent = formatCompact(coin.volume24h); break; }
      }

      const supplyVal = tds[9].querySelector('.circulating-supply-value span');
      if (supplyVal) supplyVal.textContent = formatSupply(coin.circulatingSupply);

      const sparklineImg = tds[11].querySelector('img');
      if (sparklineImg) sparklineImg.src = `https://s3.coinmarketcap.com/generated/sparklines/web/7d/2781/${coin.id}.svg`;

      tbody.appendChild(tr);
    });

    updatePaginationUI(page);
  }

  // ==========================================
  // 3. 接管分页
  // ==========================================
  function updatePaginationUI(page) {
    const totalPages = Math.ceil(allCoins.length / PAGE_SIZE);
    const paginationUl = document.querySelector('.pagination');
    if (!paginationUl) return;

    let html = '';
    if (page > 1) html += `<li class="previous"><a href="#" data-page="${page - 1}" class="chevron">&#10094;</a></li>`;
    else html += `<li class="previous disabled"><span class="chevron">&#10094;</span></li>`;

    let startP = Math.max(1, page - 2);
    let endP = Math.min(totalPages, page + 2);

    if (startP > 1) html += `<li class="page"><a href="#" data-page="1">1</a></li>`;
    if (startP > 2) html += `<li class="break">...</li>`;

    for (let i = startP; i <= endP; i++) {
      if (i === page) html += `<li class="page active"><a href="#" aria-current="page">${i}</a></li>`;
      else html += `<li class="page"><a href="#" data-page="${i}">${i}</a></li>`;
    }

    if (endP < totalPages - 1) html += `<li class="break">...</li>`;
    if (endP < totalPages) html += `<li class="page"><a href="#" data-page="${totalPages}">${totalPages}</a></li>`;

    if (page < totalPages) html += `<li class="next"><a href="#" data-page="${page + 1}" class="chevron">&#10095;</a></li>`;
    else html += `<li class="next disabled"><span class="chevron">&#10095;</span></li>`;

    paginationUl.innerHTML = html;

    const footerText = document.querySelector('.table_footer-left');
    if (footerText) {
      const start = (page - 1) * PAGE_SIZE + 1;
      const end = Math.min(page * PAGE_SIZE, allCoins.length);
      footerText.textContent = `Showing ${start} - ${end} out of ${allCoins.length}`;
    }

    paginationUl.querySelectorAll('a[data-page]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        currentPage = parseInt(a.getAttribute('data-page'), 10);
        renderTable(currentPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  // ==========================================
  // 4. 拦截点击
  // ==========================================
  function neutralizeLinks() {
    document.addEventListener('click', function (e) {
      const anchor = e.target.closest('a');
      if (anchor && !anchor.hasAttribute('data-page')) {
        const tr = anchor.closest('tr');
        const coinId = tr ? tr.getAttribute('data-coin-id') : null;
        if (coinId) {
          e.preventDefault();
          e.stopPropagation();
          const coinData = allCoins.find(c => String(c.id) === String(coinId));
          if (coinData) {
            alert(`【币种详情】\n名称: ${coinData.name} (${coinData.symbol})\n排名: #${coinData.rank}\n价格: ${formatPrice(coinData.price)}\n市值: ${formatCompact(coinData.marketCap)}`);
          }
          return;
        }
        const href = anchor.getAttribute('href') || '';
        if (href.startsWith('/') || href.includes('coinmarketcap.com')) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    }, true);
  }

  // ==========================================
  // 5. 启动
  // ==========================================
  async function start() {
    startGuard(); // 启动物理删除守卫
    neutralizeLinks();

    try {
      const tbody = document.querySelector('tbody');
      if (tbody) tbody.style.opacity = '0.5';

      const res = await fetch(`${API_BASE}/listing/all`);
      const json = await res.json();
      
      if (Array.isArray(json.data) && json.data.length > 0) {
        allCoins = json.data.sort((a, b) => (a.rank || 9999999) - (b.rank || 9999999));
        
        const urlParams = new URLSearchParams(window.location.search);
        const pageParam = parseInt(urlParams.get('page'), 10);
        currentPage = (pageParam && pageParam > 0) ? pageParam : 3;

        renderTable(currentPage);
      }
    } catch (e) {
      console.error('[inject] 数据加载失败:', e.message);
    } finally {
      if (document.querySelector('tbody')) document.querySelector('tbody').style.opacity = '1';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
