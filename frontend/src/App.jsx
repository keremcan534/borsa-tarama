import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { fetchNews, fetchScreener, STATIC_MODE } from './api'

// Reklam altyapısı: bir reklam ağı (AdSense vb.) bağlanana kadar kapalı.
// Açıldığında AdSlot bileşenleri yayın kodunu render edecek.
const ADS_ENABLED = false

const MARKETS = [
  { key: 'bist100', label: 'BIST 100' },
  { key: 'sp500', label: 'S&P 500' },
]

const TIMEFRAMES = [
  { key: 'daily', label: 'Günlük', horizon: 'günler–haftalar' },
  { key: 'weekly', label: 'Haftalık', horizon: 'haftalar–aylar' },
  { key: 'monthly', label: 'Aylık', horizon: 'aylar ve ötesi' },
]

const DEFAULT_FILTERS = {
  rsi: 70,
  stochK: 80,
  stochRsiK: 80,
  macdPositive: true,
  emas: { 9: true, 21: true, 50: true, 200: true },
}

function formatMarketCap(value) {
  if (value == null) return '—'
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  return value.toLocaleString('tr-TR')
}

function tvSymbol(symbol) {
  return symbol.endsWith('.IS') ? `BIST:${symbol.replace('.IS', '')}` : symbol
}

function rsiTone(rsi) {
  if (rsi >= 65) return 'hot'
  if (rsi >= 55) return 'warm'
  return 'cool'
}

function formatRelativeTime(iso) {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 60) return `${Math.max(mins, 1)} dk önce`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} sa önce`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} gün önce`
  return new Date(iso).toLocaleDateString('tr-TR')
}

function AdSlot({ id }) {
  // Reklam ağı bağlanana kadar hiçbir şey render edilmez (sahte reklam yok).
  if (!ADS_ENABLED) return null
  return <div className="ad-slot" data-slot={id} />
}

function stockPassesFilters(stock, filters, availableEmas) {
  for (const p of availableEmas) {
    if (filters.emas[p] && !(stock.close > stock[`ema_${p}`])) return false
  }
  if (filters.macdPositive && !(stock.macd_line > 0)) return false
  if (!(stock.rsi < filters.rsi)) return false
  if (!(stock.stoch_k < filters.stochK)) return false
  if (!(stock.stoch_rsi_k < filters.stochRsiK)) return false
  return true
}

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="9" fill="url(#lg)" />
      <rect x="9" y="21" width="5" height="10" rx="1.5" fill="white" opacity="0.9" />
      <rect x="17.5" y="15" width="5" height="16" rx="1.5" fill="white" opacity="0.9" />
      <rect x="26" y="9" width="5" height="22" rx="1.5" fill="white" opacity="0.9" />
    </svg>
  )
}

function NewsFeed({ news, loading, error, onOpenChart }) {
  if (loading) return <div className="empty-box">Haberler yükleniyor...</div>
  if (error) return <div className="error-box">{error}</div>
  if (!news || news.items.length === 0)
    return <div className="empty-box">Şu an gösterilecek haber yok. Haberler her taramayla birlikte yenilenir.</div>

  return (
    <div className="news-list">
      {news.items.map((item, i) => (
        <div key={item.link + i}>
          <article className="news-item">
            <div className="news-meta">
              <button className="chip" onClick={() => onOpenChart(item.symbol)}>
                {item.symbol.replace('.IS', '')}
              </button>
              {item.source && <span className="news-source">{item.source}</span>}
              <span className="news-time">{formatRelativeTime(item.published_at)}</span>
            </div>
            <a className="news-title" href={item.link} target="_blank" rel="noreferrer noopener">
              {item.title}
            </a>
          </article>
          {(i + 1) % 6 === 0 && <AdSlot id={`news-${i}`} />}
        </div>
      ))}
    </div>
  )
}

