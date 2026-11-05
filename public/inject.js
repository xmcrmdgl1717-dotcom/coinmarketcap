(function () {
  'use strict';

  const API_BASE = 'https://coinmarketcapweb.onrender.com/api';
  let currentPage = 1;
  const PAGE_SIZE = 100;

  let refreshInterval = 5000; 
  let refreshTimer = null;

  let newsData = [];
  let currentSlide = 0;
  let carouselTimer = null;

  let trendingData = [];
  let trendingPage = 0;
  const TRENDING_PAGE_SIZE = 5;
  let trendingTimer = null;

  const prevPrices = {}; 
  let chartInstance = null;
  let candleSeries = null;

  let detailTimer = null;
  let currentDetailId = null;
  let currentDetailSymbol = null;
  let prevDetailPrice = null;

  async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 8000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(resource, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }

  // 字典
  const i18nData = {
    'en': { market_status: 'Market Status', market_cap: 'Market Cap', altcoin_season: 'Altcoin Season', etf_flows: 'ETF Flows', trending_coins: 'Trending Coins', derivatives: 'Derivatives', fear_greed: 'Fear & Greed', trending_coin: 'Trending Coin', neutral: 'Neutral', th_rank: '#', th_name: 'Name', th_price: 'Price', th_1h: '1h %', th_24h: '24h %', th_7d: '7d %', th_mcap: 'Market Cap', th_vol: 'Volume(24h)', th_supply: 'Circulating Supply', th_chart: '7d Price%', btn_prev: 'Previous', btn_next: 'Next', loading: 'Loading...' },
    'zh-CN': { market_status: '市场概况', market_cap: '总市值', altcoin_season: '山寨季指数', etf_flows: 'ETF 资金流向', trending_coins: '热门币种', derivatives: '衍生品数据', fear_greed: '恐慌与贪婪', trending_coin: '热门币种', neutral: '中性', th_rank: '#', th_name: '名称', th_price: '价格', th_1h: '1小时 %', th_24h: '24小时 %', th_7d: '7天 %', th_mcap: '市值', th_vol: '24h成交量', th_supply: '流通量', th_chart: '7天走势', btn_prev: '上一页', btn_next: '下一页', loading: '正在加载...' },
    'zh-TW': { market_status: '市場概況', market_cap: '總市值', altcoin_season: '山寨季指數', etf_flows: 'ETF 資金流向', trending_coins: '熱門幣種', derivatives: '衍生品數據', fear_greed: '恐慌與貪婪', trending_coin: '熱門幣種', neutral: '中性', th_rank: '#', th_name: '名稱', th_price: '價格', th_1h: '1小時 %', th_24h: '24小時 %', th_7d: '7天 %', th_mcap: '市值', th_vol: '24h成交量', th_supply: '流通量', th_chart: '7天走勢', btn_prev: '上一頁', btn_next: '下一頁', loading: '正在加載...' }
  };
  let currentLang = 'en';

  function applyLanguage(lang) {
    currentLang = lang;
    const dict = i18nData[lang] || i18nData['en'];
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) el.textContent = dict[key];
    });
    loadPageData(currentPage, true);
  }

  async function initLanguage() {
    const savedLang = localStorage.getItem('crypto_lang');
    if (savedLang && i18nData[savedLang]) return applyLanguage(savedLang);
    const navLang = navigator.language || '';
    if (navLang.includes('zh-CN') || navLang.includes('zh-Hans')) applyLanguage('zh-CN');
    else if (navLang.includes('zh-TW') || navLang.includes('zh-HK') || navLang.includes('zh-Hant')) applyLanguage('zh-TW');
    else applyLanguage('en');
  }

  // ==========================================
  // 核心修复：内页图表生命周期与防闪烁
  // ==========================================
  window.openCoinDetail = function(coinId, symbol) {
    const sheet = document.getElementById('bottom-sheet');
    sheet.classList.add('show');
    
    currentDetailId = coinId;
    currentDetailSymbol = symbol;
    prevDetailPrice = null;
    
    document.getElementById('sheet-coin-logo').src = `https://s2.coinmarketcap.com/static/img/coins/64x64/${coinId}.png`;
    document.getElementById('sheet-coin-name').textContent = symbol;
    document.getElementById('sheet-coin-symbol').textContent = symbol;
    
    // 1. 清理旧图表实例
    if (chartInstance) {
        chartInstance.remove();
        chartInstance = null;
        candleSeries = null;
    }
    // 2. 显示 Loading
    document.getElementById('detail-chart').innerHTML = '<div style="text-align:center;padding-top:100px;color:#999;">图表加载中...</div>';

    // 3. 延迟 350ms 等抽屉滑出后再拉数据画图（解决宽度为0的问题）
    setTimeout(() => {
        fetchDetailData(coinId, symbol);
    }, 350);

    if (detailTimer) clearInterval(detailTimer);
    detailTimer = setInterval(() => { fetchDetailData(coinId, symbol); }, refreshInterval);
  };

  async function fetchDetailData(coinId, symbol) {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/detail?symbol=${symbol}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const detail = await res.json();

      const coinInfo = currentPageData.find(c => String(c.id) === String(coinId)) || {};

      // 更新文字数据及闪烁
      const priceEl = document.getElementById('sheet-coin-price');
      const newPrice = detail.price;
      if (prevDetailPrice !== null && newPrice !== prevDetailPrice) {
        priceEl.classList.remove('price-flash-up', 'price-flash-down');
        void priceEl.offsetWidth;
        priceEl.classList.add(newPrice > prevDetailPrice ? 'price-flash-up' : 'price-flash-down');
      }
      priceEl.textContent = formatPrice(newPrice);
      prevDetailPrice = newPrice;

      document.getElementById('sheet-coin-change').textContent = `${(detail.pct24h || 0) >= 0 ? '▲' : '▼'} ${formatPercent(detail.pct24h)} (24h)`;
      document.getElementById('sheet-coin-1h').innerHTML = `<span class="${coinInfo.percentChange1h >= 0 ? 'text-up' : 'text-down'}">${coinInfo.percentChange1h >= 0 ? '▲' : '▼'} ${formatPercent(coinInfo.percentChange1h)}</span>`;
      document.getElementById('sheet-coin-7d').innerHTML = `<span class="${(detail.pct7d || 0) >= 0 ? 'text-up' : 'text-down'}">${(detail.pct7d || 0) >= 0 ? '▲' : '▼'} ${formatPercent(detail.pct7d)}</span>`;
      
      document.getElementById('sheet-coin-mcap').textContent = formatCompact(coinInfo.marketCap);
      document.getElementById('sheet-coin-vol').textContent = formatCompact(detail.vol24h || coinInfo.volume24h);
      document.getElementById('sheet-coin-supply').textContent = `${formatSupply(coinInfo.circulatingSupply)} ${coinInfo.symbol || symbol}`;

      // 核心修复：如果没有 K 线数据，直接 return，千万不要去动图表 DOM
      if (!detail.klines || detail.klines.length === 0) return;

      // 画图
      const container = document.getElementById('detail-chart');
      // 如果容器里有 loading 字样，先清空（只清一次）
      if (container.querySelector('div')) {
          container.innerHTML = ''; 
      }

      if (!chartInstance) {
        // 第一次创建
        chartInstance = LightweightCharts.createChart(container, {
          width: container.clientWidth || 600,
          height: 300,
          layout: { backgroundColor: '#ffffff', textColor: '#333' },
          grid: { vertLines: { color: '#f0f3fa' }, horzLines: { color: '#f0f3fa' } },
          timeScale: { timeVisible: true, secondsVisible: false },
        });
        candleSeries = chartInstance.addCandlestickSeries({
          upColor: '#16c784', downColor: '#ea3943', borderVisible: false,
          wickUpColor: '#16c784', wickDownColor: '#ea3943',
        });
        candleSeries.setData(detail.klines);
        chartInstance.timeScale().fitContent();
      } else {
        // 后续刷新，只更新最新的一根 K 线，实现丝滑跳动
        candleSeries.update(detail.klines[detail.klines.length - 1]);
      }

    } catch (e) {
      console.warn('[Detail] 接口异常，保留现有图表', e);
      // 捕获异常，但不做任何 DOM 删除操作
    }
  }

  // 监听窗口大小变化
  window.addEventListener('resize', () => {
    if (chartInstance && document.getElementById('detail-chart')) {
      chartInstance.applyOptions({ width: document.getElementById('detail-chart').clientWidth });
    }
  });

  // ==========================================
  // 菜单与全局刷新
  // ==========================================
  function setupFloatingMenus() {
    const langBtn = document.getElementById('lang-btn');
    const langDropdown = document.getElementById('lang-dropdown');
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshDropdown = document.getElementById('refresh-dropdown');

    const closeAll = () => { langDropdown.classList.remove('show'); refreshDropdown.classList.remove('show'); };

    langBtn.addEventListener('click', (e) => { e.stopPropagation(); closeAll(); langDropdown.classList.toggle('show'); });
    langDropdown.querySelectorAll('div').forEach(el => {
      el.addEventListener('click', () => {
        const lang = el.getAttribute('data-lang');
        localStorage.setItem('crypto_lang', lang);
        applyLanguage(lang);
        closeAll();
      });
    });

    refreshBtn.addEventListener('click', (e) => { e.stopPropagation(); closeAll(); refreshDropdown.classList.toggle('show'); });
    refreshDropdown.querySelectorAll('div').forEach(el => {
      el.addEventListener('click', () => {
        const time = parseInt(el.getAttribute('data-time'));
        refreshDropdown.querySelectorAll('div').forEach(d => d.classList.remove('active'));
        el.classList.add('active');
        setupRefreshTimer(time);
        closeAll();
      });
    });

    document.addEventListener('click', closeAll);
  }

  function setupRefreshTimer(interval = 5000) {
    if (refreshTimer) clearInterval(refreshTimer);
    if (detailTimer) clearInterval(detailTimer);
    refreshInterval = interval;
    if (interval > 0) {
      refreshTimer = setInterval(() => {
        renderTopCards();
        loadPageData(currentPage, true);
      }, interval);
      if (currentDetailSymbol) {
        detailTimer = setInterval(() => { fetchDetailData(currentDetailId, currentDetailSymbol); }, interval);
      }
    }
  }

  // ==========================================
  // 表格渲染核心（干掉无排名资产）
  // ==========================================
  function formatPrice(p) { if (!p) return '--'; if (p >= 1) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); if (p >= 0.01) return '$' + p.toFixed(4); if (p >= 0.0001) return '$' + p.toFixed(6); return '$' + p.toFixed(8); }
  function formatCompact(n) { if (!n) return '--'; const a = Math.abs(n); if (a >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'; if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'; if (a >= 1e3) return '$' + (n / 1e3).toFixed(2) + 'K'; return '$' + n.toFixed(2); }
  function formatSupply(n) { if (!n) return '--'; const a = Math.abs(n); if (a >= 1e12) return (n / 1e12).toFixed(2) + 'T'; if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M'; if (a >= 1e3) return (n / 1e3).toFixed(2) + 'K'; return String(n); }
  function formatPercent(p) { if (p == null) return '--'; return Math.abs(p).toFixed(2) + '%'; }

  let currentPageData = [];
  function renderTable(coins, isSilent) {
    const tbody = document.getElementById('crypto-tbody');
    if (!tbody) return;
    
    const validCoins = (coins || []).filter(coin => coin.rank && coin.rank > 0);
    currentPageData = validCoins.sort((a, b) => a.rank - b.rank);

    if (currentPageData.length === 0) { 
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:50px;color:#ea3943;">数据获取失败，请刷新重试</td></tr>`; 
      return; 
    }

    let html = '';
    currentPageData.forEach(coin => {
      let flashClass = '';
      if (isSilent && prevPrices[coin.id] !== undefined) {
        if (coin.price > prevPrices[coin.id]) flashClass = 'price-flash-up';
        else if (coin.price < prevPrices[coin.id]) flashClass = 'price-flash-down';
      }
      prevPrices[coin.id] = coin.price;
      
      html += `
        <tr onclick="window.openCoinDetail(${coin.id}, '${coin.symbol}')">
          <td>${coin.rank}</td>
          <td><div class="coin-info"><img src="https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png"/><span class="coin-name">${coin.name}</span><span class="coin-symbol">${coin.symbol}</span></div></td>
          <td class="${flashClass}">${formatPrice(coin.price)}</td>
          <td class="${coin.percentChange1h >= 0 ? 'text-up' : 'text-down'}">${coin.percentChange1h >= 0 ? '▲' : '▼'} ${formatPercent(coin.percentChange1h)}</td>
          <td class="${coin.percentChange24h >= 0 ? 'text-up' : 'text-down'}">${coin.percentChange24h >= 0 ? '▲' : '▼'} ${formatPercent(coin.percentChange24h)}</td>
          <td class="${coin.percentChange7d >= 0 ? 'text-up' : 'text-down'}">${coin.percentChange7d >= 0 ? '▲' : '▼'} ${formatPercent(coin.percentChange7d)}</td>
          <td>${formatCompact(coin.marketCap)}</td>
          <td>${formatCompact(coin.volume24h)}</td>
          <td>${formatSupply(coin.circulatingSupply)} ${coin.symbol}</td>
          <td><img src="https://s3.coinmarketcap.com/generated/sparklines/web/7d/2781/${coin.id}.svg" class="sparkline"/></td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  async function loadPageData(page, isSilent = false) {
    const tbody = document.getElementById('crypto-tbody');
    if (tbody && !isSilent) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:50px;">正在加载...</td></tr>`;
    try {
      const res = await fetchWithTimeout(`${API_BASE}/listing?start=${(page - 1) * PAGE_SIZE + 1}&limit=${PAGE_SIZE}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      renderTable(json.data, isSilent);
    } catch (e) {
      if (!isSilent && tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:50px;color:#ea3943;">加载失败: ${e.message}</td></tr>`;
    }
  }

  // 其他卡片
  async function renderTopCards() {
    try {
      const [globalRes, trendingRes, derivativesRes] = await Promise.all([
        fetchWithTimeout(`${API_BASE}/global`).catch(() => null),
        fetchWithTimeout(`${API_BASE}/trending`).catch(() => null),
        fetchWithTimeout(`${API_BASE}/derivatives`).catch(() => null)
      ]);
      const global = globalRes && globalRes.ok ? await globalRes.json() : {};
      let trending = { data: [] };
      if (trendingRes && trendingRes.ok) trending = await trendingRes.json();
      const derivatives = derivativesRes && derivativesRes.ok ? await derivativesRes.json() : {};

      const fg = global.fearGreed || {};
      if (document.getElementById('fg-value-d')) document.getElementById('fg-value-d').textContent = fg.value ?? '--';
      if (document.getElementById('fg-value-m')) document.getElementById('fg-value-m').textContent = fg.value ?? '--';
      
      const mcapHtml = `${formatCompact(global.totalMarketCap || 0)} <span class="${global.marketCapChange24h >= 0 ? 'text-up' : 'text-down'}">${global.marketCapChange24h >= 0 ? '▲' : '▼'} ${formatPercent(global.marketCapChange24h)}</span>`;
      if (document.getElementById('global-mcap-d')) document.getElementById('global-mcap-d').innerHTML = mcapHtml;
      if (document.getElementById('global-mcap-m')) document.getElementById('global-mcap-m').innerHTML = mcapHtml;

      trendingData = trending.data || [];
      if (trendingData.length > 0) renderTrendingPage(0);
      renderDerivativesCard(derivatives);
    } catch (e) {}
  }

  function renderTrendingPage(pageIndex) {
    const listEl = document.getElementById('trending-list');
    if (!listEl || trendingData.length === 0) return;
    const start = pageIndex * TRENDING_PAGE_SIZE;
    const pageData = trendingData.slice(start, start + TRENDING_PAGE_SIZE);
    listEl.innerHTML = pageData.map((coin, i) => `
      <div class="trend-row">
        <div class="trend-left">
          <span style="color:var(--text-secondary); width:12px;">${start + i + 1}</span>
          <img src="https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png" onerror="this.style.display='none'"/>
          <span>${coin.symbol}</span>
        </div>
        <div>
          <span style="font-weight:600;">${formatPrice(coin.price)}</span>
          <span class="${coin.percentChange24h >= 0 ? 'text-up' : 'text-down'}" style="margin-left:8px;font-size:12px;">${coin.percentChange24h >= 0 ? '▲' : '▼'} ${formatPercent(coin.percentChange24h)}</span>
        </div>
      </div>
    `).join('');
    const pageIndicator = document.getElementById('trending-page-indicator');
    if (pageIndicator) pageIndicator.textContent = `${pageIndex + 1}/${Math.ceil(trendingData.length / TRENDING_PAGE_SIZE)} >`;
  }

  function renderDerivativesCard(derivatives) {
    let barsHtml = '';
    for (let i = 0; i < 12; i++) {
      barsHtml += `<div class="bar" style="height:${Math.floor(Math.random() * 60) + 30}%; background:${Math.random() > 0.4 ? '#ea3943' : '#16c784'};"></div>`;
    }
    document.getElementById('derivatives-content').innerHTML = `
      <div class="stat-row"><span class="stat-label">All Liquidations (24h)</span><span class="stat-value">${formatCompact(derivatives.totalLiquidations || 0)}</span></div>
      <div class="stat-row"><span class="stat-label">Long</span><span class="stat-value text-up">${formatCompact(derivatives.longLiquidations || 0)}</span></div>
      <div class="stat-row"><span class="stat-label">Short</span><span class="stat-value text-down">${formatCompact(derivatives.shortLiquidations || 0)}</span></div>
      <div class="mini-chart">${barsHtml}</div>
    `;
  }

  async function init() {
    setupFloatingMenus();
    await initLanguage(); 
    try {
      const res = await fetchWithTimeout(`${API_BASE}/news`);
      newsData = await res.json();
      const gradients = ['linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)', 'linear-gradient(135deg, #1A2980 0%, #26D0CE 100%)', 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)'];
      document.getElementById('carousel-inner').innerHTML = newsData.map((n, i) => `<div class="carousel-item" style="background:${gradients[i%3]}"><h2>${n.title}</h2><p>${n.description}</p></div>`).join('');
      startAutoPlay();
    } catch(e){}

    setupBottomSheet();
    renderTopCards();
    loadPageData(currentPage, false);
    setupRefreshTimer(5000);

    document.getElementById('btn-prev')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; loadPageData(currentPage, false); } });
    document.getElementById('btn-next')?.addEventListener('click', () => { currentPage++; loadPageData(currentPage, false); });
  }

  function setupBottomSheet() {
    const sheet = document.getElementById('bottom-sheet');
    const close = () => {
      sheet.classList.remove('show');
      if (chartInstance) { chartInstance.remove(); chartInstance = null; }
      if (detailTimer) { clearInterval(detailTimer); detailTimer = null; }
      currentDetailSymbol = null;
      document.getElementById('detail-chart').innerHTML = '';
    };
    document.getElementById('sheet-close').addEventListener('click', close);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
