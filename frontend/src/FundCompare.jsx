import { useEffect, useMemo, useState } from 'react'
import { t } from './i18n'
import { SHARE_CARD_ROWS, ShareBar } from './share'

const MAX_FUNDS = 5

export const PERIODS = [
  { key: '1w', days: 7, label: '1H', labelEn: '1W' },
  { key: '1m', days: 30, label: '1A', labelEn: '1M' },
  { key: '3m', days: 90, label: '3A', labelEn: '3M' },
  { key: '6m', days: 180, label: '6A', labelEn: '6M' },
  { key: 'ytd', days: null, label: 'YTD', labelEn: 'YTD' },
  { key: '1y', days: 365, label: '1Y', labelEn: '1Y' },
]

export const LINE_COLORS = ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#0891b2', '#be185d']

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
  { key: 'sortino', label: 'Sortino', format: 'num' },
  { key: 'calmar', label: 'Calmar', format: 'num' },
  { key: 'max_drawdown', label: 'Max DD %', format: 'pct' },
  { key: 'alpha', i18nKey: 'colAlpha', format: 'pct' },
  { key: 'beta', i18nKey: 'colBeta', format: 'num' },
  { key: 'investor_count', i18nKey: 'colInvestors', format: 'int' },
  { key: 'portfolio_size', i18nKey: 'colSize', format: 'mcap' },
]

