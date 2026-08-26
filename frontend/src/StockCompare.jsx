import { useEffect, useMemo, useState } from 'react'
import { t } from './i18n'
import {
  CompareChart,
  LINE_COLORS,
  PERIODS,
  formatMarketCap,
  formatPct,
  normalizeSeries,
  pctTone,
  scoreTone,
  seriesReturn,
  toUsdSeries,
} from './FundCompare'

const MAX_STOCKS = 5

// Hisse karşılaştırma tablosu satırları (fon metrikleri yerine teknik metrikler)
const METRIC_ROWS = [
  { key: 'score', i18nKey: 'colScore', format: 'score' },
  { key: 'close', i18nKey: 'colClose', format: 'price' },
  { key: 'change', i18nKey: 'colChange', format: 'pct' },
  { key: 'relative_strength', label: 'Göreli Güç', format: 'pct' },
  { key: 'rsi', label: 'RSI', format: 'num1' },
  { key: 'market_cap', i18nKey: 'colMcap', format: 'mcap' },
]

function displayCode(symbol) {
  return symbol.replace('.IS', '')
}

function formatMetric(stock, row, lang, scoreOf) {
  // Puan payload'da yoktur; tarama tablosundaki gibi tarayıcıda hesaplanır
  const v = row.key === 'score' ? scoreOf?.(stock) : stock[row.key]
  if (row.format === 'score') return <span className={`badge score-${scoreTone(v)}`}>{v ?? '—'}</span>
  if (row.format === 'pct') return <span className={`pct ${pctTone(v)}`}>{formatPct(v)}</span>
  if (row.format === 'num1') return v == null ? '—' : Number(v).toFixed(1)
  if (row.format === 'price')
    return v == null ? '—' : Number(v).toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (row.format === 'mcap') return formatMarketCap(v)
  return '—'
}

/**
 * BIST hisselerini yan yana karşılaştırır: normalize getiri eğrisi (dönem başı=100),
 * USD bazı seçeneği ve teknik metrik tablosu. FundCompare'in hisse versiyonu;
 * grafik/USD altyapısı oradan yeniden kullanılır.
 */
