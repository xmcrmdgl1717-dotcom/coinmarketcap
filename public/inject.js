(function () {
  'use strict';

  const API_BASE = 'https://coinmarketcapweb.onrender.com/api';
  let currentPage = 1;
  const PAGE_SIZE = 100;

  // 轮播图全局变量
  let newsData = [];
  let currentSlide = 0;
  let carouselTimer = null;

  let trendingData = [];
  let trendingPage = 0;
  const TRENDING_PAGE_SIZE = 5;
  let trendingTimer = null;

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
    loadPageData(currentPage); // 刷新表格文本
  }

  async function initLanguage() {
    const savedLang = localStorage.getItem('crypto_lang');
    if (savedLang && i18nData[savedLang]) {
      applyLanguage(savedLang);
      return;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (data.country_code === 'CN') return applyLanguage('zh-CN');
      if (data.country_code === 'HK' || data.country_code === 'TW') return applyLanguage('zh-TW');
      return applyLanguage('en');
    } catch (e) {
      console.log('IP location failed, using browser lang.');
    }
    const navLang = navigator.language || navigator.userLanguage;
    if (navLang.includes('zh-CN') || navLang.includes('zh-Hans')) applyLanguage('zh-CN');
    else if (navLang.includes('zh-TW') || navLang.includes('zh-HK') || navLang.includes('zh-Hant')) applyLanguage('zh-TW');
    else applyLanguage('en');
  }

  function setupLangSwitcher() {
    const btn = document.getElementById('lang-btn');
    const dropdown = document.getElementById('lang-dropdown');
    btn.addEventListener('click', (e) => { e.stopPropagation(); dropdown.classList.toggle('show'); });
    document.addEventListener('click', () => dropdown.classList.remove('show'));
    dropdown.querySelectorAll('div').forEach(el => {
      el.addEventListener('click', () => {
        const lang = el.getAttribute('data-lang');
        localStorage.setItem('crypto_lang', lang);
        applyLanguage(lang);
        dropdown.classList.remove('show');
      });
    });
  }

  // ==========================================
  // 2. 动态新闻轮播图
  // ==========================================
  async function initCarousel() {
    const inner = document.getElementById('carousel-inner');
    const dotsContainer = document.getElementById('carousel-dots');
    if (!inner || !dotsContainer) return;

    try {
      const res = await fetch(`${API_BASE}/news`);
      if (!res.ok) throw new Error('News API failed');
      newsData = await res.json();
    } catch (e) {
      console.warn('News load failed, using fallback.');
      newsData = [
        { title: 'Crypto Daily News', description: 'Stay tuned for latest updates', url: '#' },
        { title: 'Market Analysis', description: 'Check out the latest trends', url: '#' },
        { title: 'Blockchain Innovation', description: 'Explore the future of Web3', url: '#' }
      ];
    }

    const gradients = [
      'linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)',
      'linear-gradient(135deg, #1A2980 0%, #26D0CE 100%)',
      'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)'
    ];

    let slideHtml = '';
    newsData.forEach((news, idx) => {
      slideHtml += `
        <div class="carousel-item" style="background: ${gradients[idx % gradients.length]}; cursor: pointer;" onclick="window.open('${news.url}', '_blank')">
          <h2>${news.title}</h2>
          <p>${news.description}</p>
        </div>
      `;
    });
    inner.innerHTML = slideHtml;
    // 动态设置 inner 的宽度 (例如 3张图就是 300%)
    inner.style.width = `${newsData.length * 100}%`;
    // 动态设置每个 item 的宽度
    inner.querySelectorAll('.carousel-item').forEach(item => {
      item.style.width = `${100 / newsData.length}%`;
    });

    let dotHtml = '';
    newsData.forEach((_, idx) => {
      dotHtml += `<div class="carousel-dot ${idx === 0 ? 'active' : ''}" data-index="${idx}"></div>`;
    });
    dotsContainer.innerHTML = dotHtml;

    const dots = dotsContainer.querySelectorAll('.carousel-dot');
    dots.forEach(dot => {
      dot.addEventListener('click', (e) => {
        const index = parseInt(e.target.getAttribute('data-index'));
        goToSlide(index);
        resetTimer();
      });
    });

    startAutoPlay();
  }

  function goToSlide(index) {
    const inner = document.getElementById('carousel-inner');
    const dots = document.querySelectorAll('.carousel-dot');
    if (!inner || !dots.length) return;

    currentSlide = index;
    inner.style.transform = `translateX(-${currentSlide * (100 / newsData.length)}%)`;
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

  function resetTimer() {
    clearInterval(carouselTimer);
    startAutoPlay();
  }

  // ==========================================
  // 3. 格式化工具
  // ==========================================
  function formatPrice(p) {
    if (p == null || isNaN(p) || p === 0) return '--';
    if (p >= 1) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (p >= 0.01) return '$' + p.toFixed(4);
    if (p >= 0.0001) return '$' + p.toFixed(6);
    return '$' + p.toFixed(8);
  }
  function formatCompact(n) {
    if (n == null || isNaN(n) || n === 0) return '--';
    const a = Math.abs(n);
    if (a >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (a >= 1e3) return '$' + (n / 1e3).toFixed(2) + 'K';
    return '$' + n.toFixed(2);
  }
  function formatSupply(n) {
    if (n == null || isNaN(n) || n === 0) return '--';
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

  // ==========================================
  // 4. 渲染顶部数据
  // ==========================================
  async function renderTopCards() {
    try {
      const [globalRes, trendingRes, derivativesRes] = await Promise.all([
        fetch(`${API_BASE}/global`), fetch(`${API_BASE}/trending`), fetch(`${API_BASE}/derivatives`),
      ]);
      const global = globalRes.ok ? await globalRes.json() : {};
      const trending = trendingRes.ok ? await trendingRes.json() : {};
      const derivatives = derivativesRes.ok ? await derivativesRes.json() : {};

      const fg = global.fearGreed || {};
      if (document.getElementById('fg-value-d')) {
        document.getElementById('fg-value-d').textContent = fg.value ?? '--';
        document.getElementById('fg-label-d').textContent = fg.classification ?? 'Neutral';
      }
      if (document.getElementById('fg-value-m')) {
        document.getElementById('fg-value-m').textContent = fg.value ?? '--';
        document.getElementById('fg-label-m').textContent = fg.classification ?? 'Neutral';
      }
      
      const mcapStr = formatCompact(global.totalMarketCap);
      const mcapChange = global.marketCapChange24h || 0;
      const mcapColor = mcapChange >= 0 ? 'text-up' : 'text-down';
      const mcapArrow = mcapChange >= 0 ? '▲' : '▼';
      const mcapHtml = `${mcapStr} <span class="${mcapColor}">${mcapArrow} ${formatPercent(mcapChange)}</span>`;
      
      if (document.getElementById('global-mcap-d')) document.getElementById('global-mcap-d').innerHTML = mcapHtml;
      if (document.getElementById('global-mcap-m')) document.getElementById('global-mcap-m').innerHTML = mcapHtml;

      trendingData = trending.data || [];
      if (trendingData.length > 0 && document.getElementById('trending-list')) {
        renderTrendingPage(0);
        startTrendingRotation();
      }
      if (document.getElementById('derivatives-content')) {
        renderDerivativesCard(derivatives);
      }
      if (trendingData.length > 0 && document.getElementById('mobile-trending-box')) {
        const topCoin = trendingData[0];
        const pct = topCoin.percentChange24h || 0;
        const cls = pct >= 0 ? 'text-up' : 'text-down';
        const arrow = pct >= 0 ? '▲' : '▼';
        document.getElementById('mobile-trending-box').innerHTML = `
            <div class="m-card-title" data-i18n="trending_coin">Trending Coin</div>
            <div class="coin-info" style="margin-bottom: 4px;">
                <img src="https://s2.coinmarketcap.com/static/img/coins/64x64/${topCoin.id}.png" />
                <span class="coin-name">${topCoin.symbol}</span>
            </div>
            <div class="m-value" style="font-size: 14px;">${formatPrice(topCoin.price)}</div>
            <div class="${cls}" style="font-size: 12px; font-weight: 600;">${arrow} ${formatPercent(pct)}</div>
        `;
        const dict = i18nData[currentLang] || i18nData['en'];
        const el = document.getElementById('mobile-trending-box').querySelector('[data-i18n]');
        if(el) el.textContent = dict['trending_coin'];
      }
    } catch (e) {
      console.warn('[topCards] 顶部数据加载失败:', e);
    }
  }

  // ==========================================
  // 5. Trending & Derivatives
  // ==========================================
  function renderTrendingPage(pageIndex) {
    const listEl = document.getElementById('trending-list');
    const pageIndicator = document.getElementById('trending-page-indicator');
    if (!listEl) return;
    const start = pageIndex * TRENDING_PAGE_SIZE;
    const pageData = trendingData.slice(start, start + TRENDING_PAGE_SIZE);
    let html = '';
    pageData.forEach((coin, i) => {
      const pct = coin.percentChange24h || 0;
      const cls = pct >= 0 ? 'text-up' : 'text-down';
      html += `
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
    });
    listEl.innerHTML = html;
    if (pageIndicator) {
      const totalPages = Math.ceil(trendingData.length / TRENDING_PAGE_SIZE);
      pageIndicator.textContent = `${pageIndex + 1}/${totalPages} >`;
    }
  }

  function startTrendingRotation() {
    if (trendingTimer) clearInterval(trendingTimer);
    trendingTimer = setInterval(() => {
      const totalPages = Math.ceil(trendingData.length / TRENDING_PAGE_SIZE);
      if (totalPages <= 1) return;
      trendingPage = (trendingPage + 1) % totalPages;
      renderTrendingPage(trendingPage);
    }, 4000);
  }

  function renderDerivativesCard(derivatives) {
    const totalLiq = derivatives.totalLiquidations || 0;
    const longLiq = derivatives.longLiquidations || 0;
    const shortLiq = derivatives.shortLiquidations || 0;
    let barsHtml = '';
    for (let i = 0; i < 12; i++) {
      const isRed = Math.random() > 0.4;
      const height = Math.floor(Math.random() * 60) + 30;
      const color = isRed ? '#ea3943' : '#16c784';
      barsHtml += `<div class="bar" style="height:${height}%; background:${color};"></div>`;
    }
    const derHtml = `
      <div class="stat-row"><span class="stat-label">All Liquidations (24h)</span><span class="stat-value">${formatCompact(totalLiq)}</span></div>
      <div class="stat-row"><span class="stat-label">Long</span><span class="stat-value text-up">${formatCompact(longLiq)}</span></div>
      <div class="stat-row"><span class="stat-label">Short</span><span class="stat-value text-down">${formatCompact(shortLiq)}</span></div>
      <div class="mini-chart">${barsHtml}</div>
      <div class="ms-bottom">
          <div class="inner-card" style="padding: 8px 12px;"><div class="stat-row" style="margin:0;"><span class="stat-label">Open Interest</span><span class="stat-value">${formatCompact(derivatives.openInterest)}</span></div></div>
          <div class="inner-card" style="padding: 8px 12px;"><div class="stat-row" style="margin:0;"><span class="stat-label">Volume (24h)</span><span class="stat-value">${formatCompact(derivatives.volume24h)}</span></div></div>
      </div>
    `;
    document.getElementById('derivatives-content').innerHTML = derHtml;
  }

  // ==========================================
  // 6. 底部抽屉
  // ==========================================
  window.openCoinDetail = function(coinId) {
    const coin = currentPageData.find(c => String(c.id) === String(coinId));
    if (!coin) return;
    const sheet = document.getElementById('bottom-sheet');
    document.getElementById('sheet-coin-logo').src = `https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png`;
    document.getElementById('sheet-coin-name').textContent = coin.name;
    document.getElementById('sheet-coin-symbol').textContent = coin.symbol;
    document.getElementById('sheet-coin-price').textContent = formatPrice(coin.price);
    const pct24 = coin.percentChange24h || 0;
    const changeEl = document.getElementById('sheet-coin-change');
    changeEl.className = pct24 >= 0 ? 'text-up' : 'text-down';
    changeEl.textContent = `${pct24 >= 0 ? '▲' : '▼'} ${formatPercent(pct24)} (24h)`;
    const p1 = coin.percentChange1h || 0;
    const p7 = coin.percentChange7d || 0;
    document.getElementById('sheet-coin-1h').innerHTML = `<span class="${p1 >= 0 ? 'text-up' : 'text-down'}">${p1 >= 0 ? '▲' : '▼'} ${formatPercent(p1)}</span>`;
    document.getElementById('sheet-coin-7d').innerHTML = `<span class="${p7 >= 0 ? 'text-up' : 'text-down'}">${p7 >= 0 ? '▲' : '▼'} ${formatPercent(p7)}</span>`;
    document.getElementById('sheet-coin-mcap').textContent = formatCompact(coin.marketCap);
    document.getElementById('sheet-coin-vol').textContent = formatCompact(coin.volume24h);
    document.getElementById('sheet-coin-supply').textContent = `${formatSupply(coin.circulatingSupply)} ${coin.symbol}`;
    document.getElementById('sheet-coin-chart').src = `https://s3.coinmarketcap.com/generated/sparklines/web/7d/2781/${coin.id}.svg`;
    sheet.classList.add('show');
  };

  function setupBottomSheet() {
    const sheet = document.getElementById('bottom-sheet');
    document.getElementById('sheet-close').addEventListener('click', () => sheet.classList.remove('show'));
    sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.classList.remove('show'); });
  }

  // ==========================================
  // 7. 表格渲染
  // ==========================================
  let currentPageData = [];
  function renderTable(coins) {
    const tbody = document.getElementById('crypto-tbody');
    if (!tbody) return;
    const pageInfo = document.getElementById('page-info');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const dict = i18nData[currentLang] || i18nData['en'];
    currentPageData = coins;

    if (!coins || coins.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:50px;">${dict.loading}</td></tr>`;
      return;
    }

    let html = '';
    coins.forEach(coin => {
      const rank = coin.rank || coin.cmcRank || '-';
      const name = coin.name || 'Unknown';
      const symbol = coin.symbol || '?';
      const id = coin.id || 0;
      const price = coin.price || 0;
      const p1 = coin.percentChange1h || 0;
      const p24 = coin.percentChange24h || 0;
      const p7 = coin.percentChange7d || 0;
      const mcap = coin.marketCap || 0;
      const vol = coin.volume24h || 0;
      const supply = coin.circulatingSupply || 0;
      const c1 = p1 >= 0 ? 'text-up' : 'text-down';
      const c24 = p24 >= 0 ? 'text-up' : 'text-down';
      const c7 = p7 >= 0 ? 'text-up' : 'text-down';
      const a1 = p1 >= 0 ? '▲' : '▼';
      const a24 = p24 >= 0 ? '▲' : '▼';
      const a7 = p7 >= 0 ? '▲' : '▼';
      html += `
        <tr onclick="window.openCoinDetail(${id})">
          <td>${rank}</td>
          <td><div class="coin-info"><img src="https://s2.coinmarketcap.com/static/img/coins/64x64/${id}.png" onerror="this.src='https://s2.coinmarketcap.com/static/cloud/img/coinmarketcap_1.svg'"/><span class="coin-name">${name}</span><span class="coin-symbol">${symbol}</span></div></td>
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
    if (pageInfo) pageInfo.textContent = `Page ${currentPage}`;
    if (btnPrev) btnPrev.disabled = currentPage === 1;
    if (btnNext) btnNext.disabled = coins.length < PAGE_SIZE;
  }

  async function loadPageData(page) {
    const tbody = document.getElementById('crypto-tbody');
    const dict = i18nData[currentLang] || i18nData['en'];
    if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:50px;color:#616e85;">${dict.loading}</td></tr>`;
    try {
      const start = (page - 1) * PAGE_SIZE + 1;
      const res = await fetch(`${API_BASE}/listing?start=${start}&limit=${PAGE_SIZE}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      renderTable(json.data);
    } catch (e) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:50px;color:#ea3943;">Failed to load: ${e.message}</td></tr>`;
    }
  }

  // ==========================================
  // 8. 初始化
  // ==========================================
  async function init() {
    setupLangSwitcher();
    await initLanguage(); // 确保语言初始化完成后再拉取新闻，虽然新闻接口与语言无关，但避免异步竞争
    
    initCarousel();
    setupBottomSheet();
    renderTopCards();
    loadPageData(currentPage);

    document.getElementById('btn-prev')?.addEventListener('click', () => {
      if (currentPage > 1) { currentPage--; loadPageData(currentPage); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });
    document.getElementById('btn-next')?.addEventListener('click', () => {
      currentPage++; loadPageData(currentPage); window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
