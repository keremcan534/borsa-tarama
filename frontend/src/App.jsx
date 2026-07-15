import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { fetchFunds, fetchNews, fetchScreener, STATIC_MODE } from './api'
import { getLang, setLang as persistLang, t } from './i18n'

// Reklam altyapısı: bir reklam ağı (AdSense vb.) bağlanana kadar kapalı.
// Açıldığında AdSlot bileşenleri yayın kodunu render edecek.
const ADS_ENABLED = false

const MARKETS = [
  { key: 'bist100', label: 'BIST 100' },
  { key: 'sp500', label: 'S&P 500' },
  { key: 'etf', label: 'ETF' },
  { key: 'commodity', label: 'Emtia' },
]

const TIMEFRAMES = [
  { key: 'daily', label: 'Günlük', horizon: 'günler–haftalar' },
  { key: 'weekly', label: 'Haftalık', horizon: 'haftalar–aylar' },
  { key: 'monthly', label: 'Aylık', horizon: 'aylar ve ötesi' },
  { key: 'quarterly', label: '3 Aylık', horizon: 'çeyrekler ve ötesi' },
]

// Emtia/kripto: dost isim + TradingView grafik sembolü eşlemesi
const COMMODITY_INFO = {
  'GC=F': { name: 'Altın', tv: 'TVC:GOLD' },
  'SI=F': { name: 'Gümüş', tv: 'TVC:SILVER' },
  'PL=F': { name: 'Platin', tv: 'TVC:PLATINUM' },
  'PA=F': { name: 'Paladyum', tv: 'TVC:PALLADIUM' },
  'HG=F': { name: 'Bakır', tv: 'TVC:COPPER' },
  'CL=F': { name: 'Petrol (WTI)', tv: 'TVC:USOIL' },
  'BZ=F': { name: 'Petrol (Brent)', tv: 'TVC:UKOIL' },
  'NG=F': { name: 'Doğalgaz', tv: 'TVC:NATURALGAS' },
  'BTC-USD': { name: 'Bitcoin', tv: 'BINANCE:BTCUSDT' },
  'ETH-USD': { name: 'Ethereum', tv: 'BINANCE:ETHUSDT' },
}

function displaySymbol(symbol) {
  return COMMODITY_INFO[symbol]?.name || symbol.replace('.IS', '')
}

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
  if (COMMODITY_INFO[symbol]) return COMMODITY_INFO[symbol].tv
  return symbol.endsWith('.IS') ? `BIST:${symbol.replace('.IS', '')}` : symbol
}

function rsiTone(rsi) {
  if (rsi >= 65) return 'hot'
  if (rsi >= 55) return 'warm'
  return 'cool'
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))

// RSI sağlığı 0..1: 55-65 bandında zirve; aşırı alım/satımda düşer
function rsiHealth(rsi) {
  if (rsi >= 55 && rsi <= 65) return 1
  if (rsi > 65) return clamp(1 - (rsi - 65) / 20, 0.2, 1) // 65→1, 85→0.2
  return clamp(0.3 + ((rsi - 30) / 25) * 0.7, 0.3, 1) // 30→0.3, 55→1
}

// Tüm göstergeleri harmanlayan 0-100 teknik güç puanı.
// Trend hizası (40) + MACD momentumu (25) + RSI sağlığı (20) + Stokastik alanı (15)
function technicalScore(s, emaPeriods) {
  const emasAbove = emaPeriods.filter((p) => s.close > s[`ema_${p}`]).length
  const trend = emaPeriods.length ? (emasAbove / emaPeriods.length) * 40 : 0
  const ratio = s.close ? s.macd_line / s.close : 0
  const macd = s.macd_line > 0 ? clamp(ratio / 0.015, 0, 1) * 25 : 0
  const rsi = rsiHealth(s.rsi) * 20
  const stoch = clamp((100 - s.stoch_k) / 100, 0, 1) * 15
  return Math.round(trend + macd + rsi + stoch)
}

function scoreTone(score) {
  if (score >= 75) return 'strong'
  if (score >= 55) return 'good'
  return 'weak'
}

