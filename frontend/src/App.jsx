import { useEffect, useState } from 'react'
import './App.css'
import { fetchScreener, STATIC_MODE } from './api'

const MARKETS = [
  { key: 'bist100', label: 'BIST 100' },
  { key: 'sp500', label: 'S&P 500' },
]

function formatMarketCap(value) {
  if (value == null) return '—'
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  return value.toLocaleString('tr-TR')
}

function App() {
  const [market, setMarket] = useState('bist100')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function load(live, ignoreRef) {
    setLoading(true)
    setError(null)
    fetchScreener(market, { live })
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
  }, [market])

  return (
    <>
      <div className="header">
        <h1>Borsa Tarama</h1>
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
      </div>

      <div className="status-bar">
        <span>
          {data
            ? `${data.count} hisse bulundu${
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
                  <td className="symbol-cell">{r.symbol}</td>
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
    </>
  )
}

export default App
