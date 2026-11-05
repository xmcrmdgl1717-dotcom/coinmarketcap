(function () {
  'use strict';

  const API_BASE = 'https://coinmarketcapweb.onrender.com/api';
  
  // 全局内存缓存
  let allCoins = [];
  let currentPage = 3; // 默认停留在第 3 页，与原版一致
  const PAGE_SIZE = 100;
  
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
  // 2. 表格渲染引擎 (使用模板重建 DOM)
  // ==========================================
  function renderTable(page) {
    const tbody = document.querySelector('tbody');
    if (!tbody) return;

    // 获取模板（保留现有的第一行作为样式模板）
    const templateRow = tbody.querySelector('tr[style*="cursor:pointer"]');
    if (!templateRow) return;

    // 计算当前页的数据
    const startIdx = (page - 1) * PAGE_SIZE;
    const pageData = allCoins.slice(startIdx, startIdx + PAGE_SIZE);
    
    // 清空当前 tbody (保留隐藏的骨架屏或跳过它们)
    const skeletonRows = Array.from(tbody.querySelectorAll('tr')).filter(tr => !tr.hasAttribute('style'));
    tbody.innerHTML = '';
    skeletonRows.forEach(tr => tbody.appendChild(tr));

    // 遍历生成新行
    pageData.forEach((coin, idx) => {
      const tr = templateRow.cloneNode(true);
      tr.setAttribute('data-coin-id', String(coin.id));
      
      // 1. 排名 (第2个td)
      const rankP = tr.querySelectorAll('td')[1].querySelector('p');
      if (rankP) rankP.textContent = coin.rank;

      // 2. 名称与图标 (第3个td)
      const link = tr.querySelectorAll('td')[2].querySelector('a');
      if (link) {
        link.href = '/'; // 屏蔽真链接
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
      
      // 3. 价格 (第4个td)
      const priceContainer = tds[3].querySelector('[class*="Price__PriceTransition"]');
      if (priceContainer) priceContainer.textContent = formatPrice(coin.price);

      // 4. 涨跌幅 (第5、6、7个td)
      [coin.percentChange1h, coin.percentChange24h, coin.percentChange7d].forEach((pct, i) => {
        const cell = tds[4 + i];
        const wrapper = cell.querySelector('span[class*="PercentageView"]');
        if (wrapper) {
          const textNodes = Array.from(wrapper.childNodes).filter(n => n.nodeType === 3);
          if (textNodes.length > 0) textNodes[0].textContent = formatPercent(pct);
          wrapper.style.color = pct >= 0 ? '#16C784' : '#EA3943';
        }
      });

      // 5. 市值 & 成交量 (第8、9个td)
      const spans8 = tds[7].querySelectorAll('span');
      for (let i = spans8.length - 1; i >= 0; i--) {
        if (spans8[i].children.length === 0) { spans8[i].textContent = formatCompact(coin.marketCap); break; }
      }
      const spans9 = tds[8].querySelectorAll('span');
      for (let i = spans9.length - 1; i >= 0; i--) {
        if (spans9[i].children.length === 0) { spans9[i].textContent = formatCompact(coin.volume24h); break; }
      }

      // 6. 流通量 (第10个td)
      const supplyVal = tds[9].querySelector('.circulating-supply-value span');
      if (supplyVal) supplyVal.textContent = formatSupply(coin.circulatingSupply);

      // 7. 走势图 (第12个td)
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

    // 生成新的翻页按钮
    let html = '';
    if (page > 1) {
      html += `<li class="previous"><a href="#" data-page="${page - 1}" class="chevron">&#10094;</a></li>`;
    } else {
      html += `<li class="previous disabled"><span class="chevron">&#10094;</span></li>`;
    }

    // 显示当前页附近的页码
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

    // 显示数字统计
    const footerText = document.querySelector('.table_footer-left');
    if (footerText) {
      const start = (page - 1) * PAGE_SIZE + 1;
      const end = Math.min(page * PAGE_SIZE, allCoins.length);
      footerText.textContent = `Showing ${start} - ${end} out of ${allCoins.length}`;
    }

    // 绑定翻页点击事件
    paginationUl.querySelectorAll('a[data-page]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const newPage = parseInt(a.getAttribute('data-page'), 10);
        if (newPage && newPage !== currentPage) {
          currentPage = newPage;
          renderTable(currentPage);
          window.scrollTo({ top: document.querySelector('table').offsetTop - 100, behavior: 'smooth' });
        }
      });
    });
  }

  // ==========================================
  // 4. 全局链接拦截
  // ==========================================
  function neutralizeLinks() {
    document.addEventListener('click', function (e) {
      const anchor = e.target.closest('a');
      if (anchor && !anchor.hasAttribute('data-page')) { // 排除翻页按钮
        const href = anchor.getAttribute('href') || '';
        if (href.startsWith('/') || href.includes('coinmarketcap.com') || href.includes('dex.coinmarketcap.com')) {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = '/'; 
        }
      }
    }, true);
  }

  // ==========================================
  // 5. 启动应用
  // ==========================================
  async function start() {
    // 开启全局链接拦截
    neutralizeLinks();

    try {
      // 显示加载提示
      const tbody = document.querySelector('tbody');
      if (tbody) tbody.style.opacity = '0.5';

      const res = await fetch(`${API_BASE}/listing/all`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      
      if (Array.isArray(json.data) && json.data.length > 0) {
        allCoins = json.data;
        console.log(`[inject] 成功加载全量数据，共 ${allCoins.length} 个币种`);
        
        // 默认解析 URL 中的 page 参数，或者原版默认是第 3 页
        const urlParams = new URLSearchParams(window.location.search);
        const pageParam = parseInt(urlParams.get('page'), 10);
        if (pageParam && pageParam > 0) {
          currentPage = pageParam;
        } else {
          currentPage = 3; // 原版默认
        }

        // 渲染表格
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