export default function StockCompare({
  overview,
  prices,
  fx,
  lang,
  loading,
  seedSymbols,
  onNeedSeries,
  scoreOf,
}) {
  // "overview": günlük tarama sonucu (results); "prices": stock_prices.json
  const list = useMemo(() => {
    const rows = []
    for (const payload of Object.values(overview || {})) {
      for (const r of payload.results || []) {
        if (r.symbol?.endsWith('.IS')) rows.push(r)
      }
    }
    // Aynı sembol birden çok markette olmaz ama emniyet için tekilleştir
    const seen = new Set()
    return rows.filter((r) => (seen.has(r.symbol) ? false : seen.add(r.symbol)))
  }, [overview])

  const [selected, setSelected] = useState([])
  const [period, setPeriod] = useState('3m')
  const [query, setQuery] = useState('')
  const [usdBase, setUsdBase] = useState(false)
  const [seeded, setSeeded] = useState(false)

  useEffect(() => {
    if (!list.length || seeded) return
    const seed = (seedSymbols || []).filter((s) => list.some((r) => r.symbol === s))
    setSelected(seed.length ? seed.slice(0, MAX_STOCKS) : list.slice(0, 2).map((r) => r.symbol))
    setSeeded(true)
  }, [list, seedSymbols, seeded])

  // Seçilen sembollerin fiyat serileri sembol başına ayrı dosyada durur ve talep
  // üzerine iner; istenmezse grafik "seri yok" sanılır (kullanıcı testinde görüldü).
  useEffect(() => {
    if (selected.length) onNeedSeries?.(selected)
  }, [selected, onNeedSeries])

  const bySymbol = useMemo(() => {
    const m = new Map()
    for (const r of list) m.set(r.symbol, r)
    return m
  }, [list])

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase()
    if (!q) return list.slice(0, 40)
    return list.filter((r) => r.symbol.includes(q)).slice(0, 40)
  }, [list, query])

  function toggleStock(symbol) {
    setSelected((prev) => {
      if (prev.includes(symbol)) return prev.filter((s) => s !== symbol)
      if (prev.length >= MAX_STOCKS) return prev
      return [...prev, symbol]
    })
  }

  // Kur serisi fx.json'dan gelir (tarama her koşuda üretir); eski toplu fiyat
  // dosyasındaki USDTRY anahtarı yalnızca geriye dönük uyumluluk için denenir.
  const usdPoints =
    fx?.usdtry || prices?.series?.['USDTRY=X'] || prices?.benchmarks?.['USDTRY=X']?.points
  const usdAvailable = Boolean(usdPoints?.length)
  const inUsd = usdBase && usdAvailable

  const chartLines = useMemo(() => {
    const convert = (pts) => (inUsd ? toUsdSeries(pts, usdPoints) : pts)
    const lines = []
    let colorIdx = 0
    for (const sym of selected) {
      const pts = normalizeSeries(convert(prices?.series?.[sym]), period)
      if (!pts.length) continue
      lines.push({
        key: sym,
        label: displayCode(sym),
        color: LINE_COLORS[colorIdx % LINE_COLORS.length],
        points: pts,
        ret: seriesReturn(pts),
      })
      colorIdx += 1
    }
    return lines
  }, [selected, prices, period, inUsd, usdPoints])

  const selectedStocks = selected.map((s) => bySymbol.get(s)).filter(Boolean)

  if (loading) return <div className="empty-box">{t(lang, 'fundCompareLoading')}</div>
  if (!list.length) return <div className="empty-box">{t(lang, 'stockCompareEmpty')}</div>

  return (
    <div className="fund-compare">
      <div className="status-bar">
        <span>{t(lang, 'stockCompareIntro')}</span>
      </div>

      <section className="fc-section">
        <h2 className="today-title">{t(lang, 'stockComparePick')}</h2>
        <div className="search-row">
          <input
            className="search-input"
            type="search"
            placeholder={t(lang, 'stockCompareSearch')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="sp-symbols">
          {filtered.map((r) => (
            <button
              key={r.symbol}
              type="button"
              className={`fc-chip ${selected.includes(r.symbol) ? 'active' : ''}`}
              onClick={() => toggleStock(r.symbol)}
            >
              <strong>{displayCode(r.symbol)}</strong>
            </button>
          ))}
        </div>
        {selected.length > 0 && (
          <div className="fc-selected">
            {selected.map((sym, i) => (
              <button key={sym} type="button" className="fc-selected-item" onClick={() => toggleStock(sym)}>
                <span className="fc-swatch" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
                {displayCode(sym)}
                <span className="fc-remove">✕</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="fc-section">
        <h2 className="today-title">{t(lang, 'fundCompareChartTitle')}</h2>
        <div className="tabs today-tf-tabs">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`tab ${period === p.key ? 'active' : ''}`}
              onClick={() => setPeriod(p.key)}
            >
              {lang === 'en' ? p.labelEn : p.label}
            </button>
          ))}
        </div>

        {usdAvailable && (
          <div className="fc-bench">
            <button
              type="button"
              className={`fc-chip fc-usd ${usdBase ? 'active' : ''}`}
              title={t(lang, 'fcUsdBaseHint')}
              onClick={() => setUsdBase((v) => !v)}
            >
              $ {t(lang, 'fcUsdBase')}
            </button>
          </div>
        )}

        {!prices?.series ? (
          <div className="empty-box">{t(lang, 'stockCompareNoPrices')}</div>
        ) : selected.length === 0 ? (
          <div className="empty-box">{t(lang, 'fundCompareNeedFunds')}</div>
        ) : (
          <>
            <CompareChart lines={chartLines} lang={lang} currency={inUsd ? '$' : '₺'} />
            {chartLines.length > 0 && (
              <div className="fc-legend">
                {chartLines.map((l) => (
                  <span key={l.key} className="fc-legend-item">
                    <span className="fc-swatch" style={{ background: l.color }} />
                    {l.label}
                    <span className={`pct ${pctTone(l.ret)}`}>{formatPct(l.ret)}</span>
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {selectedStocks.length > 0 && (
        <section className="fc-section">
          <h2 className="today-title">{t(lang, 'fundCompareMetrics')}</h2>
          <div className="table-wrap">
            <table className="fc-table">
              <thead>
                <tr>
                  <th className="left">{t(lang, 'fundCompareMetricCol')}</th>
                  {selectedStocks.map((r, i) => (
                    <th key={r.symbol}>
                      <span className="fc-swatch" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
                      {displayCode(r.symbol)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRIC_ROWS.map((row) => (
                  <tr key={row.key}>
                    <td className="left">{row.i18nKey ? t(lang, row.i18nKey) : row.label}</td>
                    {selectedStocks.map((r) => (
                      <td key={r.symbol}>{formatMetric(r, row, lang, scoreOf)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="disclaimer">{t(lang, 'disclaimer')}</p>
    </div>
  )
}
