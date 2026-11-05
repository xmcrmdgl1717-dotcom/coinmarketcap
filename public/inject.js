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
  let prevDetailVol = null;

  // 通用 Fetch 超时封装（8秒超时，防止服务器网络卡死）
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

  // ==========================================
  // 1. 多语言字典
  // ==========================================
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
    if (savedLang && i18nData[savedLang]) {
      applyLanguage(savedLang);
      return;
    }
    const navLang = navigator.language || navigator.userLanguage;
    if (navLang.includes('zh-CN') || navLang.includes('zh-Hans')) applyLanguage('zh-CN');
    else if (navLang.includes('zh-TW') || navLang.includes('zh-HK') || navLang.includes('zh-Hant')) applyLanguage('zh-TW');
    else applyLanguage('en');
  }

  // ==========================================
  // 2. 悬浮菜单与刷新
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
  // 3. 渲染顶部数据 (带容错)
  // ==========================================
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

      // 更新基础 UI
      const fg = global.fearGreed || {};
      if (document.getElementById('fg-value-d')) document.getElementById('fg-value-d').textContent = fg.value ?? '--';
      if (document.getElementById('fg-value-m')) document.getElementById('fg-value-m').textContent = fg.value ?? '--';
      
      const mcapStr = formatCompact(global.totalMarketCap || 0);
      if (document.getElementById('global-mcap-d')) document.getElementById('global-mcap-d').innerHTML = mcapStr;
      if (document.getElementById('global-mcap-m')) document.getElementById('global-mcap-m').innerHTML = mcapStr;

      // Trending 渲染
      trendingData = trending.data || [];
      if (trendingData.length > 0) {
        renderTrendingPage(0);
      } else {
        document.getElementById('trending-list').innerHTML = '<div style="text-align:center;color:#999;padding:20px;">暂无数据</div>';
      }

      // 衍生品渲染 (带兜底数据防空白)
      renderDerivativesCard(derivatives);

    } catch (e) {
      console.warn('[topCards] 顶部数据加载失败:', e);
    }
  }

  // ==========================================
  // 4. 轮播图渲染
  // ==========================================
  async function initCarousel() {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/news`);
      const data = await res.json();
      newsData = data.length > 0 ? data : [
        { title: 'Bitcoin Market Update', description: 'Stay updated.' },
        { title: 'Ethereum Ecosystem', description: 'Explore new developments.' }
      ];
      
      const gradients = ['linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)', 'linear-gradient(135deg, #1A2980 0%, #26D0CE 100%)', 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)'];
      const inner = document.getElementById('carousel-inner');
      const dotsContainer = document.getElementById('carousel-dots');

      inner.innerHTML = newsData.map((n, i) => `
        <div class="carousel-item" style="background:${gradients[i%3]}">
          <h2>${n.title}</h2><p>${n.description}</p>
        </div>
      `).join('');
      
      dotsContainer.innerHTML = newsData.map((_, i) => `<div class="carousel-dot ${i===0?'active':''}" data-index="${i}"></div>`).join('');

      dotsContainer.querySelectorAll('.carousel-dot').forEach(dot => {
        dot.addEventListener('click', (e) => { goToSlide(parseInt(e.target.getAttribute('data-index'))); });
      });
      startAutoPlay();
    } catch (e) {
      // 即使新闻挂了，也显示黑色背景默认字，防止黑屏
      document.getElementById('carousel-inner').innerHTML = `<div class="carousel-item" style="background:#1A2980"><h2>Welcome to Crypto Data</h2><p>Real-time market tracking.</p></div>`;
    }
  }

  function goToSlide(index) {
    const inner = document.getElementById('carousel-inner');
    const dots = document.querySelectorAll('.carousel-dot');
    currentSlide = index;
    inner.style.transform = `translateX(-${currentSlide * 100}%)`;
    dots.forEach((dot, i) => dot.classList.toggle('active', i === currentSlide));
  }

  function startAutoPlay() {
    if (carouselTimer) clearInterval(carouselTimer);
    carouselTimer = setInterval(() => {
      if (newsData.length <= 1) return;
      currentSlide = (currentSlide + 1) % newsData.length;
      goToSlide(currentSlide);
    }, 4000);
  }

  // ==========================================
  // 5. 其他卡片渲染
  // ==========================================
  function renderTrendingPage(pageIndex) {
    const listEl = document.getElementById('trending-list');
    if (!listEl || trendingData.length === 0) return;
    
    const start = pageIndex * TRENDING_PAGE_SIZE;
    const pageData = trendingData.slice(start, start + TRENDING_PAGE_SIZE);
    
    listEl.innerHTML = pageData.map((coin, i) => {
      const pct = coin.percentChange24h || 0;
      const cls = pct >= 0 ? 'text-up' : 'text-down';
      return `
        <div class="trend-row">
          <div class="trend-left">
            <span style="color:var(--text-secondary); width:12px;">${start + i + 1}</span>
            <img src="https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png" onerror="this.style.display='none'"/>
            <span>${coin.symbol}</span>
          </div>
          <div>
            <span style="font-weight:600;">${formatPrice(coin.price)}</span>
            <span class="${cls}" style="margin-left:8px;font-size:12px;">${pct >= 0 ? '▲' : '▼'} ${formatPercent(pct)}</span>
          </div>
        </div>
      `;
    }).join('');
    
    const pageIndicator = document.getElementById('trending-page-indicator');
    if (pageIndicator) {
      const totalPages = Math.ceil(trendingData.length / TRENDING_PAGE_SIZE);
      pageIndicator.textContent = `${pageIndex + 1}/${totalPages} >`;
    }
  }

  function renderDerivativesCard(derivatives) {
    const totalLiq = derivatives.totalLiquidations || 0;
    const longLiq = derivatives.longLiquidations || 0;
    const shortLiq = derivatives.shortLiquidations || 0;
    
    let barsHtml = '';
    for (let i = 0; i < 12; i++) {
      const isRed = Math.random() > 0.4;
      const height = Math.floor(Math.random() * 60) + 30;
      barsHtml += `<div class="bar" style="height:${height}%; background:${isRed ? '#ea3943' : '#16c784'};"></div>`;
    }

    document.getElementById('derivatives-content').innerHTML = `
      <div class="stat-row"><span class="stat-label">All Liquidations (24h)</span><span class="stat-value">${formatCompact(totalLiq)}</span></div>
      <div class="stat-row"><span class="stat-label">Long</span><span class="stat-value text-up">${formatCompact(longLiq)}</span></div>
      <div class="stat-row"><span class="stat-label">Short</span><span class="stat-value text-down">${formatCompact(shortLiq)}</span></div>
      <div class="mini-chart">${barsHtml}</div>
      <div class="ms-bottom">
          <div class="inner-card" style="padding: 8px 12px;"><div class="stat-row" style="margin:0;"><span class="stat-label">Open Interest</span><span class="stat-value">${formatCompact(derivatives.openInterest || 0)}</span></div></div>
          <div class="inner-card" style="padding: 8px 12px;"><div class="stat-row" style="margin:0;"><span class="stat-label">Volume (24h)</span><span class="stat-value">${formatCompact(derivatives.volume24h || 0)}</span></div></div>
      </div>
    `;
  }

  // ==========================================
  // 6. 内页与图表
  // ==========================================
  window.openCoinDetail = function(coinId, symbol) {
    const sheet = document.getElementById('bottom-sheet');
    sheet.classList.add('show');
    
    currentDetailId = coinId;
    currentDetailSymbol = symbol;
    prevDetailPrice = null;
    prevDetailVol = null;
    
    document.getElementById('sheet-coin-logo').src = `https://s2.coinmarketcap.com/static/img/coins/64x64/${coinId}.png`;
    document.getElementById('sheet-coin-name').textContent = symbol;
    document.getElementById('sheet-coin-symbol').textContent = symbol;
    
    // 如果之前有实例，先清除
    if (chartInstance) { chartInstance.remove(); chartInstance = null; }
    document.getElementById('detail-chart').innerHTML = '<div style="text-align:center;padding-top:100px;color:#999;">加载图表中...</div>';
    
    fetchDetailData(coinId, symbol);

    if (detailTimer) clearInterval(detailTimer);
    detailTimer = setInterval(() => { fetchDetailData(coinId, symbol); }, refreshInterval);
  };

  async function fetchDetailData(coinId, symbol) {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/detail?symbol=${symbol}`);
      if (!res.ok) throw new Error('API Err');
      const detail = await res.json();

      const priceEl = document.getElementById('sheet-coin-price');
      const newPrice = detail.price;
      priceEl.classList.remove('price-flash-up', 'price-flash-down');
      if (prevDetailPrice !== null && newPrice !== prevDetailPrice) {
        void priceEl.offsetWidth; 
        priceEl.classList.add(newPrice > prevDetailPrice ? 'price-flash-up' : 'price-flash-down');
      }
      priceEl.textContent = formatPrice(newPrice);
      prevDetailPrice = newPrice;

      const volEl = document.getElementById('sheet-coin-vol');
      volEl.classList.remove('price-flash-up', 'price-flash-down');
      if (prevDetailVol !== null && detail.vol24h !== prevDetailVol) {
        void volEl.offsetWidth;
        volEl.classList.add(detail.vol24h > prevDetailVol ? 'price-flash-up' : 'price-flash-down');
      }
      volEl.textContent = formatCompact(detail.vol24h || 0);
      prevDetailVol = detail.vol24h;

      if (detail.klines && detail.klines.length > 0) {
        const chartContainer = document.getElementById('detail-chart');
        if (chartContainer.querySelector('div')) chartContainer.innerHTML = '';
        
        if (chartContainer.clientWidth === 0) {
          setTimeout(() => { renderChart(detail.klines); }, 350);
        } else {
          renderChart(detail.klines);
        }
      } else {
        document.getElementById('detail-chart').innerHTML = `<div style="text-align:center;padding-top:100px;color:#999;">暂无走势图数据</div>`;
      }
    } catch (e) {
      // 降级显示
      const coin = currentPageData.find(c => String(c.id) === String(coinId));
      if (coin && !chartInstance) {
        document.getElementById('sheet-coin-price').textContent = formatPrice(coin.price);
        document.getElementById('detail-chart').innerHTML = `<div style="text-align:center;padding-top:100px;color:#999;">加载图表失败，请稍后重试</div>`;
      }
    }
  }

  function renderChart(klines) {
    const chartContainer = document.getElementById('detail-chart');
    if (chartContainer.clientWidth === 0) return;

    if (!chartInstance) {
      chartInstance = LightweightCharts.createChart(chartContainer, {
        width: chartContainer.clientWidth,
        height: 300,
        layout: { backgroundColor: '#ffffff', textColor: '#333' },
        grid: { vertLines: { color: '#f0f3fa' }, horzLines: { color: '#f0f3fa' } },
        timeScale: { timeVisible: true, secondsVisible: false },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      });
      candleSeries = chartInstance.addCandlestickSeries({
        upColor: '#16c784', downColor: '#ea3943', borderVisible: false,
        wickUpColor: '#16c784', wickDownColor: '#ea3943',
      });
      candleSeries.setData(klines);
      chartInstance.timeScale().fitContent();
    } else {
      const lastCandle = klines[klines.length - 1];
      candleSeries.update(lastCandle);
    }
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

  // ==========================================
  // 7. 表格渲染与启动
  // ==========================================
  function formatPrice(p) { if (!p) return '--'; if (p >= 1) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); if (p >= 0.01) return '$' + p.toFixed(4); if (p >= 0.0001) return '$' + p.toFixed(6); return '$' + p.toFixed(8); }
  function formatCompact(n) { if (!n) return '--'; const a = Math.abs(n); if (a >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'; if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'; if (a >= 1e3) return '$' + (n / 1e3).toFixed(2) + 'K'; return '$' + n.toFixed(2); }
  function formatSupply(n) { if (!n) return '--'; const a = Math.abs(n); if (a >= 1e12) return (n / 1e12).toFixed(2) + 'T'; if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M'; if (a >= 1e3) return (n / 1e3).toFixed(2) + 'K'; return String(n); }
  function formatPercent(p) { if (p == null) return '--'; return Math.abs(p).toFixed(2) + '%'; }

  let currentPageData = [];
  function renderTable(coins, isSilent) {
    const tbody = document.getElementById('crypto-tbody');
    if (!tbody) return;
    currentPageData = coins;
    
    // 关键修复：如果没数据，显示提示而不是一直 Loading
    if (!coins || coins.length === 0) { 
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:50px;color:#ea3943;">数据获取失败，请刷新重试</td></tr>`; 
      return; 
    }

    let html = '';
    coins.forEach(coin => {
      let flashClass = '';
      if (isSilent && prevPrices[coin.id] !== undefined) {
        if (coin.price > prevPrices[coin.id]) flashClass = 'price-flash-up';
        else if (coin.price < prevPrices[coin.id]) flashClass = 'price-flash-down';
      }
      prevPrices[coin.id] = coin.price;
      
      html += `
        <tr onclick="window.openCoinDetail(${coin.id}, '${coin.symbol}')">
          <td>${coin.rank || '-'}</td>
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
      renderTable(json.data || [], isSilent);
    } catch (e) {
      console.error('表格加载失败:', e);
      if (!isSilent && tbody) {
        // 把错误直接显示在页面，不用按F12就能排查
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:50px;color:#ea3943;">
          <strong>行情数据加载失败</strong><br><br>
          错误原因: ${e.message}<br>
          请检查后端服务是否已启动。
        </td></tr>`;
      }
    }
  }

  async function init() {
    setupFloatingMenus();
    await initLanguage(); 
    initCarousel();
    setupBottomSheet();
    renderTopCards();
    loadPageData(currentPage, false);
    setupRefreshTimer(5000);

    document.getElementById('btn-prev')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; loadPageData(currentPage, false); } });
    document.getElementById('btn-next')?.addEventListener('click', () => { currentPage++; loadPageData(currentPage, false); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
