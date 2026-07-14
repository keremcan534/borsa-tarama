import { useEffect, useState } from 'react'
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

function formatMarketCap(value) {
  if (value == null) return '—'
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  return value.toLocaleString('tr-TR')
}

function chartUrl(symbol) {
  const tvSymbol = symbol.endsWith('.IS') ? `BIST:${symbol.replace('.IS', '')}` : symbol
  return `https://tr.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`
}

function App() {
  const [market, setMarket] = useState('bist100')
  const [timeframe, setTimeframe] = useState('daily')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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

  return (
    <>
      <div className="header">
        <h1>Borsa Tarama</h1>
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
      </div>

      <div className="status-bar">
        <span>
          {data
            ? `${data.scanned ? `${data.scanned} hisse tarandı, ` : ''}${data.count} tanesi kriterleri geçti · Sinyal ufku: ${activeTimeframe.horizon}${
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
          </ul>
          <p>
            <strong>Zaman dilimleri:</strong> aynı kriterler seçtiğin zaman diliminin mumlarıyla
            hesaplanır. <em>Günlük</em> sinyaller günler–haftalar, <em>Haftalık</em> sinyaller
            haftalar–aylar, <em>Aylık</em> sinyaller aylar ve ötesi ölçeğinde anlamlıdır. Uzun
            zaman dilimlerinde kriterleri geçen hisse sayısı doğal olarak azalır. Aylık görünümde
            EMA200 yerine 9/21/50 kullanılır (çoğu hissede 17 yıllık veri bulunmadığından) ve en az
            5 yıllık geçmişi olan hisseler taranabilir.
          </p>
          <p>
            <strong>Ne kadar geçerli?</strong> Bunlar kapanış verisine dayalı <em>momentum</em>{' '}
            sinyalleridir; kalıcı bir "al ve unut" analizi değildir. Liste her iş günü iki kez
            (BIST ve ABD kapanışları sonrası) otomatik yenilenir — güncel listeyi takip etmek en
            sağlıklısıdır.
          </p>
          <p>Hisse koduna tıklayarak detaylı grafiğe ulaşabilirsin.</p>
        </div>
      </details>

      {error && <div className="error-box">{error}</div>}

      {!error && data && data.results.length === 0 && (
        <div className="empty-box">
          {STATIC_MODE
            ? 'Son taramada filtreyi geçen hisse çıkmadı. Sonuçlar her gün piyasa kapanışlarından sonra güncellenir.'
            : 'Şu an filtreyi geçen hisse yok. "Canlı Tara" ile tekrar dene ya da daha sonra kontrol et.'}
        </div>
      )}

      {!error && data && data.results.length > 0 && (
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
              {data.results.map((r) => (
                <tr key={r.symbol}>
                  <td className="symbol-cell">
                    <a href={chartUrl(r.symbol)} target="_blank" rel="noreferrer">
                      {r.symbol}
                    </a>
                  </td>
                  <td>{r.close.toLocaleString('tr-TR')}</td>
                  <td>{formatMarketCap(r.market_cap)}</td>
                  <td>{r.rsi.toFixed(1)}</td>
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
    </>
  )
}

export default App
