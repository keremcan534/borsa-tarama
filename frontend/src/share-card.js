/**
 * Paylaşım kartı çizimi ve dosya çıktısı — SAF yardımcılar, bileşen yok.
 *
 * `share.jsx`'ten ayrıldı: o dosya hem `ShareBar` bileşenini hem bu on kadar
 * yardımcıyı dışa veriyordu ve lint (`react/only-export-components`) haklı
 * olarak şikâyet ediyordu — bileşenle aynı dosyadan sabit/fonksiyon vermek
 * fast-refresh'i bozuyor. Ayrım aynı zamanda doğru sınır: buradaki hiçbir şey
 * React bilmiyor, hepsi canvas ve dosya işi.
 */

import { t } from './i18n'

// Kartta en fazla kaç satır gösterilir (yüksekliğe sığan sayı).
export const SHARE_CARD_ROWS = 7
export const SHARE_SITE_LABEL = 'keremcan534.github.io/borsa-tarama'
export const SHARE_CARD_W = 1080
export const SHARE_CARD_H = 1080

/* ---------------------------- Paylaşım altyapısı ----------------------------
 * Amaç: bir ekranı görsel olarak X'te paylaşmak ya da veriyi Excel'de açmak.
 * Kart, DOM'un ekran görüntüsü DEĞİL, canvas'a çizilen amaca özel bir görsel:
 * html2canvas gibi bir bağımlılık eklemeden her temada aynı görünür ve
 * yatırım tavsiyesi uyarısı görselden koparılamaz.
 */

/** Metni verilen piksel genişliğine sığdırır, taşarsa sonuna … koyar. */
export function ellipsize(ctx, text, maxWidth) {
  const value = String(text ?? '')
  if (maxWidth <= 0 || ctx.measureText(value).width <= maxWidth) return value
  let cut = value
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1)
  }
  return `${cut}…`
}

/**
 * Metni kutuya sığdıran punto seçer ve ctx.font'u ayarlar.
 *
 * Başlık tek satırdı ve HİÇ ölçülmüyordu: "Teknik görünümü güçlü hisseler"
 * gibi uzun bir başlık kartın sağ kenarından taşıp kesiliyordu (satırlar
 * ellipsize ediliyordu ama başlık atlanmıştı).
 */
export function fitFont(ctx, text, maxWidth, weight, maxSize, minSize) {
  for (let size = maxSize; size > minSize; size -= 2) {
    ctx.font = `${weight} ${size}px system-ui, sans-serif`
    if (ctx.measureText(text).width <= maxWidth) return size
  }
  ctx.font = `${weight} ${minSize}px system-ui, sans-serif`
  return minSize
}

// Marka işareti koyu lacivert mürekkep + saydam zemin; kartın koyu zemininde
// olduğu gibi çizilse görünmezdi. Ara tuvale çizip source-in ile açık renge
// boyuyoruz (arayüzdeki mask-image ile aynı fikir).
function tintedMark(mark, size, color) {
  const off = document.createElement('canvas')
  off.width = size
  off.height = size
  const octx = off.getContext('2d')
  octx.drawImage(mark, 0, 0, size, size)
  octx.globalCompositeOperation = 'source-in'
  octx.fillStyle = color
  octx.fillRect(0, 0, size, size)
  return off
}

/** Kart zemini + üst vurgu şeridi + marka satırı; her kart aynı kimliği taşır. */
export function drawChrome(ctx, mark, lang) {
  const bg = ctx.createLinearGradient(0, 0, SHARE_CARD_W, SHARE_CARD_H)
  bg.addColorStop(0, '#0d1424')
  bg.addColorStop(1, '#1b2036')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, SHARE_CARD_W, SHARE_CARD_H)

  const accent = ctx.createLinearGradient(0, 0, SHARE_CARD_W, 0)
  accent.addColorStop(0, '#7c3aed')
  accent.addColorStop(1, '#a855f7')
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, SHARE_CARD_W, 10)

  let textX = 80
  if (mark) {
    const size = 52
    ctx.drawImage(tintedMark(mark, size, '#a2c4ff'), 80, 62, size, size)
    textX = 80 + size + 16
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '600 28px system-ui, sans-serif'
  ctx.fillText(t(lang, 'brand').toUpperCase(), textX, 100)
}

/** Kartın alt bilgisi: tarih, site ve görselden koparılamayan uyarı. */
export function drawFooter(ctx, lang) {
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.font = '400 28px system-ui, sans-serif'
  ctx.fillText(new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'tr-TR'), 80, SHARE_CARD_H - 118)
  ctx.textAlign = 'right'
  ctx.fillText(SHARE_SITE_LABEL, SHARE_CARD_W - 80, SHARE_CARD_H - 118)
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.38)'
  ctx.font = '400 24px system-ui, sans-serif'
  ctx.fillText(t(lang, 'shareDisclaimer'), 80, SHARE_CARD_H - 68)
}

