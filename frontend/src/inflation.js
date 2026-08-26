/**
 * Reel (enflasyondan arındırılmış) getiri hesapları.
 *
 * Ayrı ve saf bir modülde durmasının sebebi test edilebilirlik: App.jsx React'e,
 * api.js `import.meta.env`'e bağlı; ikisi de Node'un test koşucusunda import
 * edilemiyor. Buradaki fonksiyonlar hiçbir şeye bağlı değil (`npm test`).
 *
 * Backend'de aynı hesabın karşılığı `app/data/inflation.py` — biri değişirse
 * diğeri de değişmeli.
 */

/** "2026-03-14" / Date -> "2026-03" (TÜFE aylık yayımlanır). */
function monthKey(value) {
  return String(value instanceof Date ? value.toISOString() : value).slice(0, 7)
}

/**
 * Nominal getiriyi aynı dönemin enflasyonundan arındırır.
 *
 * BÖLME kullanılır, çıkarma değil: yüksek enflasyonda ikisi belirgin biçimde
 * ayrışır (nominal %80, enflasyon %50 iken çıkarma %30 der, doğrusu %20).
 * Dönemin iki ucu da TÜFE serisinde yoksa null döner — eksik ucu tahmin etmek
 * bilinmeyeni biliniyormuş gibi göstermek olurdu.
 */
export function realReturn(nominal, startDate, endDate, series) {
  if (nominal == null || !series) return null
  const start = series[monthKey(startDate)]
  const end = series[monthKey(endDate)]
  if (!start || !end || start <= 0) return null
  return (1 + nominal) / (end / start) - 1
}

/** İki ay arasındaki toplam enflasyon (oran). Kapsanmıyorsa null. */
export function inflationBetween(startDate, endDate, series) {
  if (!series) return null
  const start = series[monthKey(startDate)]
  const end = series[monthKey(endDate)]
  if (!start || !end || start <= 0) return null
  return end / start - 1
}

/**
 * Portföyün reel getirisi.
 *
 * Pozisyonlar farklı tarihlerde alındığından TEK bir portföy reel getirisi
 * tanımlı değil; her pozisyon kendi alım ayından TÜFE serisinin son ayına ayrı
 * ayrı indirgenir ve yalnızca kapsanan pozisyonlar toplama girer.
 *
 * `covered`/`total` da döner: "3 pozisyonun 1'i" ile "3'ünün 3'ü" aynı güvenle
 * okunmamalı, arayüz bu farkı gösteriyor.
 */
export function portfolioRealReturn(rows, cpi) {
  const series = cpi?.series
  const asOf = cpi?.as_of
  if (!series || !Object.keys(series).length || !asOf) return null

  let cost = 0
  let realValue = 0
  let covered = 0

  for (const row of rows || []) {
    // Portföy kaydının şekli: { id, symbol, date, price, qty }
    if (row.value == null || !row.date) continue
    const start = series[monthKey(row.date)]
    const end = series[asOf]
    if (!start || !end || start <= 0) continue
    // Bugünkü değeri alım ayının parasına indirger: enflasyon çarpanına böl.
    realValue += row.value / (end / start)
    cost += row.cost
    covered += 1
  }

  const total = (rows || []).length
  if (!covered || cost <= 0) return { realPct: null, covered: 0, total }
  return { realPct: realValue / cost - 1, covered, total }
}
