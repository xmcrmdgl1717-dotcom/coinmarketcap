(function () {
  'use strict';

  const API_BASE = 'https://coinmarketcapweb.onrender.com/api';
  
  // 全局内存缓存
  let allCoins = [];
  let currentPage = 3; // 默认停留在第 3 页
  const PAGE_SIZE = 100;

  // ==========================================
  // 0. 暴力清除一切不需要的模块 (只留表格)
  // ==========================================
  function hideUnwantedElements() {
    // 1. 注入全局 CSS
    const style = document.createElement('style');
    style.id = 'cmc-clean-style';
    style.innerHTML = `
      /* 目标：干掉所有非表格区域 */
      [data-test="global-header"],
      [data-test="homepage-table-header"],
      .style__HeaderWrapper-sc-402f0830-1,
      [data-test="homepage-highlights"],
      [data-test="homepage-ai-insights"],
      [data-test="table-control"],
      [data-test="global-newsletter"],
      [data-test="global-footer"],
      footer,
      [data-test="global-bottom-stats-bar"],
      #onetrust-banner-sdk,
      .inner-banner,
      .cmc-bottom-popup {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
      }
      
      /* 调整表格容器，让表格紧贴顶部 */
      .style__HomepageContainer-sc-402f0830-2 { padding-top: 0 !important; }
      .main-content { padding-top: 10px !important; }
    `;
    document.head.appendChild(style);

    // 2. 物理隐藏节点
    const selectors = [
      '[data-test="global-header"]',
      '[data-test="homepage-table-header"]',
      '.style__HeaderWrapper-sc-402f0830-1',
      '[data-test="homepage-highlights"]', 
      '[data-test="homepage-ai-insights"]', 
      '[data-test="table-control"]', 
      '[data-test="global-newsletter"]',
      '[data-test="global-footer"]', 
      'footer',
      '[data-test="global-bottom-stats-bar"]',
      '#onetrust-banner-sdk', 
      '.inner-banner'
    ];

    const nukeNodes = () => {
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          el.style.setProperty('display', 'none', 'important');
        });
      });
    };

    nukeNodes();

    // 3. 终极绝杀：监听 DOM 变化，React 敢渲染，我们就敢删
    const observer = new MutationObserver((mutations) => {
      let shouldNuke = false;
      for (let mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldNuke = true;
          break;
        }
      }
      if (shouldNuke) nukeNodes();
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ==========================================
  // 1. 格式化工具函数
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
  // 2. 表格渲染引擎
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

    pageData.forEach((coin, idx) => {
      const tr = templateRow.cloneNode(true);
      tr.setAttribute('data-coin-id', String(coin.id));
      
      // 1. 排名
      const rankP = tr.querySelectorAll('td')[1].querySelector('p');
      if (rankP) rankP.textContent = coin.rank;

      // 2. 名称与图标
      const link = tr.querySelectorAll('td')[2].querySelector('a');
      if (link) {
        link.href = 'javascript:void(0);';
        const img = link.querySelector('img.coin-logo');
        if (img) {
          img.src = `https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png`;
          img.alt = `${coin.name} logo`;
        }
        const nameP = link.querySelector('.coin-item-name');
        if (nameP) nameP.textContent = coin.name;
        const symbolP = link.querySelector('.coin-item-symbol');
        if (symbolP) symbolP.textContent = coin.symbol;
      }

      const tds = tr.querySelectorAll('td');
      
      // 3. 价格
      const priceContainer = tds[3].querySelector('[class*="Price__PriceTransition"]');
      if (priceContainer) priceContainer.textContent = formatPrice(coin.price);

      // 4. 涨跌幅
      [coin.percentChange1h, coin.percentChange24h, coin.percentChange7d].forEach((pct, i) => {
        const cell = tds[4 + i];
        const wrapper = cell.querySelector('span[class*="PercentageView"]');
        if (wrapper) {
          const textNodes = Array.from(wrapper.childNodes).filter(n => n.nodeType === 3);
          if (textNodes.length > 0) textNodes[0].textContent = formatPercent(pct);
          wrapper.style.color = pct >= 0 ? '#16C784' : '#EA3943';
        }
      });

      // 5. 市值 & 成交量
      const spans8 = tds[7].querySelectorAll('span');
      for (let i = spans8.length - 1; i >= 0; i--) {
        if (spans8[i].children.length === 0) { spans8[i].textContent = formatCompact(coin.marketCap); break; }
      }
      const spans9 = tds[8].querySelectorAll('span');
      for (let i = spans9.length - 1; i >= 0; i--) {
        if (spans9[i].children.length === 0) { spans9[i].textContent = formatCompact(coin.volume24h); break; }
      }

      // 6. 流通量
      const supplyVal = tds[9].querySelector('.circulating-supply-value span');
      if (supplyVal) supplyVal.textContent = formatSupply(coin.circulatingSupply);

      // 7. 走势图
      const sparklineImg = tds[11].querySelector('img');
      if (sparklineImg) {
        sparklineImg.src = `https://s3.coinmarketcap.com/generated/sparklines/web/7d/2781/${coin.id}.svg`;
        sparklineImg.alt = `${coin.symbol.toLowerCase()}-7d-price-graph`;
      }

      tbody.appendChild(tr);
    });

    updatePaginationUI(page);
  }

  // ==========================================
  // 3. 接管分页 UI
  // ==========================================
  function updatePaginationUI(page) {
    const totalPages = Math.ceil(allCoins.length / PAGE_SIZE);
    const paginationUl = document.querySelector('.pagination');
    if (!paginationUl) return;

    let html = '';
    if (page > 1) {
      html += `<li class="previous"><a href="#" data-page="${page - 1}" class="chevron">&#10094;</a></li>`;
    } else {
      html += `<li class="previous disabled"><span class="chevron">&#10094;</span></li>`;
    }

    let startP = Math.max(1, page - 2);
    let endP = Math.min(totalPages, page + 2);

    if (startP > 1) html += `<li class="page"><a href="#" data-page="1">1</a></li>`;
    if (startP > 2) html += `<li class="break">...</li>`;

    for (let i = startP; i <= endP; i++) {
      if (i === page) {
        html += `<li class="page active"><a href="#" aria-current="page">${i}</a></li>`;
      } else {
        html += `<li class="page"><a href="#" data-page="${i}">${i}</a></li>`;
      }
    }

    if (endP < totalPages - 1) html += `<li class="break">...</li>`;
    if (endP < totalPages) html += `<li class="page"><a href="#" data-page="${totalPages}">${totalPages}</a></li>`;

    if (page < totalPages) {
      html += `<li class="next"><a href="#" data-page="${page + 1}" class="chevron">&#10095;</a></li>`;
    } else {
      html += `<li class="next disabled"><span class="chevron">&#10095;</span></li>`;
    }

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
        const newPage = parseInt(a.getAttribute('data-page'), 10);
        if (newPage && newPage !== currentPage) {
          currentPage = newPage;
          renderTable(currentPage);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
  }

  // ==========================================
  // 4. 全局链接拦截（点击展示数据）
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
            alert(
              `【币种详细数据展示】\n\n` +
              `名称: ${coinData.name} (${coinData.symbol})\n` +
              `当前排名: #${coinData.rank}\n` +
              `实时价格: ${formatPrice(coinData.price)}\n` +
              `市值: ${formatCompact(coinData.marketCap)}\n` +
              `24h成交量: ${formatCompact(coinData.volume24h)}\n` +
              `流通量: ${formatSupply(coinData.circulatingSupply)}`
            );
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
  // 5. 启动应用
  // ==========================================
  async function start() {
    hideUnwantedElements();
    neutralizeLinks();

    try {
      const tbody = document.querySelector('tbody');
      if (tbody) tbody.style.opacity = '0.5';

      const res = await fetch(`${API_BASE}/listing/all`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      
      if (Array.isArray(json.data) && json.data.length > 0) {
        allCoins = json.data;
        
        allCoins.sort((a, b) => (a.rank || 9999999) - (b.rank || 9999999));
        
        console.log(`[inject] 成功加载全量数据，共 ${allCoins.length} 个币种`);
        
        const urlParams = new URLSearchParams(window.location.search);
        const pageParam = parseInt(urlParams.get('page'), 10);
        currentPage = (pageParam && pageParam > 0) ? pageParam : 3;

        renderTable(currentPage);
      }
    } catch (e) {
      console.error('[inject] 数据加载失败:', e.message);
    } finally {
      const tbody = document.querySelector('tbody');
      if (tbody) tbody.style.opacity = '1';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