export function formatPct(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return '—'
  const pct = value * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(digits)}%`
}

export function pctTone(value) {
  if (value == null) return ''
  if (value > 0.02) return 'pos'
  if (value < -0.02) return 'neg'
  return 'flat'
}

export function formatMarketCap(value) {
  if (value == null) return '—'
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  return value.toLocaleString('tr-TR')
}

export function scoreTone(score) {
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
export function normalizeSeries(points, periodKey) {
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

export function seriesReturn(norm) {
  if (!norm?.length) return null
  return norm[norm.length - 1].v / 100 - 1
}

export function formatPrice(value, lang, currency = '₺') {
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
export function toUsdSeries(points, usdPoints) {
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

/**
 * KAP aylık portföy verisini fon → {hisse: son ağırlık %} matrisine çevirir.
 * Kaynak veri hisse → fon yönünde tutulur (Hisse Pozisyonları sekmesi için);
 * örtüşme hesabı ters yönü ister.
 */
function buildFundHoldings(positions) {
  const holdings = new Map()
  const months = positions?.months || []
  const stocks = positions?.stocks || {}
  for (const [stockSym, stock] of Object.entries(stocks)) {
    for (const fund of stock.funds || []) {
      let weight = null
      for (let i = months.length - 1; i >= 0; i -= 1) {
        const w = fund.positions?.[months[i]]?.weight
        if (w != null) {
          weight = w
          break
        }
      }
      if (weight == null || weight <= 0) continue
      if (!holdings.has(fund.fund_code)) holdings.set(fund.fund_code, new Map())
      holdings.get(fund.fund_code).set(stockSym, { weight, name: stock.name })
    }
  }
  return holdings
}

export function CompareChart({ lines, lang, currency = '₺' }) {
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

/* ----------------------- Risk / korelasyon / aylık getiri -----------------------
 * Metrik tablosu "ne kadar kazandırdı"yı söylüyordu ama üç soruyu cevaplamıyordu:
 * (1) bu getiri ne kadar riskle alındı, (2) seçtiğim fonlar aslında aynı bahsin
 * kopyası mı, (3) getiri istikrarlı mı yoksa tek bir aydan mı geliyor.
 */

/** [[date, price]] → günlük getiri haritası {YYYY-MM-DD: getiri}. */
function dailyReturns(points) {
  const out = new Map()
  if (!points?.length) return out
  let prev = null
  for (const [day, raw] of points) {
    const px = Number(raw)
    if (!(px > 0)) continue
    if (prev != null) out.set(day, px / prev - 1)
    prev = px
  }
  return out
}

/**
 * İki getiri serisinin ortak günlerdeki Pearson korelasyonu.
 * Fiyat SEVİYESİ değil GETİRİ kullanılır: iki yükselen seri seviyede neredeyse
 * her zaman ~1 korelasyon verir ve bu sahte bir ilişkidir (makro panelinde de
 * aynı kural geçerli).
 */
function correlationOf(a, b, minDays = 20) {
  const xs = []
  const ys = []
  for (const [day, va] of a) {
    const vb = b.get(day)
    if (vb != null) {
      xs.push(va)
      ys.push(vb)
    }
  }
  if (xs.length < minDays) return null
  const n = xs.length
  const mx = xs.reduce((s, v) => s + v, 0) / n
  const my = ys.reduce((s, v) => s + v, 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i += 1) {
    const a1 = xs[i] - mx
    const b1 = ys[i] - my
    num += a1 * b1
    dx += a1 * a1
    dy += b1 * b1
  }
  const den = Math.sqrt(dx * dy)
  if (!(den > 0)) return null
  return num / den
}

/** Ay ay getiri: {'2026-03': 0.041, ...}. Yarım aylar atılır (bkz. MIN_MONTH_DAYS). */
const MIN_MONTH_DAYS = 10

function monthlyReturns(points) {
  const byMonth = new Map()
  for (const [day, raw] of points || []) {
    const px = Number(raw)
    if (!(px > 0)) continue
    const key = day.slice(0, 7)
    if (!byMonth.has(key)) byMonth.set(key, [])
    byMonth.get(key).push(px)
  }
  const out = new Map()
  for (const [key, pxs] of byMonth) {
    // Kısmi ay (ör. verinin başladığı ilk birkaç gün) tam bir ay gibi
    // gösterilirse ısı haritası yanlış okunur; boş bırakmak dürüst olan.
    if (pxs.length < MIN_MONTH_DAYS) continue
    out.set(key, pxs[pxs.length - 1] / pxs[0] - 1)
  }
  return out
}

/** Korelasyon/ısı haritası hücresinin rengi (yeşil-kırmızı, 0 = nötr). */
function heatColor(value, max = 1) {
  if (value == null) return 'transparent'
  const ratio = Math.max(-1, Math.min(1, value / max))
  const alpha = 0.12 + Math.abs(ratio) * 0.5
  return ratio >= 0 ? `rgba(22, 163, 74, ${alpha})` : `rgba(220, 38, 38, ${alpha})`
}

/** Risk-getiri dağılımı: x = volatilite, y = 1 yıllık getiri. */
function RiskReturnScatter({ universe, selected, lang }) {
  const pts = useMemo(
    () =>
      (universe || [])
        .filter((f) => f.volatility != null && f.return_1y != null)
        .map((f) => ({ symbol: f.symbol, x: f.volatility, y: f.return_1y, on: selected.includes(f.symbol) })),
    [universe, selected],
  )

  if (pts.length < 3) return null

  const W = 640
  const H = 320
  const pad = { l: 54, r: 16, t: 14, b: 34 }
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y).sort((a, b) => a - b)
  const x0 = 0
  const x1 = Math.max(...xs) * 1.05
  // Y ekseni p95'te kırpılır (seçililer hariç): tek bir uç fon (+%1285 getiri)
  // ölçeği 13 kat büyütüp kalan 119 fonu alttaki ince bir şeride sıkıştırıyordu.
  // Kırpılan noktalar üst kenara oturur; seçili fon her zaman gerçek yerinde.
  const p95 = ys[Math.min(ys.length - 1, Math.floor(ys.length * 0.95))]
  const selMax = Math.max(...pts.filter((p) => p.on).map((p) => p.y), -Infinity)
  const y0 = Math.min(0, ys[0]) * 1.05
  const y1 = Math.max(p95, selMax, 0.01) * 1.05
  const px = (v) => pad.l + ((v - x0) / (x1 - x0 || 1)) * (W - pad.l - pad.r)
  const py = (v) =>
    H - pad.b - ((Math.min(v, y1) - y0) / (y1 - y0 || 1)) * (H - pad.t - pad.b)
  const pctLabel = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`

  return (
    <div className="fc-scatter-wrap">
      <svg className="fc-scatter" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t(lang, 'fcRiskTitle')}>
        {/* Sıfır getiri çizgisi: üstü kazandıran, altı kaybettiren bölge */}
        {y0 < 0 && (
          <line x1={pad.l} x2={W - pad.r} y1={py(0)} y2={py(0)} className="fc-scatter-zero" />
        )}
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} className="fc-scatter-axis" />
        <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} className="fc-scatter-axis" />
        {pts
          .slice()
          .sort((a, b) => Number(a.on) - Number(b.on)) // seçililer en üstte çizilsin
          .map((p) => (
            <g key={p.symbol}>
              <circle cx={px(p.x)} cy={py(p.y)} r={p.on ? 6 : 3} className={p.on ? 'fc-dot on' : 'fc-dot'}>
                {/* Seçili olmayan noktalar da kimliğini söylesin (hover) */}
                <title>{`${p.symbol} · ${pctLabel(p.y)} / ${pctLabel(p.x)}`}</title>
              </circle>
              {p.on && (
                <text x={px(p.x) + 9} y={py(p.y) + 4} className="fc-dot-label">
                  {p.symbol}
                </text>
              )}
            </g>
          ))}
        {/* Eksen uç değerleri: sayısız eksen okunmuyordu */}
        <text x={pad.l - 6} y={py(0) + 4} className="fc-axis-label" textAnchor="end">
          0%
        </text>
        <text x={pad.l - 6} y={pad.t + 28} className="fc-axis-label" textAnchor="end">
          {pctLabel(y1 / 1.05)}
        </text>
        <text x={W - pad.r} y={H - pad.b + 16} className="fc-axis-label" textAnchor="end">
          {pctLabel(x1 / 1.05)}
        </text>
        <text x={W - pad.r} y={H - 8} className="fc-axis-label" textAnchor="end">
          {t(lang, 'fcRiskX')}
        </text>
        <text x={4} y={pad.t + 8} className="fc-axis-label">
          {t(lang, 'fcRiskY')}
        </text>
      </svg>
    </div>
  )
}

