import { useEffect, useMemo, useState } from 'react'
import { t } from './i18n'

const MAX_FUNDS = 5

const PERIODS = [
  { key: '1w', days: 7, label: '1H', labelEn: '1W' },
  { key: '1m', days: 30, label: '1A', labelEn: '1M' },
  { key: '3m', days: 90, label: '3A', labelEn: '3M' },
  { key: '6m', days: 180, label: '6A', labelEn: '6M' },
  { key: 'ytd', days: null, label: 'YTD', labelEn: 'YTD' },
  { key: '1y', days: 365, label: '1Y', labelEn: '1Y' },
]

const LINE_COLORS = ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#0891b2', '#be185d']

const METRIC_ROWS = [
  { key: 'score', i18nKey: 'colScore', format: 'score' },
  { key: 'return_1d', label: '1G %', format: 'pct' },
  { key: 'return_1m', label: '1A %', format: 'pct' },
  { key: 'return_3m', label: '3A %', format: 'pct' },
  { key: 'return_6m', label: '6A %', format: 'pct' },
  { key: 'return_ytd', label: 'YTD %', format: 'pct' },
  { key: 'return_1y', label: '1Y %', format: 'pct' },
  { key: 'volatility', label: 'Vol %', format: 'vol' },
  { key: 'sharpe', label: 'Sharpe', format: 'num' },
  { key: 'max_drawdown', label: 'Max DD %', format: 'pct' },
  { key: 'investor_count', i18nKey: 'colInvestors', format: 'int' },
  { key: 'portfolio_size', i18nKey: 'colSize', format: 'mcap' },
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

function formatMarketCap(value) {
  if (value == null) return '—'
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  return value.toLocaleString('tr-TR')
}

function scoreTone(score) {
  if (score >= 75) return 'strong'
  if (score >= 55) return 'good'
  return 'weak'
}

function periodStartMs(periodKey, lastMs) {
  const p = PERIODS.find((x) => x.key === periodKey)
  if (!p) return lastMs - 90 * 86400000
  if (p.key === 'ytd') {
    const d = new Date(lastMs)
    return Date.UTC(d.getUTCFullYear(), 0, 1)
  }
  return lastMs - p.days * 86400000
}

/** [[date, price], ...] → dönem başından normalize edilmiş [{t, v, px}] (başlangıç=100). */
function normalizeSeries(points, periodKey) {
  if (!points?.length) return []
  const parsed = points
    .map(([d, p]) => ({ t: Date.parse(d), px: Number(p) }))
    .filter((x) => Number.isFinite(x.t) && Number.isFinite(x.px) && x.px > 0)
    .sort((a, b) => a.t - b.t)
  if (!parsed.length) return []

  const last = parsed[parsed.length - 1].t
  const start = periodStartMs(periodKey, last)
  const window = parsed.filter((x) => x.t >= start)
  if (window.length < 2) return []

  const base = window[0].px
  if (base <= 0) return []
  return window.map((x) => ({ t: x.t, px: x.px, v: (x.px / base) * 100 }))
}

function seriesReturn(norm) {
  if (!norm?.length) return null
  return norm[norm.length - 1].v / 100 - 1
}

function formatPrice(value, lang, currency = '₺') {
  if (value == null || Number.isNaN(value)) return '—'
  return `${Number(value).toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })} ${currency}`
}

/**
 * TL serisini gün gün USDTRY kuruna bölerek USD bazına çevirir. Kur, o güne
 * (veya öncesindeki son işlem gününe) ait değerdir; iki liste de tarih sıralıdır.
 */
function toUsdSeries(points, usdPoints) {
  if (!points?.length || !usdPoints?.length) return points
  const out = []
  let i = 0
  let rate = null
  for (const [d, p] of points) {
    while (i < usdPoints.length && usdPoints[i][0] <= d) {
      rate = usdPoints[i][1]
      i += 1
    }
    if (rate > 0) out.push([d, p / rate])
  }
  return out
}

function nearestPoint(points, t) {
  if (!points?.length) return null
  let best = points[0]
  let bestDist = Math.abs(points[0].t - t)
  for (let i = 1; i < points.length; i += 1) {
    const dist = Math.abs(points[i].t - t)
    if (dist < bestDist) {
      best = points[i]
      bestDist = dist
    }
  }
  return best
}

function CompareChart({ lines, lang, currency = '₺' }) {
  const W = 720
  const H = 280
  const pad = { t: 16, r: 16, b: 28, l: 44 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b
  const [hover, setHover] = useState(null)

  const all = lines.flatMap((l) => l.points)
  if (all.length < 2) {
    return <div className="empty-box">{t(lang, 'fundCompareNoChart')}</div>
  }

  const minT = Math.min(...all.map((p) => p.t))
  const maxT = Math.max(...all.map((p) => p.t))
  const minV = Math.min(...all.map((p) => p.v))
  const maxV = Math.max(...all.map((p) => p.v))
  const vPad = Math.max((maxV - minV) * 0.08, 0.5)
  const lo = minV - vPad
  const hi = maxV + vPad

  const x = (t) => pad.l + ((t - minT) / (maxT - minT || 1)) * innerW
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * innerH
  const tFromX = (px) => minT + ((px - pad.l) / (innerW || 1)) * (maxT - minT)

  const gridVals = [lo, (lo + hi) / 2, hi]
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')

  function onMove(event) {
    const svg = event.currentTarget
    const rect = svg.getBoundingClientRect()
    const scaleX = W / rect.width
    // Fare ve dokunma (parmak) olaylarının ikisini de destekle: mobilde
    // onMouseMove tetiklenmez, koordinat touches[0]'dan gelir. Sayfanın
    // kaymaması CSS'teki touch-action:none ile sağlanır (passive listener'da
    // preventDefault çalışmaz).
    const source = event.touches?.[0] || event.changedTouches?.[0] || event
    if (source.clientX == null) return
    const px = (source.clientX - rect.left) * scaleX
    if (px < pad.l || px > W - pad.r) {
      setHover(null)
      return
    }
    const targetT = tFromX(px)
    const samples = lines
      .map((line) => {
        const point = nearestPoint(line.points, targetT)
        if (!point) return null
        return {
          key: line.key,
          label: line.label,
          color: line.color,
          t: point.t,
          v: point.v,
          px: point.px,
          ret: point.v / 100 - 1,
        }
      })
      .filter(Boolean)
    if (!samples.length) {
      setHover(null)
      return
    }
    // En yakın ortak tarihe hizala (günlük serilerde genelde aynı gün).
    samples.sort((a, b) => Math.abs(a.t - targetT) - Math.abs(b.t - targetT))
    const focusT = samples[0].t
    const focused = samples
      .map((s) => {
        const point = nearestPoint(lines.find((l) => l.key === s.key)?.points, focusT)
        if (!point || Math.abs(point.t - focusT) > 2 * 86400000) return null
        return { ...s, t: point.t, v: point.v, px: point.px, ret: point.v / 100 - 1 }
      })
      .filter(Boolean)
    setHover({
      t: focusT,
      x: x(focusT),
      items: focused,
    })
  }

  const locale = lang === 'en' ? 'en-US' : 'tr-TR'
  // Tooltip'i imlecin bulunduğu noktaya sabitle; sağ yarıdaysa kendi genişliği
  // kadar sola çevir ki ekrandan (özellikle mobilde) taşmasın.
  const tipPct = hover ? (hover.x / W) * 100 : 0
  const tipFlip = hover ? hover.x > W * 0.5 : false

  return (
    <div className="fc-chart-wrap">
      <svg
        className="fc-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t(lang, 'fundCompareChartLabel')}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onTouchStart={onMove}
        onTouchMove={onMove}
      >
        {gridVals.map((v) => (
          <g key={v}>
            <line className="fc-grid" x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} />
            <text className="fc-axis" x={pad.l - 6} y={y(v) + 3} textAnchor="end">
              {v.toFixed(0)}
            </text>
          </g>
        ))}
        <line className="fc-baseline" x1={pad.l} x2={W - pad.r} y1={y(100)} y2={y(100)} />
        {lines.map((line) => (
          <path key={line.key} className="fc-line" d={path(line.points)} stroke={line.color} fill="none" />
        ))}
        {hover && (
          <g className="fc-crosshair" pointerEvents="none">
            <line x1={hover.x} x2={hover.x} y1={pad.t} y2={H - pad.b} />
            {hover.items.map((item) => (
              <circle key={item.key} cx={hover.x} cy={y(item.v)} r="4" fill={item.color} stroke="#fff" strokeWidth="1.5" />
            ))}
          </g>
        )}
        <text className="fc-axis" x={pad.l} y={H - 6}>
          {new Date(minT).toLocaleDateString(locale)}
        </text>
        <text className="fc-axis" x={W - pad.r} y={H - 6} textAnchor="end">
          {new Date(maxT).toLocaleDateString(locale)}
        </text>
      </svg>
      {hover && (
        <div
          className="fc-tooltip"
          style={{
            left: `${tipPct}%`,
            top: '18px',
            transform: tipFlip ? 'translateX(calc(-100% - 14px))' : 'translateX(14px)',
          }}
        >
          <div className="fc-tooltip-date">
            {new Date(hover.t).toLocaleDateString(locale, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </div>
          {hover.items.map((item) => (
            <div key={item.key} className="fc-tooltip-row">
              <span className="fc-swatch" style={{ background: item.color }} />
              <strong>{item.label}</strong>
              <span>{formatPrice(item.px, lang, currency)}</span>
              <span className={`pct ${pctTone(item.ret)}`}>{formatPct(item.ret)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatMetric(fund, row, lang) {
  const v = fund[row.key]
  if (row.format === 'score') {
    return <span className={`badge score-${scoreTone(v)}`}>{v ?? '—'}</span>
  }
  if (row.format === 'pct') {
    return <span className={`pct ${pctTone(v)}`}>{formatPct(v)}</span>
  }
  if (row.format === 'vol') {
    return v == null ? '—' : `${(v * 100).toFixed(1)}%`
  }
  if (row.format === 'num') {
    return v == null ? '—' : Number(v).toFixed(2)
  }
  if (row.format === 'int') {
    return v == null ? '—' : Number(v).toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR')
  }
  if (row.format === 'mcap') {
    return formatMarketCap(v)
  }
  return '—'
}

/**
 * Fonaly tarzı yan yana karşılaştırma: fon seçimi, normalize getiri eğrisi,
 * benchmark katmanları ve metrik tablosu.
 */
export default function FundCompare({ funds, prices, lang, loading, error, seedSymbols }) {
  const list = funds?.results || []
  const [selected, setSelected] = useState([])
  const [period, setPeriod] = useState('3m')
  const [query, setQuery] = useState('')
  const [activeBench, setActiveBench] = useState(() => new Set())
  const [usdBase, setUsdBase] = useState(false)
  const [seeded, setSeeded] = useState(false)

  useEffect(() => {
    if (!list.length || seeded) return
    const seed = (seedSymbols || []).filter((s) => list.some((f) => f.symbol === s))
    setSelected(seed.length ? seed.slice(0, MAX_FUNDS) : list.slice(0, 2).map((f) => f.symbol))
    setSeeded(true)
  }, [list, seedSymbols, seeded])

  const bySymbol = useMemo(() => {
    const m = new Map()
    for (const f of list) m.set(f.symbol, f)
    return m
  }, [list])

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase()
    if (!q) return list.slice(0, 40)
    return list
      .filter((f) => f.symbol.includes(q) || (f.name || '').toUpperCase().includes(q))
      .slice(0, 40)
  }, [list, query])

  function toggleFund(symbol) {
    setSelected((prev) => {
      if (prev.includes(symbol)) return prev.filter((s) => s !== symbol)
      if (prev.length >= MAX_FUNDS) return prev
      return [...prev, symbol]
    })
  }

  function toggleBench(key) {
    setActiveBench((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // USD bazı: nominal TL getirisi yüksek enflasyonda yanıltıcı; seriler gün gün
  // USDTRY'ye bölününce "dolar cinsinden gerçekten kazandırdı mı" görünür.
  const usdPoints = prices?.benchmarks?.['USDTRY=X']?.points
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
        label: sym,
        color: LINE_COLORS[colorIdx % LINE_COLORS.length],
        points: pts,
        ret: seriesReturn(pts),
      })
      colorIdx += 1
    }
    for (const key of activeBench) {
      // USD bazında USDTRY'nin kendisi düz 100 çizgisi olurdu; atla
      if (inUsd && key === 'USDTRY=X') continue
      const b = prices?.benchmarks?.[key]
      if (!b) continue
      const pts = normalizeSeries(convert(b.points), period)
      if (!pts.length) continue
      lines.push({
        key: `b:${key}`,
        label: b.name || key,
        color: LINE_COLORS[colorIdx % LINE_COLORS.length],
        points: pts,
        ret: seriesReturn(pts),
        benchmark: true,
      })
      colorIdx += 1
    }
    return lines
  }, [selected, activeBench, prices, period, inUsd, usdPoints])

  const selectedFunds = selected.map((s) => bySymbol.get(s)).filter(Boolean)
  const benchmarks = Object.entries(prices?.benchmarks || {})

  if (loading) return <div className="empty-box">{t(lang, 'fundCompareLoading')}</div>
  if (error) return <div className="error-box">{error}</div>
  if (!list.length) return <div className="empty-box">{t(lang, 'fundsEmpty')}</div>

  return (
    <div className="fund-compare">
      <div className="status-bar">
        <span>{t(lang, 'fundCompareIntro')}</span>
      </div>

      <section className="fc-section">
        <h2 className="today-title">{t(lang, 'fundComparePick')}</h2>
        <div className="search-row">
          <input
            className="search-input"
            type="search"
            placeholder={t(lang, 'searchFund')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="fc-pick-hint">{t(lang, 'fundComparePickHint', selected.length, MAX_FUNDS)}</span>
        </div>
        <div className="fc-chips">
          {filtered.map((f) => {
            const on = selected.includes(f.symbol)
            return (
              <button
                key={f.symbol}
                type="button"
                className={`fc-chip ${on ? 'active' : ''}`}
                onClick={() => toggleFund(f.symbol)}
                title={f.name}
              >
                <strong>{f.symbol}</strong>
                <span className={`pct ${pctTone(f.return_3m)}`}>{formatPct(f.return_3m)}</span>
              </button>
            )
          })}
        </div>
        {selectedFunds.length > 0 && (
          <div className="fc-selected">
            {selectedFunds.map((f, i) => (
              <button key={f.symbol} type="button" className="fc-selected-item" onClick={() => toggleFund(f.symbol)}>
                <span className="fc-swatch" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
                {f.symbol}
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

        {benchmarks.length > 0 && (
          <div className="fc-bench">
            <span className="fc-bench-label">{t(lang, 'fundCompareBench')}</span>
            {benchmarks.map(([key, b]) => (
              <button
                key={key}
                type="button"
                className={`fc-chip ${activeBench.has(key) ? 'active' : ''}`}
                onClick={() => toggleBench(key)}
              >
                {b.name}
              </button>
            ))}
            {usdAvailable && (
              <button
                type="button"
                className={`fc-chip fc-usd ${usdBase ? 'active' : ''}`}
                title={t(lang, 'fcUsdBaseHint')}
                onClick={() => setUsdBase((v) => !v)}
              >
                $ {t(lang, 'fcUsdBase')}
              </button>
            )}
          </div>
        )}

        {!prices?.series ? (
          <div className="empty-box">{t(lang, 'fundCompareNoPrices')}</div>
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

      {selectedFunds.length > 0 && (
        <section className="fc-section">
          <h2 className="today-title">{t(lang, 'fundCompareMetrics')}</h2>
          <div className="table-wrap">
            <table className="fc-table">
              <thead>
                <tr>
                  <th className="left">{t(lang, 'fundCompareMetricCol')}</th>
                  {selectedFunds.map((f, i) => (
                    <th key={f.symbol}>
                      <span className="fc-swatch" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
                      {f.symbol}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="left">{t(lang, 'colFund')}</td>
                  {selectedFunds.map((f) => (
                    <td key={f.symbol} className="fc-name-cell" title={f.name}>
                      {f.name}
                    </td>
                  ))}
                </tr>
                {METRIC_ROWS.map((row) => (
                  <tr key={row.key}>
                    <td className="left">{row.i18nKey ? t(lang, row.i18nKey) : row.label}</td>
                    {selectedFunds.map((f) => (
                      <td key={f.symbol}>{formatMetric(f, row, lang)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="disclaimer">{t(lang, 'fundDisclaimer')}</p>
    </div>
  )
}