/** Başlık + satır listesi taşıyan genel paylaşım kartı (tek hisse kartıyla aynı kimlik). */
export function drawListCard(canvas, { title, subtitle, rows, valueLabel, lang }, mark) {
  const ctx = canvas.getContext('2d')
  canvas.width = SHARE_CARD_W
  canvas.height = SHARE_CARD_H
  const innerW = SHARE_CARD_W - 160

  drawChrome(ctx, mark, lang)

  ctx.fillStyle = '#ffffff'
  const titleSize = fitFont(ctx, title, innerW, '800', 62, 34)
  ctx.fillText(ellipsize(ctx, title, innerW), 80, 186)

  if (subtitle) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '400 30px system-ui, sans-serif'
    ctx.fillText(ellipsize(ctx, subtitle, innerW), 80, 186 + titleSize * 0.62)
  }

  // Sütun başlığı: kartı gören kişi sağdaki büyük sayının NE olduğunu
  // bilmiyordu ("99" tek başına anlamsız).
  let y = 262
  if (valueLabel) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = '600 22px system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(valueLabel.toUpperCase(), SHARE_CARD_W - 110, y)
    ctx.textAlign = 'left'
  }
  y += 20

  const rowH = 78
  const gap = 10
  const visible = (rows || []).slice(0, SHARE_CARD_ROWS)
  for (const row of visible) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(80, y, innerW, rowH)
    const mid = y + rowH / 2 + 12

    // Sağ blok önce ölçülür; sol blok ondan ARTAN yere sığdırılır.
    ctx.font = '700 36px system-ui, sans-serif'
    const valueW = ctx.measureText(row.value).width
    let noteW = 0
    if (row.note) {
      ctx.font = '400 26px system-ui, sans-serif'
      noteW = ctx.measureText(row.note).width + 18
    }

    ctx.textAlign = 'right'
    // Renk YÖNÜ olan sayıya ait. Not varsa yön nottadır (değişim yüzdesi),
    // değer nötr kalır: puanı değişime göre boyamak iki farklı büyüklüğü
    // karıştırıyordu — aynı kartta "92" bir satırda beyaz, başka satırda yeşil
    // çıkıyor ve puanlar farklı türdenmiş gibi duruyordu.
    const toneColor = row.tone === 'pos' ? '#4ade80' : row.tone === 'neg' ? '#f87171' : null
    if (row.note) {
      // Not, DEĞERİN SOLUNDA aynı hizada. Önceden değerin üstünde, kutunun üst
      // kenarına yapışık çiziliyordu ve satıra değil aradaki boşluğa aitmiş
      // gibi duruyordu.
      ctx.fillStyle = toneColor || 'rgba(255,255,255,0.5)'
      ctx.font = '400 26px system-ui, sans-serif'
      ctx.fillText(row.note, SHARE_CARD_W - 110 - valueW - 18, mid)
    }
    ctx.fillStyle = row.note ? '#ffffff' : toneColor || '#ffffff'
    ctx.font = '700 36px system-ui, sans-serif'
    ctx.fillText(row.value, SHARE_CARD_W - 110, mid)
    ctx.textAlign = 'left'

    const leftMax = innerW - 60 - valueW - noteW - 24
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 34px system-ui, sans-serif'
    const labelW = ctx.measureText(row.label).width
    ctx.fillText(ellipsize(ctx, row.label, leftMax), 110, mid)

    // Fon/şirket adı kodun yanında: "TLY" tek başına kartı görene bir şey
    // anlatmıyordu.
    if (row.sub && leftMax - labelW > 120) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.font = '400 24px system-ui, sans-serif'
      ctx.fillText(ellipsize(ctx, row.sub, leftMax - labelW - 16), 110 + labelW + 16, mid)
    }
    y += rowH + gap
  }

  drawFooter(ctx, lang)
}

// Marka işareti bir kez yüklenir; kart üretimi senkron olduğundan görselin
// hazır olması BEKLENİR (yüklenemezse kart marka işaretsiz üretilir, üretimi
// hiç engellemez).
let brandMarkPromise = null

export function loadBrandMark() {
  if (!brandMarkPromise) {
    brandMarkPromise = new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = `${import.meta.env.BASE_URL}brand-mark.png`
    })
  }
  return brandMarkPromise
}

export async function cardToBlob(draw) {
  const mark = await loadBrandMark()
  const canvas = document.createElement('canvas')
  draw(canvas, mark)
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'))
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * X paylaşım penceresi. Görsel intent ile EKLENEMEZ (X'in web intent'i dosya
 * kabul etmez); bu yüzden akış "önce kartı indir, sonra paylaş" şeklinde
 * kurgulandı ve buton metni bunu söylüyor. Bağlantı olarak o anki derin
 * bağlantı gider — karşı taraf tam olarak aynı ekranı açar.
 */
export function shareToX({ text, url }) {
  const params = new URLSearchParams({ text, url })
  window.open(`https://x.com/intent/post?${params.toString()}`, '_blank', 'noopener,noreferrer')
}

/** Telefonun yerel paylaş menüsü; destekliyorsa görseli de ekler. */
export async function nativeShare({ title, text, url, blob, filename }) {
  if (!navigator.share) return false
  try {
    if (blob && navigator.canShare) {
      const file = new File([blob], filename, { type: 'image/png' })
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title, text, files: [file] })
        return true
      }
    }
    await navigator.share({ title, text, url })
    return true
  } catch {
    return false // kullanıcı vazgeçti ya da tarayıcı reddetti: sessizce geç
  }
}

export function downloadCsv(filename, headerRow, dataRows) {
  const esc = (v) => {
    if (v == null) return ''
    const s = String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const body = [headerRow, ...dataRows].map((r) => r.map(esc).join(',')).join('\n')
  const blob = new Blob([`﻿${body}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
