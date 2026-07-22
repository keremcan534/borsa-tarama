/**
 * Paylaşım / dışa aktarma altyapısı.
 *
 * App.jsx ve FundCompare.jsx bunu birlikte kullanır; App.jsx'te dursaydı
 * FundCompare'ın App'i import etmesi gerekirdi ve App zaten FundCompare'ı
 * import ettiğinden dairesel bağımlılık doğardı.
 */

import { useState } from 'react'

import { t } from './i18n'

// Kartta en fazla kaç satır gösterilir (yüksekliğe sığan sayı).
export const SHARE_CARD_ROWS = 8
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

/** Başlık + satır listesi taşıyan genel paylaşım kartı (tek hisse kartıyla aynı kimlik). */
export function drawListCard(canvas, { title, subtitle, rows, lang }) {
  const ctx = canvas.getContext('2d')
  canvas.width = SHARE_CARD_W
  canvas.height = SHARE_CARD_H

  const bg = ctx.createLinearGradient(0, 0, SHARE_CARD_W, SHARE_CARD_H)
  bg.addColorStop(0, '#12141a')
  bg.addColorStop(1, '#1c2030')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, SHARE_CARD_W, SHARE_CARD_H)

  const accent = ctx.createLinearGradient(0, 0, SHARE_CARD_W, 0)
  accent.addColorStop(0, '#7c3aed')
  accent.addColorStop(1, '#a855f7')
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, SHARE_CARD_W, 10)

  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '600 28px system-ui, sans-serif'
  ctx.fillText(t(lang, 'brand').toUpperCase(), 80, 100)

  ctx.fillStyle = '#ffffff'
  ctx.font = '800 62px system-ui, sans-serif'
  ctx.fillText(title, 80, 190)

  if (subtitle) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '400 30px system-ui, sans-serif'
    ctx.fillText(subtitle, 80, 240)
  }

  // Satır sayısı kartın yüksekliğine göre sınırlı: sığmayanı küçültüp
  // okunmaz hale getirmektense hiç göstermemek daha dürüst.
  const visible = (rows || []).slice(0, SHARE_CARD_ROWS)
  const rowInnerW = SHARE_CARD_W - 160 - 60
  let y = 300
  for (const row of visible) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(80, y, SHARE_CARD_W - 160, 78)

    ctx.font = '700 36px system-ui, sans-serif'
    const valueW = ctx.measureText(row.value).width

    ctx.fillStyle = '#ffffff'
    ctx.font = '700 34px system-ui, sans-serif'
    // Etiket, değerin üstüne binmesin: veri kaynaklı uzun bir isim (fon adı gibi)
    // geldiğinde iki metin çakışıp kartı okunmaz hale getirirdi.
    ctx.fillText(ellipsize(ctx, row.label, rowInnerW - valueW - 24), 110, y + 50)

    ctx.textAlign = 'right'
    ctx.fillStyle = row.tone === 'pos' ? '#4ade80' : row.tone === 'neg' ? '#f87171' : '#ffffff'
    ctx.font = '700 36px system-ui, sans-serif'
    ctx.fillText(row.value, SHARE_CARD_W - 110, y + 50)

    if (row.note) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.font = '400 24px system-ui, sans-serif'
      ctx.fillText(row.note, SHARE_CARD_W - 110, y + 50 - 40)
    }
    ctx.textAlign = 'left'
    y += 88
  }

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

export function cardToBlob(draw) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    draw(canvas)
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
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

/**
 * Sayfaların üstünde duran paylaş/indir şeridi.
 * `csv`: { filename, header, rows } · `card`: { title, subtitle, rows, filename }
 * `shareText`: X'e önerilen metin. Verilmeyen yetenek için düğme hiç çıkmaz.
 */
export function ShareBar({ lang, csv, card, shareText, onMessage }) {
  const [busy, setBusy] = useState(false)
  // Sayfanın kendi toast'ı yoksa şerit geri bildirimi kendi içinde gösterir:
  // aksi halde "X'te paylaş"a basan kullanıcı kartın indiğini hiç öğrenmiyordu.
  const [note, setNote] = useState(null)

  function notify(message) {
    if (onMessage) {
      onMessage(message)
      return
    }
    setNote(message)
    window.setTimeout(() => setNote(null), 3500)
  }
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share

  async function saveCard() {
    setBusy(true)
    const blob = await cardToBlob((c) => drawListCard(c, { ...card, lang }))
    setBusy(false)
    if (!blob) return null
    downloadBlob(blob, card.filename)
    return blob
  }

  return (
    <div className="share-bar">
      {csv && (
        <button className="btn small" type="button" onClick={() => downloadCsv(csv.filename, csv.header, csv.rows())}>
          ⬇ {t(lang, 'exportCsv')}
        </button>
      )}
      {card && (
        <button className="btn small" type="button" disabled={busy} onClick={saveCard} title={t(lang, 'shareCardHint2')}>
          🖼 {t(lang, 'shareCard')}
        </button>
      )}
      {shareText && (
        <button
          className="btn small"
          type="button"
          disabled={busy}
          title={t(lang, 'shareXHint')}
          onClick={() => {
            // X penceresi ÖNCE ve senkron açılır: `await`ten sonra çağrılan
            // window.open kullanıcı hareketi bağlamını kaybeder ve açılır pencere
            // engelleyicisine takılır — kullanıcı butona basar, kart iner, X hiç
            // açılmazdı. Kart arkadan indirilir; intent zaten dosya taşıyamıyor.
            shareToX({ text: shareText, url: window.location.href })
            if (card) saveCard()
            notify(t(lang, 'shareXDone'))
          }}
        >
          𝕏 {t(lang, 'shareX')}
        </button>
      )}
      {note && <span className="share-note">{note}</span>}
      {canNativeShare && shareText && (
        <button
          className="btn small"
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const blob = card ? await cardToBlob((c) => drawListCard(c, { ...card, lang })) : null
            setBusy(false)
            await nativeShare({
              title: t(lang, 'brand'),
              text: shareText,
              url: window.location.href,
              blob,
              filename: card?.filename || 'borsa-tarama.png',
            })
          }}
        >
          📤 {t(lang, 'shareNative')}
        </button>
      )}
    </div>
  )
}

// Görünen tabloyu CSV olarak indirir. BOM eklenir ki Excel Türkçe karakterleri
// ve UTF-8'i doğru okusun; alanlar gerektiğinde tırnaklanır.
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
