import { useMemo } from 'react'
import { t } from './i18n'

/**
 * Fon para akışı tablosu: son N günde her fona net kaç TL girdi/çıktı.
 *
 * Sitedeki mevcut akış paneli **yatırımcı SAYISI** üzerinden çalışıyor ("fona 500
 * kişi katıldı"). Bu tablo TL ölçer ve ikisi aynı şey değildir: tek bir kurumsal
 * giriş yatırımcı sayısını hiç değiştirmeden fonun boyutunu ikiye katlayabilir.
 *
 * Hesabın kendisi backend'de (app/funds/flows.py) — burada yalnızca gösterim var.
 * Kritik nokta: bir günün akışı, büyüklükteki değişimin **fiyatla açıklanamayan**
 * kısmıdır; yoksa fonu %5 yükselten bir piyasa günü %5 "para girişi" gibi görünürdü.
 */

// Görünen gün sayısı: paylaşılabilir bir kart genişliğinde kalması için 5.
const WINDOW_DAYS = 5

/** Eski arşiv kaydı düz sayıydı (yatırımcı sayısı); yenisi sözlük. */
function reading(entry) {
  return entry && typeof entry === 'object' ? entry : null
}

function formatMoney(value, lang) {
  if (value == null) return '—'
  const units =
    lang === 'en'
      ? [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']]
      : [[1e12, 'trl'], [1e9, 'mlr'], [1e6, 'mn'], [1e3, 'bin']]
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  const abs = Math.abs(value)
  for (const [scale, suffix] of units) {
    if (abs >= scale) {
      return `${sign}${(abs / scale).toFixed(2).replace('.', ',')} ${suffix}`
    }
  }
  return `${sign}${Math.round(abs)}`
}

function formatShare(pct) {
  if (pct == null) return ''
  const value = Math.abs(pct) * 100
  const digits = value >= 10 ? 0 : value >= 1 ? 1 : 2
  return `%${value.toFixed(digits).replace('.', ',')}`
}

/** Akış yoğunluğuna göre hücre tonu: küçük akışlar soluk, büyükler koyu. */
function toneClass(pct) {
  if (pct == null || pct === 0) return 'flow-flat'
  const magnitude = Math.abs(pct)
  const strength = magnitude >= 0.1 ? 'strong' : magnitude >= 0.02 ? 'mid' : 'soft'
  return `${pct > 0 ? 'flow-in' : 'flow-out'} flow-${strength}`
}

/**
 * Günlük akışları hesaplar. app/funds/flows.py'daki formülün AYNISI:
 *   akış_t = büyüklük_t − büyüklük_(t−1) × (fiyat_t / fiyat_(t−1))
 * İkisi değişirse ikisi birden değişmeli.
 */
function dailyFlows(history, symbol, maxRatio = 3) {
  const days = Object.keys(history || {}).sort()
  const out = []
  let previous = null

  for (const day of days) {
    const current = reading(history[day]?.[symbol])
    if (!current) continue
    const { size, price } = current
    if (size == null || price == null || price <= 0) {
      previous = current
      continue
    }
    if (previous?.size > 0 && previous?.price > 0) {
      const expected = previous.size * (price / previous.price)
      const flow = size - expected
      const pct = flow / previous.size
      if (Math.abs(pct) <= maxRatio) out.push({ date: day, flow, pct, size })
    }
    previous = current
  }
  return out
}

export default function FundFlows({ flows, funds, lang, onOpenFund, limit = 8 }) {
  const history = flows?.history || {}

  const rows = useMemo(() => {
    const symbols = (funds?.results || []).map((f) => f.symbol)
    const bySymbol = new Map((funds?.results || []).map((f) => [f.symbol, f]))

    const computed = symbols
      .map((symbol) => {
        const all = dailyFlows(history, symbol)
        if (!all.length) return null
        const window = all.slice(-WINDOW_DAYS)
        const total = window.reduce((sum, d) => sum + d.flow, 0)
        // Toplam yüzdesi DÖNEM BAŞI büyüklüğe oranlanır; günlük yüzdeler farklı
        // tabanlara göre hesaplandığından toplanmaları yanlış olurdu.
        const base = window[0].size - window[0].flow
        return {
          symbol,
          fund: bySymbol.get(symbol) || null,
          days: window,
          total,
          totalPct: base > 0 ? total / base : null,
        }
      })
      .filter(Boolean)

    // Sıralama TL toplamına göre: yüzde sıralaması küçük fonları tepeye taşır ve
    // "bugün para nereye gitti?" sorusunu cevaplamaz.
    computed.sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
    return computed.slice(0, limit)
  }, [history, funds, limit])

  // Sütun başlıkları: gösterilen satırlarda geçen tüm günler (birleşim)
  const dates = useMemo(() => {
    const seen = new Set()
    rows.forEach((r) => r.days.forEach((d) => seen.add(d.date)))
    return [...seen].sort().slice(-WINDOW_DAYS)
  }, [rows])

  if (!rows.length) {
    return (
      <section className="today-section">
        <h2 className="today-title">{t(lang, 'flowMoneyTitle')}</h2>
        <p className="today-note">{t(lang, 'flowMoneyPending')}</p>
      </section>
    )
  }

  const dayLabel = (iso) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(lang === 'en' ? 'en-US' : 'tr-TR', {
      day: '2-digit',
      month: '2-digit',
    })

  return (
    <section className="today-section">
      <h2 className="today-title">{t(lang, 'flowMoneyTitle')}</h2>
      <p className="today-note">{t(lang, 'flowMoneyIntro')}</p>

      <div className="flow-table-wrap">
        <table className="flow-table">
          <thead>
            <tr>
              <th>{t(lang, 'flowFund')}</th>
              {dates.map((d) => (
                <th key={d}>{dayLabel(d)}</th>
              ))}
              <th>{t(lang, 'flowTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const byDate = new Map(row.days.map((d) => [d.date, d]))
              return (
                <tr key={row.symbol}>
                  <td className="flow-fund">
                    <button type="button" onClick={() => onOpenFund?.(row.fund || { symbol: row.symbol })}>
                      {row.symbol}
                    </button>
                  </td>
                  {dates.map((d) => {
                    const cell = byDate.get(d)
                    return (
                      <td key={d} className={`flow-cell ${cell ? toneClass(cell.pct) : ''}`}>
                        {cell ? (
                          <>
                            <span className="flow-amount">{formatMoney(cell.flow, lang)}</span>
                            <span className="flow-share">{formatShare(cell.pct)}</span>
                          </>
                        ) : (
                          <span className="flow-amount">—</span>
                        )}
                      </td>
                    )
                  })}
                  <td className={`flow-cell flow-total ${toneClass(row.totalPct)}`}>
                    <span className="flow-amount">{formatMoney(row.total, lang)}</span>
                    <span className="flow-share">{formatShare(row.totalPct)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="today-note">{t(lang, 'flowMoneyFootnote')}</p>
    </section>
  )
}
