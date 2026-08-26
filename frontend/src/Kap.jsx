import { useMemo, useState } from 'react'
import { t } from './i18n'

/**
 * KAP bildirim akışı.
 *
 * Neden ayrı bir sayfa ve neden Haberler'in içinde değil: haber akışı ikincil
 * kaynaktır (Google News/Yahoo) ve yorumlanmış başlıklar taşır. KAP ise şirketin
 * kendi resmi açıklamasıdır — bilanço, pay alım-satım, sermaye artırımı önce burada
 * yayımlanır. İkisini tek listede karıştırmak, kullanıcının "bunu şirket mi dedi,
 * gazete mi?" ayrımını kaybetmesine yol açardı.
 *
 * Liste yalnızca meta veri gösterir (tarih, hisse, konu, özet) ve asıl bildirime
 * KAP'ta bağlanır: bildirim gövdesi hiç indirilmiyor (bkz. app/data/kap.py).
 */

// Kategori sekmeleri. `null` = hepsi. Kodlar KAP'ın kendi sınıflarıdır.
const CATEGORIES = [
  { key: null, i18nKey: 'kapCatAll' },
  { key: 'FR', i18nKey: 'kapCatFinancial' },
  { key: 'ODA', i18nKey: 'kapCatSpecial' },
  { key: 'STT', i18nKey: 'kapCatTrade' },
]

// Uzun liste sayfayı boğuyor; haber akışıyla aynı sınır.
const PAGE_SIZE = 100

function formatWhen(iso, lang) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function displayCode(symbol) {
  return String(symbol || '').replace('.IS', '')
}

export default function Kap({ items, generatedAt, loading, error, lang, onOpenChart }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(null)
  // Kalan bildirimler erişilebilir olmalı: sınır sabit değil, istekle genişler.
  const [limit, setLimit] = useState(PAGE_SIZE)

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr')
    return (items || [])
      .filter((item) => (category ? item.category === category : true))
      .filter((item) => {
        if (!q) return true
        const haystack = [item.symbol, item.company, item.subject, item.summary]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('tr')
        return haystack.includes(q)
      })
  }, [items, query, category])

  const shown = filtered.slice(0, limit)

  if (loading) return <div className="status-bar">{t(lang, 'kapLoading')}</div>
  if (error) return <div className="error-box">{error}</div>

  return (
    <div className="news-groups">
      <div className="status-bar">
        <span>{t(lang, 'kapIntro')}</span>
        {generatedAt && <span className="muted">{formatWhen(generatedAt, lang)}</span>}
      </div>

      <div className="tabs news-scope-tabs" role="group" aria-label={t(lang, 'kapCatAll')}>
        {CATEGORIES.map((c) => (
          <button
            key={c.key || 'all'}
            type="button"
            className={`tab ${category === c.key ? 'active' : ''}`}
            onClick={() => {
              setCategory(c.key)
              setLimit(PAGE_SIZE)
            }}
          >
            {t(lang, c.i18nKey)}
          </button>
        ))}
      </div>

      <div className="search-row">
        <input
          className="search-input"
          type="search"
          placeholder={t(lang, 'kapSearch')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {shown.length === 0 ? (
        <div className="empty-box">{t(lang, 'kapEmpty')}</div>
      ) : (
        <ul className="kap-list">
          {shown.map((item, i) => (
            <li className="kap-item" key={`${item.link}-${item.symbol}-${i}`}>
              <div className="kap-item-head">
                <button
                  type="button"
                  className="kap-symbol"
                  onClick={() => onOpenChart?.(item.symbol)}
                  title={item.company || item.symbol}
                >
                  {displayCode(item.symbol)}
                </button>
                {item.category_label && <span className="kap-badge">{item.category_label}</span>}
                {/* KAP'ın kendi "geç bildirim" işareti: yatırımcı için anlamlı bir sinyal,
                    bizim türettiğimiz bir yorum değil. */}
                {item.is_late && <span className="kap-badge kap-badge-late">{t(lang, 'kapLate')}</span>}
                <span className="kap-when">{formatWhen(item.published_at, lang)}</span>
              </div>
              <a className="kap-subject" href={item.link} target="_blank" rel="noopener noreferrer">
                {item.subject || t(lang, 'kapNoSubject')}
              </a>
              {item.summary && item.summary !== item.subject && (
                <div className="kap-summary">{item.summary}</div>
              )}
              {item.company && <div className="kap-company">{item.company}</div>}
            </li>
          ))}
        </ul>
      )}

      {filtered.length > shown.length && (
        <div className="status-bar">
          <button
            type="button"
            className="btn"
            onClick={() => setLimit((current) => current + PAGE_SIZE)}
          >
            {t(lang, 'kapMore', filtered.length - shown.length)}
          </button>
        </div>
      )}
    </div>
  )
}