/**
 * Fonaly tarzı yan yana karşılaştırma: fon seçimi, normalize getiri eğrisi,
 * benchmark katmanları ve metrik tablosu.
 */
export default function FundCompare({ funds, prices, positions, lang, loading, error, seedSymbols }) {
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
    // Türkçe yerelle büyüt: ASCII toUpperCase 'iş' -> 'IŞ' yapar ve
    // 'İŞ PORTFÖY' fon adlarıyla asla eşleşmezdi
    const q = query.trim().toLocaleUpperCase('tr-TR')
    if (!q) return list.slice(0, 40)
    return list
      .filter(
        (f) => f.symbol.includes(q) || (f.name || '').toLocaleUpperCase('tr-TR').includes(q),
      )
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
      // Zaten dolar cinsinden kote seriler (ons altın) USD modunda İKİNCİ KEZ
      // kura bölünmez: bölmek hem fiyatı saçmalatıyor (85 $ "ons altın") hem
      // getiri eğrisini kur hareketiyle çarpıtıyordu.
      const alreadyUsd = key === 'GC=F'
      const pts = normalizeSeries(inUsd && alreadyUsd ? b.points : convert(b.points), period)
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

  const fundHoldings = useMemo(() => buildFundHoldings(positions), [positions])

  // Seçili fonlardan en az ikisinin KAP verisi varsa örtüşme hesaplanır:
  // ikili örtüşme = ortak hisselerde min(ağırlık) toplamı.
  const overlap = useMemo(() => {
    const withData = selected.filter((s) => fundHoldings.has(s))
    if (withData.length < 2) return null
    const pairs = []
    for (let i = 0; i < withData.length; i += 1) {
      for (let j = i + 1; j < withData.length; j += 1) {
        const a = fundHoldings.get(withData[i])
        const b = fundHoldings.get(withData[j])
        let sum = 0
        for (const [sym, va] of a) {
          const vb = b.get(sym)
          if (vb) sum += Math.min(va.weight, vb.weight)
        }
        pairs.push({ a: withData[i], b: withData[j], overlap: sum })
      }
    }
    pairs.sort((x, y) => y.overlap - x.overlap)
    const stockAgg = new Map()
    for (const sym of withData) {
      for (const [stockSym, v] of fundHoldings.get(sym)) {
        if (!stockAgg.has(stockSym)) stockAgg.set(stockSym, { name: v.name, weights: {}, count: 0, total: 0 })
        const row = stockAgg.get(stockSym)
        row.weights[sym] = v.weight
        row.count += 1
        row.total += v.weight
      }
    }
    const shared = [...stockAgg.entries()]
      .filter(([, r]) => r.count >= 2)
      .map(([stockSym, r]) => ({ symbol: stockSym, ...r }))
      .sort((x, y) => y.total - x.total)
      .slice(0, 15)
    const missing = selected.filter((s) => !fundHoldings.has(s))
    return { funds: withData, pairs, shared, missing }
  }, [selected, fundHoldings])

  const selectedFunds = selected.map((s) => bySymbol.get(s)).filter(Boolean)
  const activePeriod = PERIODS.find((p) => p.key === period)
  const benchmarks = Object.entries(prices?.benchmarks || {})

  // Korelasyon: seçili fonların ortak günlerdeki GÜNLÜK GETİRİ ilişkisi.
  // Örtüşme tablosu "aynı hisseleri mi taşıyorlar" sorusunu KAP verisinden
  // cevaplıyor; bu ise "farklı hisse taşısalar bile birlikte mi hareket
  // ediyorlar" sorusunu fiyattan cevaplıyor — ikisi ayrı bilgi.
  const correlations = useMemo(() => {
    if (selected.length < 2) return null
    const rets = new Map()
    for (const sym of selected) {
      const pts = prices?.series?.[sym]
      if (pts?.length) rets.set(sym, dailyReturns(pts))
    }
    const syms = selected.filter((sym) => rets.has(sym))
    if (syms.length < 2) return null
    const grid = syms.map((a) => syms.map((b) => (a === b ? 1 : correlationOf(rets.get(a), rets.get(b)))))
    return { syms, grid }
  }, [selected, prices])

  // Aylık getiri ısı haritası: getiri istikrarlı mı, yoksa tek bir aydan mı geliyor?
  const monthly = useMemo(() => {
    if (!selected.length) return null
    const perFund = new Map()
    const monthSet = new Set()
    for (const sym of selected) {
      const pts = prices?.series?.[sym]
      if (!pts?.length) continue
      const m = monthlyReturns(pts)
      if (!m.size) continue
      perFund.set(sym, m)
      for (const key of m.keys()) monthSet.add(key)
    }
    if (!perFund.size) return null
    return { months: [...monthSet].sort().slice(-12), perFund }
  }, [selected, prices])

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
          <ShareBar
            lang={lang}
            csv={{
              filename: `fon-karsilastirma-${selected.join('-')}.csv`,
              header: ['Metrik', ...selectedFunds.map((f) => f.symbol)],
              rows: () =>
                METRIC_ROWS.map((row) => [
                  row.i18nKey ? t(lang, row.i18nKey) : row.label,
                  // "%" başlıklı kolonlara 0-1 aralığında 17 haneli ham oran
                  // yazılıyordu; yüzdeler x100 + 2 hane, sayılar 4 haneye yuvarlı.
                  ...selectedFunds.map((f) => {
                    const v = f[row.key]
                    if (v == null) return ''
                    if (row.format === 'pct' || row.format === 'vol') return (v * 100).toFixed(2)
                    if (row.format === 'num') return Number(v).toFixed(4)
                    return v
                  }),
                ]),
            }}
            card={{
              title: t(lang, 'tabFundCompare'),
              subtitle: `${t(lang, 'fundCompareChartTitle')} · ${lang === 'en' ? activePeriod?.labelEn : activePeriod?.label}`,
              filename: `fon-karsilastirma-${new Date().toISOString().slice(0, 10)}.png`,
              rows: chartLines.slice(0, SHARE_CARD_ROWS).map((line) => ({
                label: line.label,
                value: line.ret == null ? '—' : formatPct(line.ret, 1),
                tone: pctTone(line.ret),
              })),
            }}
            shareText={t(lang, 'fcShareText', selectedFunds.map((f) => f.symbol).join(', '))}
          />
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

      <section className="fc-section">
        <h2 className="today-title">{t(lang, 'fcRiskTitle')}</h2>
        <p className="fc-overlap-hint">{t(lang, 'fcRiskHint')}</p>
        <RiskReturnScatter universe={list} selected={selected} lang={lang} />
      </section>

      {correlations && (
        <section className="fc-section">
          <h2 className="today-title">{t(lang, 'fcCorrTitle')}</h2>
          <p className="fc-overlap-hint">{t(lang, 'fcCorrHint')}</p>
          <div className="table-wrap">
            <table className="fc-matrix">
              <thead>
                <tr>
                  <th className="left" />
                  {correlations.syms.map((sym) => (
                    <th key={sym}>{sym}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {correlations.syms.map((rowSym, i) => (
                  <tr key={rowSym}>
                    <td className="left"><strong>{rowSym}</strong></td>
                    {correlations.grid[i].map((v, j) => (
                      <td
                        key={correlations.syms[j]}
                        style={{ background: i === j ? 'transparent' : heatColor(v) }}
                      >
                        {v == null ? '—' : v.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {monthly && (
        <section className="fc-section">
          <h2 className="today-title">{t(lang, 'fcMonthlyTitle')}</h2>
          <p className="fc-overlap-hint">{t(lang, 'fcMonthlyHint')}</p>
          <div className="table-wrap">
            <table className="fc-matrix">
              <thead>
                <tr>
                  <th className="left" />
                  {monthly.months.map((m) => (
                    <th key={m}>{`${m.slice(5)}/${m.slice(2, 4)}`}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...monthly.perFund.entries()].map(([sym, map]) => (
                  <tr key={sym}>
                    <td className="left"><strong>{sym}</strong></td>
                    {monthly.months.map((m) => {
                      const v = map.get(m)
                      return (
                        <td key={m} style={{ background: heatColor(v, 0.15) }}>
                          {v == null ? '' : formatPct(v, 1)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {overlap && (
        <section className="fc-section">
          <h2 className="today-title">{t(lang, 'fcOverlapTitle')}</h2>
          <p className="fc-overlap-hint">{t(lang, 'fcOverlapHint')}</p>
          <div className="fc-overlap-pairs">
            {overlap.pairs.map((p) => (
              <div key={`${p.a}-${p.b}`} className="today-card fc-overlap-card">
                <span className="today-card-label">
                  {p.a} ↔ {p.b}
                </span>
                <strong className={`today-card-value ${p.overlap >= 50 ? 'fc-overlap-high' : ''}`}>
                  %{p.overlap.toFixed(1)}
                </strong>
              </div>
            ))}
          </div>
          {overlap.shared.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="left">{t(lang, 'fcOverlapStock')}</th>
                    {overlap.funds.map((s) => (
                      <th key={s}>{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overlap.shared.map((row) => (
                    <tr key={row.symbol}>
                      <td className="left">
                        <strong>{row.symbol}</strong>
                        {row.name && <span className="sp-fund-name">{row.name}</span>}
                      </td>
                      {overlap.funds.map((s) => (
                        <td key={s}>{row.weights[s] != null ? `%${row.weights[s].toFixed(2)}` : '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {overlap.missing.length > 0 && (
            <p className="fc-overlap-note">{t(lang, 'fcOverlapMissing', overlap.missing.join(', '))}</p>
          )}
        </section>
      )}

      {/* Veri yokken bölümü sessizce yok etmek "bir şey kayıp" hissi veriyordu:
          başlık kalır, sebep açıkça yazılır (KAP raporları henüz işlenmedi). */}
      {!overlap && selected.length >= 2 && (
        <section className="fc-section">
          <h2 className="today-title">{t(lang, 'fcOverlapTitle')}</h2>
          <p className="fc-overlap-note">{t(lang, 'fcOverlapNoData')}</p>
        </section>
      )}

      <p className="disclaimer">{t(lang, 'fundDisclaimer')}</p>
    </div>
  )
}
