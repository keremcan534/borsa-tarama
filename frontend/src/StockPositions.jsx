import { useEffect, useMemo, useState } from 'react'
import { t } from './i18n'

function formatWeight(value) {
  if (value == null) return '—'
  return `%${Number(value).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatShares(value, lang) {
  if (value == null) return '—'
  return Math.round(Number(value)).toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR')
}

function monthLabel(month, lang) {
  const [year, value] = month.split('-').map(Number)
  return new Date(Date.UTC(year, value - 1, 1)).toLocaleDateString(
    lang === 'en' ? 'en-US' : 'tr-TR',
    { month: 'short', year: 'numeric', timeZone: 'UTC' },
  )
}

function latestValue(row, metric, months) {
  for (let i = months.length - 1; i >= 0; i -= 1) {
    const point = row.positions?.[months[i]]
    if (point?.[metric] != null) return point[metric]
  }
  return null
}

function previousValue(row, metric, months) {
  let found = 0
  for (let i = months.length - 1; i >= 0; i -= 1) {
    const value = row.positions?.[months[i]]?.[metric]
    if (value == null) continue
    found += 1
    if (found === 2) return value
  }
  return null
}

function trend(row, metric, months) {
  const latest = latestValue(row, metric, months)
  const previous = previousValue(row, metric, months)
  if (latest == null || previous == null) return 0
  const tolerance = metric === 'weight' ? 0.005 : 0.5
  if (latest > previous + tolerance) return 1
  if (latest < previous - tolerance) return -1
  return 0
}

function heatStyle(value, max) {
  if (value == null || !max) return undefined
  const opacity = 0.08 + Math.min(Math.abs(value) / max, 1) * 0.34
  return { background: `rgba(37, 99, 235, ${opacity})` }
}

export default function StockPositions({ data, loading, error, lang }) {
  const stocks = data?.stocks || {}
  const symbols = useMemo(() => Object.keys(stocks).sort(), [stocks])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(() => (stocks.THYAO ? 'THYAO' : symbols[0] || ''))
  const [metric, setMetric] = useState('weight')
  const [newestFirst, setNewestFirst] = useState(true)

  useEffect(() => {
    if (!selected && symbols.length) {
      setSelected(stocks.THYAO ? 'THYAO' : symbols[0])
    }
  }, [selected, stocks, symbols])

  const matches = useMemo(() => {
    const q = query.trim().toUpperCase()
    if (!q) return symbols.slice(0, 20)
    return symbols
      .filter((symbol) => {
        const name = stocks[symbol]?.name || ''
        return symbol.includes(q) || name.toUpperCase().includes(q)
      })
      .slice(0, 30)
  }, [query, stocks, symbols])

  const stock = stocks[selected]
  const sourceMonths = data?.months || []
  const months = newestFirst ? [...sourceMonths].reverse() : sourceMonths

  const rows = useMemo(() => {
    if (!stock) return []
    return [...(stock.funds || [])].sort(
      (a, b) => (latestValue(b, metric, sourceMonths) ?? -1) - (latestValue(a, metric, sourceMonths) ?? -1),
    )
  }, [stock, metric, sourceMonths])

  const summary = useMemo(() => {
    if (!rows.length) return { carrying: 0, average: null, increased: 0, decreased: 0 }
    const current = rows
      .map((row) => latestValue(row, 'weight', sourceMonths))
      .filter((value) => value != null)
    const increased = rows.filter((row) => trend(row, metric, sourceMonths) > 0).length
    const decreased = rows.filter((row) => trend(row, metric, sourceMonths) < 0).length
    return {
      carrying: current.length,
      average: current.length ? current.reduce((sum, value) => sum + value, 0) / current.length : null,
      increased,
      decreased,
    }
  }, [rows, metric, sourceMonths])

  const maxCell = useMemo(() => {
    let max = 0
    for (const row of rows) {
      for (const month of sourceMonths) {
        const value = row.positions?.[month]?.[metric]
        if (value != null) max = Math.max(max, Math.abs(value))
      }
    }
    return max
  }, [rows, metric, sourceMonths])

  if (loading) return <div className="empty-box">{t(lang, 'stockPositionsLoading')}</div>
  if (error) return <div className="error-box">{error}</div>

  return (
    <div className="stock-positions">
      <div className="status-bar">
        <span>{t(lang, 'stockPositionsIntro')}</span>
        {data?.generated_at && (
          <span className="bt-period">
            {t(
              lang,
              'stockPositionsUpdated',
              new Date(data.generated_at).toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR'),
            )}
          </span>
        )}
      </div>

      <section className="sp-section">
        <h2 className="today-title">{t(lang, 'stockPositionsPick')}</h2>
        {/* Veri yokken aramayı göstermek "yaz ama hiçbir şey olmasın" çıkmazıydı */}
        {symbols.length > 0 && (
          <div className="search-row">
            <input
              className="search-input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t(lang, 'stockPositionsSearch')}
            />
          </div>
        )}
        {symbols.length ? (
          <div className="sp-symbols">
            {matches.map((symbol) => (
              <button
                key={symbol}
                type="button"
                className={`fc-chip ${selected === symbol ? 'active' : ''}`}
                onClick={() => {
                  setSelected(symbol)
                  setQuery('')
                }}
                title={stocks[symbol]?.name}
              >
                <strong>{symbol}</strong>
                <span>{stocks[symbol]?.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-box">
            <strong>{t(lang, 'stockPositionsNoDataTitle')}</strong>{' '}
            <span>{t(lang, 'stockPositionsNoData')}</span>
          </div>
        )}
      </section>

      {stock && (
        <>
          <section className="sp-section">
            <div className="sp-heading">
              <div>
                <h2>{selected}</h2>
                <p>{stock.name}</p>
              </div>
              <div className="tabs">
                {['weight', 'shares'].map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`tab ${metric === key ? 'active' : ''}`}
                    onClick={() => setMetric(key)}
                  >
                    {t(lang, key === 'weight' ? 'stockPositionsWeight' : 'stockPositionsShares')}
                  </button>
                ))}
              </div>
            </div>

            <div className="sp-summary">
              <div className="today-card">
                <span className="today-card-label">{t(lang, 'stockPositionsCarrying')}</span>
                <strong className="today-card-value">{summary.carrying}</strong>
              </div>
              <div className="today-card">
                <span className="today-card-label">{t(lang, 'stockPositionsAverage')}</span>
                <strong className="today-card-value">{formatWeight(summary.average)}</strong>
              </div>
              <div className="today-card">
                <span className="today-card-label">{t(lang, 'stockPositionsIncreasing')}</span>
                <strong className="today-card-value pct pos">{summary.increased}</strong>
              </div>
              <div className="today-card">
                <span className="today-card-label">{t(lang, 'stockPositionsDecreasing')}</span>
                <strong className="today-card-value pct neg">{summary.decreased}</strong>
              </div>
              <div className="today-card">
                <span className="today-card-label">{t(lang, 'stockPositionsNet')}</span>
                <strong className={`today-card-value pct ${summary.increased - summary.decreased >= 0 ? 'pos' : 'neg'}`}>
                  {summary.increased - summary.decreased > 0 ? '+' : ''}
                  {summary.increased - summary.decreased}
                </strong>
              </div>
            </div>
          </section>

          <section className="sp-section">
            <div className="today-title">
              <span>{t(lang, 'stockPositionsMatrix')}</span>
              <button className="link-btn" type="button" onClick={() => setNewestFirst((value) => !value)}>
                {newestFirst
                  ? t(lang, 'stockPositionsNewestFirst')
                  : t(lang, 'stockPositionsOldestFirst')}
              </button>
            </div>
            <div className="table-wrap sp-table-wrap">
              <table className="sp-table">
                <thead>
                  <tr>
                    <th className="left">{t(lang, 'colFund')}</th>
                    <th>{t(lang, 'stockPositionsLatest')}</th>
                    <th>{t(lang, 'stockPositionsTrend')}</th>
                    {months.map((month) => (
                      <th key={month}>{monthLabel(month, lang)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const direction = trend(row, metric, sourceMonths)
                    const current = latestValue(row, metric, sourceMonths)
                    return (
                      <tr key={row.fund_code}>
                        <td className="left">
                          <strong>{row.fund_code}</strong>
                          {row.fund_name && <span className="sp-fund-name">{row.fund_name}</span>}
                        </td>
                        <td>{metric === 'weight' ? formatWeight(current) : formatShares(current, lang)}</td>
                        <td>
                          <span className={`sp-trend ${direction > 0 ? 'up' : direction < 0 ? 'down' : ''}`}>
                            {direction > 0 ? '↑' : direction < 0 ? '↓' : '—'}
                          </span>
                        </td>
                        {months.map((month) => {
                          const value = row.positions?.[month]?.[metric]
                          return (
                            <td key={month} style={heatStyle(value, maxCell)}>
                              {metric === 'weight' ? formatWeight(value) : formatShares(value, lang)}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <p className="disclaimer">{t(lang, 'stockPositionsDisclaimer')}</p>
    </div>
  )
}
