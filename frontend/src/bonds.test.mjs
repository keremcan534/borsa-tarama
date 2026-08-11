/** Durasyon hesabı birim testleri: `npm test` (Node'un yerleşik test koşucusu).
 *
 * Değerler ders kitabı örnekleriyle doğrulanmıştır; formül elle bozulursa
 * (örn. değiştirilmiş durasyonda dönemsel getiriyle bölmeyi unutmak) burada
 * patlar.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { bondAnalytics, bondCashFlows, priceShift } from './bonds.js'

test('kuponlu tahvilin fiyat ve durasyonu ders kitabı değerine eşit', () => {
  // 1000 nominal, %8 kupon, 6 aylık ödeme, 3 yıl vade, %10 YTM
  const r = bondAnalytics({ face: 1000, couponRate: 0.08, years: 3, ytm: 0.1, freq: 2 })
  assert.ok(Math.abs(r.price - 949.2431) < 0.001)
  assert.ok(Math.abs(r.macaulay - 2.7174) < 0.001)
  assert.ok(Math.abs(r.modified - 2.588) < 0.001)
  // Değiştirilmiş durasyon = Macaulay / (1 + dönemsel getiri)
  assert.ok(Math.abs(r.modified - r.macaulay / 1.05) < 1e-12)
  // DV01 = değiştirilmiş durasyon x fiyat x 1bp
  assert.ok(Math.abs(r.dv01 - r.modified * r.price * 0.0001) < 1e-12)
})

test('kuponsuz tahvilde Macaulay durasyon vadeye eşittir', () => {
  const r = bondAnalytics({ face: 1000, couponRate: 0, years: 5, ytm: 0.3, freq: 1 })
  assert.equal(r.macaulay, 5)
  assert.ok(Math.abs(r.price - 1000 / 1.3 ** 5) < 1e-9)
})

test('getiri kupona eşitse fiyat nominale eşittir', () => {
  const r = bondAnalytics({ face: 100, couponRate: 0.4, years: 4, ytm: 0.4, freq: 1 })
  assert.ok(Math.abs(r.price - 100) < 1e-9)
})

test('kupon arttıkça durasyon kısalır (para daha erken geliyor)', () => {
  const base = { face: 100, years: 10, ytm: 0.2, freq: 2 }
  const low = bondAnalytics({ ...base, couponRate: 0.05 })
  const high = bondAnalytics({ ...base, couponRate: 0.25 })
  assert.ok(high.macaulay < low.macaulay)
})

test('nakit akışları: her dönem kupon, son dönemde anapara', () => {
  const flows = bondCashFlows({ face: 1000, couponRate: 0.1, years: 2, ytm: 0.1, freq: 2 })
  assert.equal(flows.length, 4)
  assert.equal(flows[0].amount, 50)
  assert.equal(flows[3].amount, 1050)
  assert.equal(flows[3].time, 2)
})

test('ağırlıklar toplamı 1 eder', () => {
  const r = bondAnalytics({ face: 100, couponRate: 0.15, years: 7, ytm: 0.22, freq: 4 })
  const total = r.flows.reduce((sum, f) => sum + f.weight, 0)
  assert.ok(Math.abs(total - 1) < 1e-12)
})

test('%0 getiri geçerli bir girdidir: fiyat = nakit akışlarının toplamı', () => {
  const r = bondAnalytics({ face: 100, couponRate: 0.05, years: 2, ytm: 0, freq: 2 })
  assert.equal(r.price, 110)
})

test('geçersiz girdide null döner', () => {
  assert.equal(bondAnalytics({ face: 0, couponRate: 0.1, years: 3, ytm: 0.1, freq: 2 }), null)
  assert.equal(bondAnalytics({ face: 1000, couponRate: 0.1, years: 0, ytm: 0.1, freq: 2 }), null)
  assert.equal(bondAnalytics({ face: 1000, couponRate: 0.1, years: 3, ytm: -1.5, freq: 2 }), null)
  assert.equal(bondAnalytics({ face: 1000, couponRate: NaN, years: 3, ytm: 0.1, freq: 2 }), null)
})

test('dışbükeylik: gerçek fiyat, durasyon tahmininin her iki yönde de üstünde kalır', () => {
  const inputs = { face: 1000, couponRate: 0.08, years: 3, ytm: 0.1, freq: 2 }
  const up = priceShift(inputs, 0.01)
  const down = priceShift(inputs, -0.01)
  assert.ok(up.actual > up.estimated) // kayıp tahminden az
  assert.ok(down.actual > down.estimated) // kazanç tahminden fazla
  // Küçük hareketlerde tahmin yine de yakın olmalı (%0,1'den az sapma)
  assert.ok(Math.abs(up.actual / up.estimated - 1) < 0.001)
})
