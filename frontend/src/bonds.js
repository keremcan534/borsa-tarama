/** Tahvil/bono nakit akışları ve durasyon hesapları.
 *
 * Hesap bilerek tarayıcıda yapılır: girdilerin tamamı kullanıcıdan gelir,
 * piyasa verisi gerekmez — böylece site statik yayında da (GitHub Pages,
 * backend yokken) çalışır ve her tuşta anında sonuç verir.
 *
 * Kabuller (piyasa standardı): kuponlar dönem başına eşit ödenir, getiri
 * (YTM) dönemsel bileşiklenir (yıllık YTM / dönem sayısı) ve fiyat "temiz"
 * fiyattır — ödeme tarihindeyiz, birikmiş faiz yoktur.
 */

/** Ödeme sıklığı seçenekleri (yılda kaç kupon). */
export const COUPON_FREQUENCIES = [1, 2, 4, 12]

/**
 * Vade sonuna kadarki nakit akışları: her dönem kupon, son dönemde kupon + anapara.
 * Vade dönemi 1'in altına düşüyorsa (örn. 0 yıl) boş liste döner.
 */
export function bondCashFlows({ face, couponRate, years, freq }) {
  const periods = Math.round(years * freq)
  if (!Number.isFinite(periods) || periods < 1) return []
  const coupon = (face * couponRate) / freq
  const flows = []
  for (let i = 1; i <= periods; i++) {
    flows.push({
      period: i,
      time: i / freq, // yıl cinsinden
      coupon,
      principal: i === periods ? face : 0,
      amount: coupon + (i === periods ? face : 0),
    })
  }
  return flows
}

/**
 * Fiyat, Macaulay ve değiştirilmiş durasyon.
 *
 * Macaulay durasyon, nakit akışlarının bugünkü değerlerine göre ağırlıklı
 * ORTALAMA VADESİDİR (yıl): "paranı ortalama kaç yıl sonra geri alıyorsun".
 * Değiştirilmiş durasyon ise bunun fiyat duyarlılığı hâlidir: getiri 1 puan
 * artarsa fiyat yaklaşık yüzde `modified` kadar düşer.
 *
 * Geçersiz girdide (nominal <= 0, vade yok, getiri <= -100%) null döner.
 */
export function bondAnalytics({ face, couponRate, years, ytm, freq }) {
  if (!(face > 0) || !(freq >= 1) || !Number.isFinite(couponRate) || !Number.isFinite(ytm)) return null

  // -%100'ün altındaki getiri hem finansal olarak anlamsız hem de dönemsel
  // bileşiklemede iskonto çarpanını ters çevirir; girdiyi burada reddet.
  const periodicYield = ytm / freq
  if (!(ytm > -1) || !(periodicYield > -1)) return null

  const flows = bondCashFlows({ face, couponRate, years, freq })
  if (!flows.length) return null

  let price = 0
  let weightedTime = 0
  const rows = flows.map((flow) => {
    const discount = (1 + periodicYield) ** -flow.period
    const pv = flow.amount * discount
    price += pv
    weightedTime += flow.time * pv
    return { ...flow, discount, pv }
  })

  if (!(price > 0)) return null

  const macaulay = weightedTime / price
  const modified = macaulay / (1 + periodicYield)

  return {
    price,
    macaulay,
    modified,
    // DV01: getiri 1 baz puan (0.01%) arttığında fiyattaki para cinsinden kayıp
    dv01: modified * price * 0.0001,
    periodicYield,
    couponPerPeriod: (face * couponRate) / freq,
    periods: flows.length,
    flows: rows.map((row) => ({ ...row, weight: row.pv / price })),
  }
}

/**
 * Getiri `shift` kadar (örn. +0.01 = +100bp) değişirse fiyat ne olur?
 *
 * `estimated` yalnızca değiştirilmiş durasyonun doğrusal tahminidir; `actual`
 * tahvilin yeniden fiyatlanmış hâlidir. İkisi arasındaki fark dışbükeylikten
 * (convexity) gelir ve durasyonun neden sadece küçük hareketlerde iyi bir
 * yaklaşım olduğunu gösterir.
 */
export function priceShift(inputs, shift) {
  const base = bondAnalytics(inputs)
  if (!base) return null
  const shifted = bondAnalytics({ ...inputs, ytm: inputs.ytm + shift })
  const estimated = base.price * (1 - base.modified * shift)
  return {
    shift,
    estimated,
    estimatedPct: estimated / base.price - 1,
    actual: shifted ? shifted.price : null,
    actualPct: shifted ? shifted.price / base.price - 1 : null,
  }
}
