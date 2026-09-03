/**
 * Paylaş/indir şeridi (bileşen).
 *
 * Kart çizimi ve dosya çıktısı `share-card.js` içinde: bu dosya yalnızca
 * bileşen dışa versin ki fast-refresh çalışsın (bkz. oradaki not).
 */

import { useRef, useState } from 'react'

import { t } from './i18n'
import {
  cardToBlob,
  downloadBlob,
  downloadCsv,
  drawListCard,
  nativeShare,
  shareToX,
} from './share-card'

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

  const noteTimer = useRef(null)

  function notify(message) {
    if (onMessage) {
      onMessage(message)
      return
    }
    // Önceki zamanlayıcı iptal edilmezse, arka arkaya iki tıklamada ESKİ tıklamanın
    // zamanlayıcısı yenisinin notunu erkenden siliyordu.
    if (noteTimer.current) window.clearTimeout(noteTimer.current)
    setNote(message)
    noteTimer.current = window.setTimeout(() => setNote(null), 3500)
  }
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share

  async function saveCard() {
    setBusy(true)
    const blob = await cardToBlob((c, mark) => drawListCard(c, { ...card, lang }, mark))
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
            const blob = card ? await cardToBlob((c, mark) => drawListCard(c, { ...card, lang }, mark)) : null
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
