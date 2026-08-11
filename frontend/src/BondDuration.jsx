import { useMemo, useState } from 'react'
import { COUPON_FREQUENCIES, bondAnalytics, priceShift } from './bonds'
import { t } from './i18n'

// Faiz hareketi senaryoları (baz puan): ±100bp klasik "duration testi"
const SHIFTS = [-0.01, 0.01]

// Nakit akışı tablosunda gösterilecek azami satır (aylık kuponlu 30 yıllık
// tahvil 360 satır eder; tablo sayfayı boğmasın diye kırpılır).
const MAX_FLOW_ROWS = 60

const PRESETS = [
  { key: 'bdPresetZero', face: 100, couponRate: 0, years: 2, ytm: 0.38, freq: 1 },
  { key: 'bdPresetGov', face: 100, couponRate: 0.32, years: 5, ytm: 0.35, freq: 2 },
  { key: 'bdPresetCorp', face: 1000, couponRate: 0.08, years: 10, ytm: 0.065, freq: 2 },
]

const DEFAULTS = { face: '100', couponRate: '32', years: '5', ytm: '35', freq: 2 }

function num(value) {
  const parsed = Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : NaN
}

function locale(lang) {
  return lang === 'en' ? 'en-US' : 'tr-TR'
}

function fmt(value, lang, digits = 2) {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString(locale(lang), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function fmtPct(value, lang, digits = 2) {
  if (value == null || !Number.isFinite(value)) return '—'
  const pct = value * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toLocaleString(locale(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`
}

/**
 * Tahvil durasyon hesaplayıcısı.
 *
 * Hisse/fon sayfalarının aksine burada piyasa verisi yok: girdilerin tamamı
 * kullanıcıdan gelir ve hesap `bonds.js` içindeki saf fonksiyonlarla anında
 * tarayıcıda yapılır.
 */
export default function BondDuration({ lang }) {
  const [form, setForm] = useState(DEFAULTS)

  const inputs = useMemo(
    () => ({
      face: num(form.face),
      couponRate: num(form.couponRate) / 100,
      years: num(form.years),
      ytm: num(form.ytm) / 100,
      freq: Number(form.freq),
    }),
    [form],
  )

  const result = useMemo(() => bondAnalytics(inputs), [inputs])
  const scenarios = useMemo(
    () => (result ? SHIFTS.map((shift) => priceShift(inputs, shift)) : []),
    [inputs, result],
  )

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const applyPreset = (preset) =>
    setForm({
      face: String(preset.face),
      couponRate: String(preset.couponRate * 100),
      years: String(preset.years),
      ytm: String(preset.ytm * 100),
      freq: preset.freq,
    })

  const flows = result ? result.flows : []
  const shownFlows = flows.slice(0, MAX_FLOW_ROWS)

  return (
    <>
      <div className="status-bar">
        <span>{t(lang, 'bdIntro')}</span>
      </div>

      <div className="bd-presets">
        <span className="bd-presets-label">{t(lang, 'bdPresets')}</span>
        {PRESETS.map((preset) => (
          <button key={preset.key} className="chip" type="button" onClick={() => applyPreset(preset)}>
            {t(lang, preset.key)}
          </button>
        ))}
      </div>

      <form className="pf-form" onSubmit={(e) => e.preventDefault()}>
        <div className="pf-field">
          <label htmlFor="bd-face">{t(lang, 'bdFace')}</label>
          <input
            id="bd-face"
            className="search-input"
            type="text"
            inputMode="decimal"
            value={form.face}
            onChange={set('face')}
          />
        </div>
        <div className="pf-field">
          <label htmlFor="bd-coupon">{t(lang, 'bdCoupon')}</label>
          <input
            id="bd-coupon"
            className="search-input"
            type="text"
            inputMode="decimal"
            value={form.couponRate}
            onChange={set('couponRate')}
          />
        </div>
        <div className="pf-field">
          <label htmlFor="bd-years">{t(lang, 'bdYears')}</label>
          <input
            id="bd-years"
            className="search-input"
            type="text"
            inputMode="decimal"
            value={form.years}
            onChange={set('years')}
          />
        </div>
        <div className="pf-field">
          <label htmlFor="bd-ytm">{t(lang, 'bdYtm')}</label>
          <input
            id="bd-ytm"
            className="search-input"
            type="text"
            inputMode="decimal"
            value={form.ytm}
            onChange={set('ytm')}
          />
        </div>
        <div className="pf-field">
          <label htmlFor="bd-freq">{t(lang, 'bdFreq')}</label>
          <select id="bd-freq" className="search-input" value={form.freq} onChange={set('freq')}>
            {COUPON_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {t(lang, 'bdFreqOption', f)}
              </option>
            ))}
          </select>
        </div>
      </form>

      {!result ? (
        <div className="empty-box">{t(lang, 'bdInvalid')}</div>
      ) : (
        <>
          <div className="fund-metrics bd-results">
            <div className="fund-metric">
              <span className="fund-metric-label">{t(lang, 'bdPrice')}</span>
              <strong>{fmt(result.price, lang)}</strong>
              <span className="bd-sub">{fmtPct(result.price / inputs.face - 1, lang, 1)} {t(lang, 'bdVsPar')}</span>
            </div>
            <div className="fund-metric">
              <span className="fund-metric-label">{t(lang, 'bdMacaulay')}</span>
              <strong>{fmt(result.macaulay, lang)}</strong>
              <span className="bd-sub">{t(lang, 'bdYearsUnit')}</span>
            </div>
            <div className="fund-metric">
              <span className="fund-metric-label">{t(lang, 'bdModified')}</span>
              <strong>{fmt(result.modified, lang)}</strong>
              <span className="bd-sub">{t(lang, 'bdModifiedSub', fmt(result.modified, lang, 2))}</span>
            </div>
            <div className="fund-metric">
              <span className="fund-metric-label">DV01</span>
              <strong>{fmt(result.dv01, lang, 4)}</strong>
              <span className="bd-sub">{t(lang, 'bdDv01Sub')}</span>
            </div>
          </div>

          <div className="fund-section-title">{t(lang, 'bdScenarioTitle')}</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="left">{t(lang, 'bdScenario')}</th>
                  <th>{t(lang, 'bdEstimated')}</th>
                  <th>{t(lang, 'bdActual')}</th>
                  <th>{t(lang, 'bdConvexityGap')}</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.filter(Boolean).map((s) => (
                  <tr key={s.shift}>
                    <td className="left">{t(lang, 'bdShiftLabel', s.shift * 10000)}</td>
                    <td>
                      {fmt(s.estimated, lang)} <span className="bd-sub">({fmtPct(s.estimatedPct, lang)})</span>
                    </td>
                    <td>
                      {fmt(s.actual, lang)} <span className="bd-sub">({fmtPct(s.actualPct, lang)})</span>
                    </td>
                    <td>{s.actual == null ? '—' : fmt(s.actual - s.estimated, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="bd-note">{t(lang, 'bdConvexityNote')}</p>

          <div className="fund-section-title">{t(lang, 'bdFlowsTitle')}</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="left">{t(lang, 'bdPeriod')}</th>
                  <th>{t(lang, 'bdTime')}</th>
                  <th>{t(lang, 'bdCashFlow')}</th>
                  <th>{t(lang, 'bdPv')}</th>
                  <th>{t(lang, 'bdWeight')}</th>
                </tr>
              </thead>
              <tbody>
                {shownFlows.map((flow) => (
                  <tr key={flow.period}>
                    <td className="left">{flow.period}</td>
                    <td>{fmt(flow.time, lang)}</td>
                    <td>{fmt(flow.amount, lang)}</td>
                    <td>{fmt(flow.pv, lang)}</td>
                    <td>{fmt(flow.weight * 100, lang, 1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {flows.length > shownFlows.length && (
            <p className="bd-note">{t(lang, 'bdFlowsTrimmed', shownFlows.length, flows.length)}</p>
          )}
        </>
      )}

      <details className="info-panel">
        <summary>{t(lang, 'bdHowTitle')}</summary>
        <div className="info-content">
          <p>{t(lang, 'bdHowBody1')}</p>
          <p>{t(lang, 'bdHowBody2')}</p>
          <p>{t(lang, 'bdHowBody3')}</p>
        </div>
      </details>
    </>
  )
}