// Ticker/isimden üretilen tutarlı renkli monogram rozeti (harici logo servisi gerektirmez)
function TickerLogo({ symbol }) {
  const t = displaySymbol(symbol)
  const hue = [...t].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)
  return (
    <span className="ticker-logo" style={{ background: `hsl(${hue} 52% 42%)` }} aria-hidden="true">
      {t.slice(0, 2).toUpperCase()}
    </span>
  )
}

const FUND_COLUMNS = [
  { key: 'symbol', label: 'Fon', align: 'left' },
  { key: 'score', label: 'Puan' },
  { key: 'return_1m', label: '1A %' },
  { key: 'return_3m', label: '3A %' },
  { key: 'return_6m', label: '6A %' },
  { key: 'return_1y', label: '1Y %' },
  { key: 'return_ytd', label: 'YTD %' },
  { key: 'volatility', label: 'Vol %' },
  { key: 'sharpe', label: 'Sharpe' },
  { key: 'max_drawdown', label: 'Max DD %' },
  { key: 'portfolio_size', label: 'Büyüklük' },
]

function formatPct(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return '—'
  const pct = value * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(digits)}%`
}

function pctTone(value) {
  if (value == null) return ''
  if (value > 0.02) return 'pos'
  if (value < -0.02) return 'neg'
  return 'flat'
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
                {displaySymbol(item.symbol)}
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
          <strong>{displaySymbol(symbol)}</strong>
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
  const [lang, setLangState] = useState(getLang)
  const [view, setView] = useState('screener')
  const [market, setMarket] = useState('bist100')
  const [timeframe, setTimeframe] = useState('daily')
  const [watchlist, setWatchlist] = useState(loadWatchlist)
  const [onlyWatchlist, setOnlyWatchlist] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS, emas: { ...DEFAULT_FILTERS.emas } })
  const [sort, setSort] = useState({ key: 'score', dir: 'desc' })
  const [search, setSearch] = useState('')
  const [chartSymbol, setChartSymbol] = useState(null)
  const [news, setNews] = useState(null)
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsError, setNewsError] = useState(null)
  const [funds, setFunds] = useState(null)
  const [fundsLoading, setFundsLoading] = useState(false)
  const [fundsError, setFundsError] = useState(null)
  const [fundSort, setFundSort] = useState({ key: 'score', dir: 'desc' })
  const [fundSearch, setFundSearch] = useState('')

  function switchLang() {
    const next = lang === 'tr' ? 'en' : 'tr'
    persistLang(next)
    setLangState(next)
  }

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

  function loadFunds(ignoreRef) {
    setFundsLoading(true)
    setFundsError(null)
    fetchFunds()
      .then((result) => {
        if (!ignoreRef || !ignoreRef.current) setFunds(result)
      })
      .catch((err) => {
        if (!ignoreRef || !ignoreRef.current) setFundsError(err.message)
      })
      .finally(() => {
        if (!ignoreRef || !ignoreRef.current) setFundsLoading(false)
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

  useEffect(() => {
    if (view !== 'funds') return
    if (funds) return
    const ignoreRef = { current: false }
    loadFunds(ignoreRef)
    return () => {
      ignoreRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

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
    const q = search.trim().toUpperCase()
    if (q)
      list = list.filter(
        (s) =>
          s.symbol.toUpperCase().includes(q) || displaySymbol(s.symbol).toUpperCase().includes(q),
      )
    // Her satıra teknik puanı ekle (sıralama ve gösterim için)
    list = list.map((s) => ({ ...s, score: technicalScore(s, availableEmas) }))
    const { key, dir } = sort
    list.sort((a, b) => {
      if (key === 'symbol') {
        return dir === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol)
      }
      const av = a[key] ?? -Infinity
      const bv = b[key] ?? -Infinity
      return dir === 'asc' ? av - bv : bv - av
    })
    return list
  }, [data, filters, availableEmas, onlyWatchlist, watchlist, search, sort])

  const fundRows = useMemo(() => {
    if (!funds?.results) return []
    let list = [...funds.results]
    const q = fundSearch.trim().toUpperCase()
    if (q) {
      list = list.filter(
        (f) =>
          f.symbol.toUpperCase().includes(q) ||
          (f.name || '').toUpperCase().includes(q),
      )
    }
    const { key, dir } = fundSort
    list.sort((a, b) => {
      if (key === 'symbol') {
        return dir === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol)
      }
      const av = a[key] ?? -Infinity
      const bv = b[key] ?? -Infinity
      return dir === 'asc' ? av - bv : bv - av
    })
    return list
  }, [funds, fundSearch, fundSort])

  function toggleSort(key) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'symbol' ? 'asc' : 'desc' },
    )
  }

  function toggleFundSort(key) {
    setFundSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'symbol' ? 'asc' : 'desc' },
    )
  }

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
            <h1>{t(lang, 'brand')}</h1>
            <p className="tagline">
              {t(lang, 'tagline')} · {activeTimeframe.horizon}
            </p>
          </div>
        </div>
        <div className="tab-groups">
          <div className="tabs">
            <button
              className={`tab ${view === 'screener' ? 'active' : ''}`}
              onClick={() => setView('screener')}
            >
              {t(lang, 'tabScreener')}
            </button>
            <button
              className={`tab ${view === 'funds' ? 'active' : ''}`}
              onClick={() => setView('funds')}
            >
              {t(lang, 'tabFunds')}
            </button>
            <button
              className={`tab ${view === 'news' ? 'active' : ''}`}
              onClick={() => setView('news')}
            >
              {t(lang, 'tabNews')}
            </button>
          </div>
          <button className="tab lang-toggle" onClick={switchLang} title="Language / Dil">
            {t(lang, 'langToggle')}
          </button>
          {view === 'screener' && (
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
          )}
          {view === 'screener' && (
            <div className="tabs">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.key}
                  className={`tab ${timeframe === tf.key ? 'active' : ''}`}
                  onClick={() => setTimeframe(tf.key)}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          )}
          {view === 'news' && (
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
          )}
        </div>
      </header>

      {view === 'funds' && (
        <>
          <div className="status-bar">
            <span>
              {funds
                ? t(
                    lang,
                    'fundsStatus',
                    funds.count,
                    funds.generated_at
                      ? new Date(funds.generated_at).toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR')
                      : '',
                  )
                : fundsLoading
                  ? t(lang, 'fundsLoading')
                  : ''}
            </span>
            <div className="actions">
              <button
                className="btn"
                disabled={fundsLoading}
                onClick={() => {
                  setFunds(null)
                  loadFunds()
                }}
              >
                {fundsLoading && <span className="spinner" />}
                {t(lang, 'refresh')}
              </button>
            </div>
          </div>

          <details className="info-panel">
            <summary>{t(lang, 'fundsHowTitle')}</summary>
            <div className="info-content">
              <p>{t(lang, 'fundsHowBody1')}</p>
              <p>
                <strong>{lang === 'en' ? 'Score (0-100):' : 'Puan (0-100):'}</strong>{' '}
                {t(lang, 'fundsHowBody2')}
              </p>
              <p>{t(lang, 'fundsHowBody3')}</p>
            </div>
          </details>

          {!fundsError && funds && (
            <div className="search-row">
              <input
                className="search-input"
                type="search"
                placeholder={t(lang, 'searchFund')}
                value={fundSearch}
                onChange={(e) => setFundSearch(e.target.value)}
              />
            </div>
          )}

          {fundsError && <div className="error-box">{fundsError}</div>}

          {!fundsError && funds && fundRows.length === 0 && (
            <div className="empty-box">
              {fundSearch.trim()
                ? t(lang, 'fundsNoMatch', fundSearch.trim())
                : t(lang, 'fundsEmpty')}
            </div>
          )}

          {!fundsError && fundRows.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {FUND_COLUMNS.map((c) => (
                      <th
                        key={c.key}
                        className={`sortable ${c.align === 'left' ? 'left' : ''} ${fundSort.key === c.key ? 'sorted' : ''}`}
                        onClick={() => toggleFundSort(c.key)}
                      >
                        {c.key === 'symbol'
                          ? t(lang, 'colFund')
                          : c.key === 'score'
                            ? t(lang, 'colScore')
                            : c.key === 'portfolio_size'
                              ? t(lang, 'colSize')
                              : c.label}
                        <span className="sort-arrow">
                          {fundSort.key === c.key ? (fundSort.dir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fundRows.map((f) => (
                    <tr key={f.symbol}>
                      <td className="symbol-cell">
                        <a
                          className="symbol-btn fund-link"
                          href={f.tefas_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={f.name}
                        >
                          <TickerLogo symbol={f.symbol} />
                          <span className="fund-code-wrap">
                            <strong>{f.symbol}</strong>
                            <span className="fund-name">{f.name}</span>
                          </span>
                        </a>
                      </td>
                      <td>
                        <span className={`badge score-${scoreTone(f.score)}`}>{f.score}</span>
                      </td>
                      <td>
                        <span className={`pct ${pctTone(f.return_1m)}`}>{formatPct(f.return_1m)}</span>
                      </td>
                      <td>
                        <span className={`pct ${pctTone(f.return_3m)}`}>{formatPct(f.return_3m)}</span>
                      </td>
                      <td>
                        <span className={`pct ${pctTone(f.return_6m)}`}>{formatPct(f.return_6m)}</span>
                      </td>
                      <td>
                        <span className={`pct ${pctTone(f.return_1y)}`}>{formatPct(f.return_1y)}</span>
                      </td>
                      <td>
                        <span className={`pct ${pctTone(f.return_ytd)}`}>{formatPct(f.return_ytd)}</span>
                      </td>
                      <td>{f.volatility != null ? `${(f.volatility * 100).toFixed(1)}%` : '—'}</td>
                      <td>{f.sharpe != null ? f.sharpe.toFixed(2) : '—'}</td>
                      <td>
                        <span className={`pct ${pctTone(f.max_drawdown)}`}>
                          {formatPct(f.max_drawdown)}
                        </span>
                      </td>
                      <td>{formatMarketCap(f.portfolio_size)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="disclaimer">{t(lang, 'fundDisclaimer')}</p>
        </>
      )}

      {view === 'news' && (
        <>
          <div className="status-bar">
            <span>
              {news
                ? t(
                    lang,
                    'newsStatus',
                    news.items.length,
                    new Date(news.generated_at).toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR'),
                  )
                : ''}
            </span>
          </div>
          <NewsFeed news={news} loading={newsLoading} error={newsError} onOpenChart={setChartSymbol} />
          <p className="disclaimer">{t(lang, 'newsDisclaimer')}</p>
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
            ⭐ {t(lang, 'favorites')}
            {watchlist.size ? ` (${watchlist.size})` : ''}
          </button>
          {STATIC_MODE ? (
            <button className="btn" disabled={loading} onClick={() => load(false)}>
              {loading && <span className="spinner" />}
              {t(lang, 'refresh')}
            </button>
          ) : (
            <>
              <button className="btn" disabled={loading} onClick={() => load(false)}>
                {t(lang, 'refreshCache')}
              </button>
              <button className="btn primary" disabled={loading} onClick={() => load(true)}>
                {loading && <span className="spinner" />}
                {t(lang, 'liveScan')}
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
            <strong>Nasıl oluşuyor?</strong> Seçtiğin kategorideki tüm enstrümanlar (BIST 100'de
            100 hisse, S&P 500'de ~503 hisse, ETF'ler, emtia/kripto) her iş günü piyasa kapanışından
            sonra otomatik taranır. Aşağıdaki kriterlerin <em>hepsini birden</em> sağlayanlar listeye
            girer, kalanlar elenir:
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
          <p>
            <strong>Puan (0-100):</strong> tüm göstergeleri harmanlayan teknik güç puanı — trend
            hizası (fiyatın EMA'lara göre konumu, 40 puan), MACD momentumu (25), RSI sağlığı (20)
            ve stokastik alanı (15). Yüksek puan daha güçlü teknik görünüm demektir; kesinlik
            değil, göreli bir karşılaştırma aracıdır. Sütun başlıklarına tıklayarak her değere
            göre sıralayabilir, arama kutusuyla hisse bulabilirsin.
          </p>
          <p>Hisse koduna tıklayarak grafiği sayfadan ayrılmadan açabilirsin.</p>
        </div>
      </details>

      <details className="info-panel">
        <summary>📖 Göstergeler ne anlama geliyor?</summary>
        <div className="info-content">
          <p>
            <strong>EMA (Üstel Hareketli Ortalama):</strong> Fiyatın belirli bir süredeki
            ortalaması; son günlere daha çok ağırlık verir. Kısa periyot (9, 21) yakın trendi,
            uzun periyot (50, 200) ana trendi gösterir. Fiyatın EMA'ların üstünde olması "yukarı
            trend" işaretidir.
          </p>
          <p>
            <strong>RSI (Göreceli Güç Endeksi, 0-100):</strong> Fiyatın son 14 periyotta ne kadar
            hızlı yükselip düştüğünü ölçer. 70 üstü genelde "aşırı alım" (fazla ısınmış, düzeltme
            gelebilir), 30 altı "aşırı satım" olarak yorumlanır. Biz 70 altını arıyoruz — yükselen
            ama henüz aşırı ısınmamış.
          </p>
          <p>
            <strong>MACD:</strong> İki hareketli ortalamanın farkı; momentumun yönünü ve gücünü
            gösterir. MACD'nin sıfırın üstünde olması kısa vadeli momentumun pozitif (yukarı)
            olduğunu söyler.
          </p>
          <p>
            <strong>Stokastik %K ve Stokastik RSI:</strong> Fiyatın (veya RSI'ın) son dönemdeki
            en yüksek–en düşük aralığında nerede durduğunu 0-100 arası ölçer. 80 üstü aşırı alım
            bölgesidir. İkisini de 80 altında tutarak "yükselişte ama tepe yapmamış" enstrümanları
            seçiyoruz.
          </p>
          <p>
            <strong>Puan (0-100):</strong> Yukarıdaki göstergelerin hepsini tek sayıya indiren
            özet; ne kadar yüksekse teknik görünüm o kadar güçlü. Karşılaştırma kolaylığı içindir,
            kesin bir tahmin değildir.
          </p>
          <p className="muted">
            Bu göstergeler geçmiş fiyat hareketine dayanır; geleceği garanti etmez. Teknik analiz
            olasılık üzerine kuruludur, kesinlik üzerine değil.
          </p>
        </div>
      </details>

      {!error && data && (
        <div className="search-row">
          <input
            className="search-input"
            type="search"
            placeholder={t(lang, 'searchStock')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {error && <div className="error-box">{error}</div>}

      {!error && data && rows.length === 0 && (
        <div className="empty-box">
          {search.trim()
            ? `"${search.trim().toUpperCase()}" için sonuç yok.`
            : isCustom
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
                <th className="star-cell"></th>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className={`sortable ${c.align === 'left' ? 'left' : ''} ${sort.key === c.key ? 'sorted' : ''}`}
                    onClick={() => toggleSort(c.key)}
                    title="Sıralamak için tıkla"
                  >
                    {c.key === 'symbol'
                      ? t(lang, 'colSymbol')
                      : c.key === 'score'
                        ? t(lang, 'colScore')
                        : c.key === 'close'
                          ? t(lang, 'colClose')
                          : c.key === 'market_cap'
                            ? t(lang, 'colMcap')
                            : c.label}
                    <span className="sort-arrow">
                      {sort.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </th>
                ))}
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
                      <TickerLogo symbol={r.symbol} />
                      {displaySymbol(r.symbol)}
                    </button>
                    {newSymbols.has(r.symbol) && <span className="badge new-badge">YENİ</span>}
                  </td>
                  <td>
                    <span className={`badge score-${scoreTone(r.score)}`}>{r.score}</span>
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

      <p className="disclaimer">{t(lang, 'disclaimer')}</p>

      {chartSymbol && (
        <ChartModal symbol={chartSymbol} news={chartNews} onClose={() => setChartSymbol(null)} />
      )}
        </>
      )}
    </>
  )
}

export default App
