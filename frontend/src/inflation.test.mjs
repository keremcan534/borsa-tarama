/** Reel getiri birim testleri: `npm test`.
 *
 * Bu hesabın iki klasik hatası var ve ikisi de burada kilitli:
 * (1) enflasyonu çıkarmak (bölmek yerine), (2) kapsanmayan dönemi son bilinen
 * enflasyonla ileri taşımak. İkisi de sayıyı olduğundan iyi gösterir.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { inflationBetween, portfolioRealReturn, realReturn } from './inflation.js'

const SERIES = { '2025-01': 100, '2025-07': 120, '2025-12': 130, '2026-01': 150 }

test('aynı oranda nominal getiri ve enflasyon reelde sıfır eder', () => {
  assert.equal(realReturn(0.5, '2025-01', '2026-01', SERIES), 0)
})

test('çıkarma değil bölme: nominal %80, enflasyon %50 -> reel %20', () => {
  const result = realReturn(0.8, '2025-01', '2026-01', SERIES)
  assert.ok(Math.abs(result - 0.2) < 1e-9, `beklenen 0.20, gelen ${result}`)
  assert.ok(Math.abs(result - 0.3) > 0.05, 'çıkarma kestirmesi kullanılmış')
})

test('enflasyon nominali geçince reel getiri negatif', () => {
  assert.ok(realReturn(0.3, '2025-01', '2026-01', SERIES) < 0)
})

test('kapsanmayan dönemde null döner, tahmin edilmez', () => {
  assert.equal(realReturn(0.5, '2024-01', '2026-01', SERIES), null)
  assert.equal(realReturn(0.5, '2025-01', '2026-08', SERIES), null)
})

test('tam tarih verilse de ay anahtarına indirgenir', () => {
  assert.equal(realReturn(0.5, '2025-01-14', '2026-01-03', SERIES), 0)
})

test('iki ay arası toplam enflasyon', () => {
  assert.equal(inflationBetween('2025-01', '2026-01', SERIES), 0.5)
  assert.equal(inflationBetween('2020-01', '2026-01', SERIES), null)
})

test('portföy: nominal artış enflasyona eşitse reel sıfır', () => {
  const cpi = { series: SERIES, as_of: '2025-12' }
  const rows = [{ date: '2025-01-15', cost: 1000, value: 1300 }]
  const result = portfolioRealReturn(rows, cpi)
  assert.equal(result.realPct, 0)
  assert.equal(result.covered, 1)
  assert.equal(result.total, 1)
})

test('portföy: kapsanmayan pozisyon hesaba GİRMEZ ama sayılır', () => {
  const cpi = { series: SERIES, as_of: '2025-12' }
  const rows = [
    { date: '2025-01-15', cost: 1000, value: 1300 },
    { date: '2026-03-01', cost: 500, value: 900 }, // TÜFE serisinde yok
  ]
  const result = portfolioRealReturn(rows, cpi)
  assert.equal(result.realPct, 0) // yalnızca kapsanan pozisyon
  assert.equal(result.covered, 1)
  assert.equal(result.total, 2)
})

test('portföy: TÜFE yoksa null — sıfır enflasyon varsayılmaz', () => {
  assert.equal(portfolioRealReturn([{ date: '2025-01-15', cost: 1000, value: 1300 }], { series: {}, as_of: null }), null)
})

test('portföy: değeri bilinmeyen pozisyon toplama katılmaz', () => {
  const cpi = { series: SERIES, as_of: '2025-12' }
  const result = portfolioRealReturn([{ date: '2025-01-15', cost: 1000, value: null }], cpi)
  assert.equal(result.realPct, null)
  assert.equal(result.covered, 0)
})
