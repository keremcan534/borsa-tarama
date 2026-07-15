import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { fetchScreener, STATIC_MODE } from './api'

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

function ChartModal({ symbol, onClose }) {
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

function App() {
  const [market, setMarket] = useState('bist100')
  const [timeframe, setTimeframe] = useState('daily')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS, emas: { ...DEFAULT_FILTERS.emas } })
  const [chartSymbol, setChartSymbol] = useState(null)

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

  const activeTimeframe = TIMEFRAMES.find((t) => t.key === timeframe)
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
    if (data.stocks) return data.stocks.filter((s) => stockPassesFilters(s, filters, availableEmas))
    return data.results // eski veri formatı: yalnızca varsayılan filtre sonuçları
  }, [data, filters, availableEmas])

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
        </div>
      </header>

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
                  <td className="symbol-cell">
                    <button className="symbol-btn" onClick={() => setChartSymbol(r.symbol)}>
                      {r.symbol}
                    </button>
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

      {chartSymbol && <ChartModal symbol={chartSymbol} onClose={() => setChartSymbol(null)} />}
    </>
  )
}

export default App