function ChartModal({ symbol, news, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  const src =
    'https://s.tradingview.com/widgetembed/?' +
    new URLSearchParams({
      symbol: tvSymbol(symbol),
      interval: 'D',
      theme: dark ? 'dark' : 'light',
      locale: 'tr',
      hidesidetoolbar: '1',
      allow_symbol_change: '0',
    }).toString()

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>{symbol}</strong>
          <div className="modal-actions">
            <a
              className="btn small"
              href={`https://tr.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol(symbol))}`}
              target="_blank"
              rel="noreferrer"
            >
              TradingView'da aç ↗
            </a>
            <button className="btn small" onClick={onClose}>
              Kapat ✕
            </button>
          </div>
        </div>
        <iframe title={`${symbol} grafiği`} src={src} className="chart-frame" />
        {news && news.length > 0 && (
          <div className="modal-news">
            <div className="modal-news-title">📰 Son haberler</div>
            {news.slice(0, 3).map((item, i) => (
              <a
                key={item.link + i}
                className="modal-news-item"
                href={item.link}
                target="_blank"
                rel="noreferrer noopener"
              >
                <span className="news-time">{formatRelativeTime(item.published_at)}</span> {item.title}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FilterPanel({ filters, setFilters, availableEmas, isCustom }) {
  const slider = (label, key, value) => (
    <label className="slider-row">
      <span className="slider-label">
        {label} <b>&lt; {value}</b>
      </span>
      <input
        type="range"
        min="10"
        max="100"
        step="5"
        value={value}
        onChange={(e) => setFilters({ ...filters, [key]: Number(e.target.value) })}
      />
    </label>
  )

  return (
    <details className="filter-panel">
      <summary>
        ⚙️ Filtre Ayarları
        {isCustom && <span className="badge custom">özel</span>}
      </summary>
      <div className="filter-grid">
        <div className="filter-group">
          <div className="filter-title">Aşırı alım eşikleri</div>
          {slider('RSI', 'rsi', filters.rsi)}
          {slider('Stokastik %K', 'stochK', filters.stochK)}
          {slider('Stokastik RSI %K', 'stochRsiK', filters.stochRsiK)}
        </div>
        <div className="filter-group">
          <div className="filter-title">Trend şartları</div>
          <div className="check-row">
            {[9, 21, 50, 200].map((p) => (
              <label key={p} className={`check ${availableEmas.includes(p) ? '' : 'disabled'}`}>
                <input
                  type="checkbox"
                  disabled={!availableEmas.includes(p)}
                  checked={availableEmas.includes(p) ? filters.emas[p] : false}
                  onChange={(e) =>
                    setFilters({ ...filters, emas: { ...filters.emas, [p]: e.target.checked } })
                  }
                />
                Fiyat &gt; EMA{p}
              </label>
            ))}
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={filters.macdPositive}
              onChange={(e) => setFilters({ ...filters, macdPositive: e.target.checked })}
            />
            MACD &gt; 0
          </label>
          <button
            className="btn small"
            onClick={() => setFilters({ ...DEFAULT_FILTERS, emas: { ...DEFAULT_FILTERS.emas } })}
          >
            Varsayılana dön
          </button>
        </div>
      </div>
    </details>
  )
}

function loadWatchlist() {
  try {
    return new Set(JSON.parse(localStorage.getItem('watchlist') || '[]'))
  } catch {
    return new Set()
  }
}

function App() {
  const [view, setView] = useState('screener')
  const [market, setMarket] = useState('bist100')
  const [timeframe, setTimeframe] = useState('daily')
  const [watchlist, setWatchlist] = useState(loadWatchlist)
  const [onlyWatchlist, setOnlyWatchlist] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS, emas: { ...DEFAULT_FILTERS.emas } })
  const [chartSymbol, setChartSymbol] = useState(null)
  const [news, setNews] = useState(null)
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsError, setNewsError] = useState(null)

  function load(live, ignoreRef) {
    setLoading(true)
    setError(null)
    fetchScreener(market, { live, timeframe })
      .then((result) => {
        if (!ignoreRef || !ignoreRef.current) setData(result)
      })
      .catch((err) => {
        if (!ignoreRef || !ignoreRef.current) setError(err.message)
      })
      .finally(() => {
        if (!ignoreRef || !ignoreRef.current) setLoading(false)
      })
  }

  useEffect(() => {
    const ignoreRef = { current: false }
    setData(null)
    load(false, ignoreRef)
    return () => {
      ignoreRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, timeframe])

  // Haberler: market değişince sıfırla, sekme açılınca veya grafik modalı için lazily yükle
  useEffect(() => {
    setNews(null)
    setNewsError(null)
  }, [market])

  useEffect(() => {
    if (view !== 'news' && !chartSymbol) return
    if (news) return // bu market için zaten yüklü (market değişince sıfırlanır)
    let ignore = false
    setNewsLoading(true)
    setNewsError(null)
    fetchNews(market)
      .then((result) => {
        if (!ignore) setNews(result)
      })
      .catch((err) => {
        if (!ignore) setNewsError(err.message)
      })
      .finally(() => setNewsLoading(false))
    return () => {
      ignore = true
    }
  }, [view, chartSymbol, market, news])

  const activeTimeframe = TIMEFRAMES.find((t) => t.key === timeframe)
  const chartNews = useMemo(() => {
    if (!chartSymbol || !news) return null
    return news.items.filter((n) => n.symbol === chartSymbol)
  }, [chartSymbol, news])
  const availableEmas = data?.ema_periods || (timeframe === 'monthly' ? [9, 21, 50] : [9, 21, 50, 200])

  const isCustom = useMemo(() => {
    if (
      filters.rsi !== DEFAULT_FILTERS.rsi ||
      filters.stochK !== DEFAULT_FILTERS.stochK ||
      filters.stochRsiK !== DEFAULT_FILTERS.stochRsiK ||
      filters.macdPositive !== DEFAULT_FILTERS.macdPositive
    )
      return true
    return availableEmas.some((p) => !filters.emas[p])
  }, [filters, availableEmas])

  const rows = useMemo(() => {
    if (!data) return []
    let list = data.stocks
      ? data.stocks.filter((s) => stockPassesFilters(s, filters, availableEmas))
      : data.results // eski veri formatı: yalnızca varsayılan filtre sonuçları
    if (onlyWatchlist) list = list.filter((s) => watchlist.has(s.symbol))
    return list
  }, [data, filters, availableEmas, onlyWatchlist, watchlist])

  // Yeni sinyal bilgisi results üzerinde gelir; stocks listesinde göstermek için haritalanır
  const newSymbols = useMemo(
    () => new Set((data?.results || []).filter((r) => r.is_new).map((r) => r.symbol)),
    [data],
  )

  function toggleWatch(symbol) {
    setWatchlist((prev) => {
      const next = new Set(prev)
      if (next.has(symbol)) next.delete(symbol)
      else next.add(symbol)
      localStorage.setItem('watchlist', JSON.stringify([...next]))
      return next
    })
  }

  return (
    <>
      <header className="header">
        <div className="brand">
          <Logo />
          <div>
            <h1>Borsa Tarama</h1>
            <p className="tagline">Teknik görünümü güçlü hisseler · {activeTimeframe.horizon}</p>
          </div>
        </div>
        <div className="tab-groups">
          <div className="tabs">
            <button
              className={`tab ${view === 'screener' ? 'active' : ''}`}
              onClick={() => setView('screener')}
            >
              Tarama
            </button>
            <button
              className={`tab ${view === 'news' ? 'active' : ''}`}
              onClick={() => setView('news')}
            >
              📰 Haberler
            </button>
          </div>
          <div className="tabs">
            {MARKETS.map((m) => (
              <button
                key={m.key}
                className={`tab ${market === m.key ? 'active' : ''}`}
                onClick={() => setMarket(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
          {view === 'screener' && (
            <div className="tabs">
              {TIMEFRAMES.map((t) => (
                <button
                  key={t.key}
                  className={`tab ${timeframe === t.key ? 'active' : ''}`}
                  onClick={() => setTimeframe(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {view === 'news' && (
        <>
          <div className="status-bar">
            <span>
              {news
                ? `${news.items.length} başlık · Sinyal veren hisselerin haberleri · Güncelleme: ${new Date(news.generated_at).toLocaleString('tr-TR')}`
                : ''}
            </span>
          </div>
          <NewsFeed news={news} loading={newsLoading} error={newsError} onOpenChart={setChartSymbol} />
          <p className="disclaimer">
            Haber başlıkları kaynaklarına aittir ve kaynağa yönlendirir. Yatırım tavsiyesi değildir.
          </p>
          {chartSymbol && (
            <ChartModal symbol={chartSymbol} news={chartNews} onClose={() => setChartSymbol(null)} />
          )}
        </>
      )}

      {view === 'screener' && (
        <>
      <div className="status-bar">
        <span>
          {data
            ? `${data.scanned ?? '?'} hisse tarandı, ${rows.length} tanesi kriterleri geçti${
                data.generated_at
                  ? ` · Son tarama: ${new Date(data.generated_at).toLocaleString('tr-TR')}`
                  : ''
              }`
            : loading
              ? 'Yükleniyor...'
              : ''}
        </span>
        <div className="actions">
          <button
            className={`btn ${onlyWatchlist ? 'primary' : ''}`}
            title="Sadece favori hisseleri göster"
            onClick={() => setOnlyWatchlist((v) => !v)}
          >
            ⭐ Favoriler{watchlist.size ? ` (${watchlist.size})` : ''}
          </button>
          {STATIC_MODE ? (
            <button className="btn" disabled={loading} onClick={() => load(false)}>
              {loading && <span className="spinner" />}
              Yenile
            </button>
          ) : (
            <>
              <button className="btn" disabled={loading} onClick={() => load(false)}>
                Cache'ten Yenile
              </button>
              <button className="btn primary" disabled={loading} onClick={() => load(true)}>
                {loading && <span className="spinner" />}
                Canlı Tara
              </button>
            </>
          )}
        </div>
      </div>

      {data?.stocks && (
        <FilterPanel
          filters={filters}
          setFilters={setFilters}
          availableEmas={availableEmas}
          isCustom={isCustom}
        />
      )}

      <details className="info-panel">
        <summary>Bu liste nasıl oluşuyor? Ne kadar süre geçerli?</summary>
        <div className="info-content">
          <p>
            <strong>Nasıl oluşuyor?</strong> Endeksteki hisselerin <em>tamamı</em> (BIST 100'de 100,
            S&P 500'de ~503 hisse) her iş günü piyasa kapanışından sonra otomatik taranır. Aşağıdaki
            kriterlerin <em>hepsini birden</em> sağlayanlar listeye girer, kalanlar elenir:
          </p>
          <ul>
            <li>Fiyat 9, 21, 50 ve 200 periyotluk üstel ortalamaların (EMA) üzerinde → güçlü yükseliş trendi</li>
            <li>MACD &gt; 0 → momentum pozitif</li>
            <li>RSI &lt; 70, Stokastik %K &lt; 80, Stokastik RSI &lt; 80 → henüz aşırı alım bölgesinde değil</li>
            <li>Ortalama günlük işlem hacmi (ciro) yeterli → düşük likiditeli hisseler elenir</li>
          </ul>
          <p>
            Eşikleri "Filtre Ayarları" panelinden kendine göre değiştirebilirsin — liste anında
            güncellenir, varsayılanlara tek tıkla dönebilirsin.
          </p>
          <p>
            <strong>Zaman dilimleri:</strong> aynı kriterler seçtiğin zaman diliminin mumlarıyla
            hesaplanır. <em>Günlük</em> sinyaller günler–haftalar, <em>Haftalık</em> sinyaller
            haftalar–aylar, <em>Aylık</em> sinyaller aylar ve ötesi ölçeğinde anlamlıdır. Uzun
            zaman dilimlerinde kriterleri geçen hisse sayısı doğal olarak azalır. Aylık görünümde
            EMA200 yerine 9/21/50 kullanılır (çoğu hissede 17 yıllık veri bulunmadığından) ve en az
            5 yıllık geçmişi olan hisseler taranabilir. Haftalık ve aylık sinyaller yalnızca{' '}
            <em>kapanmış</em> mumlara dayanır: içinde bulunulan haftanın/ayın tamamlanmamış mumu
            hesaba katılmaz, böylece sinyaller mum kapanana kadar değişkenlik göstermez.
          </p>
          <p>
            <strong>Ne kadar geçerli?</strong> Bunlar kapanış verisine dayalı <em>momentum</em>{' '}
            sinyalleridir; kalıcı bir "al ve unut" analizi değildir. Liste her iş günü iki kez
            (BIST ve ABD kapanışları sonrası) otomatik yenilenir — güncel listeyi takip etmek en
            sağlıklısıdır.
          </p>
          <p>Hisse koduna tıklayarak grafiği sayfadan ayrılmadan açabilirsin.</p>
        </div>
      </details>

      {error && <div className="error-box">{error}</div>}

      {!error && data && rows.length === 0 && (
        <div className="empty-box">
          {isCustom
            ? 'Bu filtre ayarlarıyla hiçbir hisse kriterleri geçmiyor. Eşikleri gevşetmeyi veya "Varsayılana dön"ü dene.'
            : STATIC_MODE
              ? 'Son taramada filtreyi geçen hisse çıkmadı. Sonuçlar her gün piyasa kapanışlarından sonra güncellenir.'
              : 'Şu an filtreyi geçen hisse yok. "Canlı Tara" ile tekrar dene ya da daha sonra kontrol et.'}
        </div>
      )}

      {!error && data && rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Sembol</th>
                <th>Kapanış</th>
                <th>Piyasa Değeri</th>
                <th>RSI</th>
                <th>MACD</th>
                <th>Stoch %K</th>
                <th>Stoch RSI %K</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.symbol}>
                  <td className="star-cell">
                    <button
                      className={`star-btn ${watchlist.has(r.symbol) ? 'active' : ''}`}
                      title={watchlist.has(r.symbol) ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                      onClick={() => toggleWatch(r.symbol)}
                    >
                      {watchlist.has(r.symbol) ? '★' : '☆'}
                    </button>
                  </td>
                  <td className="symbol-cell">
                    <button className="symbol-btn" onClick={() => setChartSymbol(r.symbol)}>
                      {r.symbol}
                    </button>
                    {newSymbols.has(r.symbol) && <span className="badge new-badge">YENİ</span>}
                  </td>
                  <td>{r.close.toLocaleString('tr-TR')}</td>
                  <td>{formatMarketCap(r.market_cap)}</td>
                  <td>
                    <span className={`badge rsi-${rsiTone(r.rsi)}`}>{r.rsi.toFixed(1)}</span>
                  </td>
                  <td>{r.macd_line.toFixed(2)}</td>
                  <td>{r.stoch_k.toFixed(1)}</td>
                  <td>{r.stoch_rsi_k.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="disclaimer">
        Bu uygulama yalnızca teknik göstergelere dayalı veri sunar; yatırım tavsiyesi değildir.
      </p>

      {chartSymbol && (
        <ChartModal symbol={chartSymbol} news={chartNews} onClose={() => setChartSymbol(null)} />
      )}
        </>
      )}
    </>
  )
}

export default App
