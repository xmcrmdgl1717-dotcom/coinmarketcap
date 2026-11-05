(function () {
  'use strict';

  const API_BASE = 'https://coinmarketcapweb.onrender.com/api';
  // ... (前面的变量和多语言字典保持一致，为节省篇幅省略，请直接用之前的代码) ...

  // ==========================================
  // 核心修复：图表渲染逻辑
  // ==========================================
  async function fetchDetailData(coinId, symbol) {
    try {
      const res = await fetch(`${API_BASE}/detail?symbol=${symbol}`);
      if (!res.ok) throw new Error('API Err');
      const detail = await res.json();

      // 更新价格与闪烁 (略，同上一版)
      const priceEl = document.getElementById('sheet-coin-price');
      const newPrice = detail.price;
      priceEl.classList.remove('price-flash-up', 'price-flash-down');
      if (prevDetailPrice !== null && newPrice !== prevDetailPrice) {
        void priceEl.offsetWidth; 
        priceEl.classList.add(newPrice > prevDetailPrice ? 'price-flash-up' : 'price-flash-down');
      }
      priceEl.textContent = formatPrice(newPrice);
      prevDetailPrice = newPrice;

      // 更新其他数据 (略，同上一版) ...

      // ==========================================
      // 4. 绘制/更新图表 (修复核心)
      // ==========================================
      if (detail.klines && detail.klines.length > 0) {
        const chartContainer = document.getElementById('detail-chart');
        
        // 如果之前是 loading 文本，先清空
        if (chartContainer.querySelector('div')) {
           chartContainer.innerHTML = '';
        }

        // ★ 核心修复：如果容器宽度为 0 (抽屉还没滑出来)，延迟 350ms 等待动画结束再渲染
        if (chartContainer.clientWidth === 0) {
          setTimeout(() => {
            renderChart(detail.klines);
          }, 350);
        } else {
          renderChart(detail.klines);
        }
      } else {
        // 如果 K 线是空的（冷门币没有交易对）
        document.getElementById('detail-chart').innerHTML = `<div style="text-align:center;padding-top:100px;color:#999;">暂无走势图数据</div>`;
      }

    } catch (e) {
      console.warn('内页数据加载失败:', e);
      // 兜底渲染 CMC 静态图 (同上一版)
    }
  }

  // 提取出独立的图表渲染函数
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
      // 增量更新
      const lastCandle = klines[klines.length - 1];
      candleSeries.update(lastCandle);
    }
  }

  // ... (后面是 setupBottomSheet 和 window.addEventListener('resize')，保持上一版即可) ...

  function setupBottomSheet() {
    const sheet = document.getElementById('bottom-sheet');
    const close = () => {
      sheet.classList.remove('show');
      if (chartInstance) { chartInstance.remove(); chartInstance = null; }
      if (detailTimer) { clearInterval(detailTimer); detailTimer = null; }
      currentDetailSymbol = null;
      
      // 关闭时清空图表容器，防止下次打开时尺寸计算错误
      document.getElementById('detail-chart').innerHTML = '';
    };
    document.getElementById('sheet-close').addEventListener('click', close);
    sheet.addEventListener('click', (e) => { if (e.target === e.currentTarget) close(); });
  }

  // 窗口大小改变时调整图表
  window.addEventListener('resize', () => {
    if (chartInstance) {
      const container = document.getElementById('detail-chart');
      if (container.clientWidth > 0) {
        chartInstance.applyOptions({ width: container.clientWidth });
      }
    }
  });

  // ... (后面的 init 代码保持上一版即可) ...
})();
