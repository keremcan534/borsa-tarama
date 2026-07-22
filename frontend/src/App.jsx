import { Component, Fragment, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  fetchAllNews,
  fetchBacktest,
  fetchDailyOverview,
  fetchDividends,
  fetchEnabledMarkets,
  fetchFundFlows,
  fetchMacro,
  fetchScoreHistory,
  fetchFundPrices,
  fetchFunds,
  fetchScreener,
  fetchStockPositions,
  fetchFx,
  fetchSignalLog,
  fetchStockPrices,
  STATIC_MODE,
} from './api'
import FundCompare from './FundCompare'
import StockCompare from './StockCompare'
import StockPositions from './StockPositions'
import { getLang, setLang as persistLang, t } from './i18n'

/* ---------------------------- Menü ikonları ----------------------------
 * Emoji yerine ince çizgi SVG. Sebep: emoji her işletim sisteminde farklı
 * çizilir (Windows'ta dolgun ve renkli, macOS'ta bambaşka), boyutu satır
 * yüksekliğine göre zıplar ve arayüze "hazır klip art" havası verir. Bunlar
 * `currentColor` kullanır, yani seçili/karanlık durumda menüyle birlikte
 * renk değiştirir. Harici ikon kütüphanesi bağımlılığı yok.
 */
const NAV_ICON_PATHS = {
  today: 'M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z',
  screener: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM16 16l4.5 4.5',
  map: 'M4 20V7l5-3 6 3 5-3v13l-5 3-6-3-5 3ZM9 4v13M15 7v13',
  bubbles: 'M8 13a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM17 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM17.5 9.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  rotation: 'M20 12a8 8 0 0 1-13.7 5.6M4 12a8 8 0 0 1 13.7-5.6M17 3v4h-4M7 21v-4h4',
  macro: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c2.5 2.4 3.9 5.6 4 9-.1 3.4-1.5 6.6-4 9-2.5-2.4-3.9-5.6-4-9 .1-3.4 1.5-6.6 4-9Z',
  news: 'M4 5h13a1 1 0 0 1 1 1v13H5a1 1 0 0 1-1-1V5ZM18 9h2v9a1 1 0 0 1-1 1M7 9h7M7 13h7M7 16h4',
  funds: 'M3 9.5 12 4l9 5.5M5 10v8M10 10v8M14 10v8M19 10v8M3 21h18',
  fundLeague: 'M8 4h8v4a4 4 0 0 1-8 0V4ZM8 5H5v1a3 3 0 0 0 3 3M16 5h3v1a3 3 0 0 1-3 3M12 12v4M9 20h6M10 20v-2h4v2',
  fundCompare: 'M12 4v16M6 8 3 15h6L6 8ZM18 8l-3 7h6l-3-7ZM4 7h16',
  watchlist: 'm12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8L12 4Z',
  strategy: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 11.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1Z',
  portfolio: 'M4 8h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1ZM9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18',
  alerts: 'M12 4a5 5 0 0 0-5 5c0 4-2 5-2 7h14c0-2-2-3-2-7a5 5 0 0 0-5-5ZM10 19a2 2 0 0 0 4 0',
  stockCompare: 'M5 20V10M12 20V4M19 20v-7M3 20h18',
  dividends: 'M12 5c3.9 0 7 1.1 7 2.5S15.9 10 12 10 5 8.9 5 7.5 8.1 5 12 5ZM5 7.5v9c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-9M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5',
  stockPositions: 'M4 4h16v16H4zM4 9.5h16M4 15h16M9.5 4v16M15 4v16',
  scorecard: 'M6 3h12v18l-3-1.5L12 21l-3-1.5L6 21V3ZM9 8h6M9 12h6M9 16h3',
  backtest: 'M4 19 9 13l3.5 3.5L20 8M20 8h-4.5M20 8v4.5',
}

function NavIcon({ name }) {
  const d = NAV_ICON_PATHS[name]
  if (!d) return null
  return (
    <svg
      className="nav-icon-svg"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

// Reklam altyapısı: bir reklam ağı (AdSense vb.) bağlanana kadar kapalı.
// Açıldığında AdSlot bileşenleri yayın kodunu render edecek.
const ADS_ENABLED = false

const MARKETS = [
  { key: 'bist100', label: 'BIST 100', labelEn: 'BIST 100' },
  { key: 'sp500', label: 'S&P 500', labelEn: 'S&P 500' },
  { key: 'etf', label: 'ETF', labelEn: 'ETF' },
  { key: 'commodity', label: 'Emtia', labelEn: 'Commodities' },
]

const TIMEFRAMES = [
  { key: 'daily', label: 'Günlük', labelEn: 'Daily', horizon: 'günler–haftalar', horizonEn: 'days–weeks' },
  { key: 'weekly', label: 'Haftalık', labelEn: 'Weekly', horizon: 'haftalar–aylar', horizonEn: 'weeks–months' },
  { key: 'monthly', label: 'Aylık', labelEn: 'Monthly', horizon: 'aylar ve ötesi', horizonEn: 'months+' },
  { key: 'quarterly', label: '3 Aylık', labelEn: 'Quarterly', horizon: 'çeyrekler ve ötesi', horizonEn: 'quarters+' },
]

// "Bugün" sayfasındaki market sinyalleri: günlük / haftalık / aylık (çeyreklik hariç)
const TODAY_TIMEFRAMES = TIMEFRAMES.filter((tf) => tf.key !== 'quarterly')

// Backtest yalnızca günlük/haftalık için üretilir (backtest.yml): aylık/çeyreklik
// mumlarda 5-10 yıllık veriden anlamlı sayıda geçmiş sinyal çıkmıyor.
const BACKTEST_TIMEFRAMES = TIMEFRAMES.filter((tf) => tf.key === 'daily' || tf.key === 'weekly')

// Sol menü sırası. İkonlar emoji: harici ikon kütüphanesi bağımlılığı getirmiyor.
// Sıralama bilinçli: en çok tıklanma potansiyeli olan sekmeler üstte
// (açılış özeti → günlük rutinler → fonlar → kişisel → derin analiz).
const NAV_SECTIONS = [
  {
    titleKey: null, // açılış — başlıksız
    items: [{ key: 'today', i18nKey: 'tabToday' }],
  },
  {
    titleKey: 'navSecMarket',
    items: [
      { key: 'screener', i18nKey: 'tabScreener' },
      { key: 'map', i18nKey: 'tabMap' },
      { key: 'bubbles', i18nKey: 'tabBubbles' },
      { key: 'rotation', i18nKey: 'tabRotation' },
      { key: 'macro', i18nKey: 'tabMacro' },
      { key: 'news', i18nKey: 'tabNews' },
    ],
  },
  {
    titleKey: 'navSecFunds',
    items: [
      { key: 'funds', i18nKey: 'tabFunds' },
      { key: 'fundLeague', i18nKey: 'tabFundLeague' },
      { key: 'fundCompare', i18nKey: 'tabFundCompare' },
    ],
  },
  {
    titleKey: 'navSecMine',
    items: [
      { key: 'watchlist', i18nKey: 'tabWatchlist' },
      { key: 'strategy', i18nKey: 'tabStrategy' },
      { key: 'portfolio', i18nKey: 'tabPortfolio' },
      { key: 'alerts', i18nKey: 'tabAlerts' },
    ],
  },
  {
    titleKey: 'navSecAnalysis',
    items: [
      { key: 'stockCompare', i18nKey: 'tabStockCompare' },
      { key: 'dividends', i18nKey: 'tabDividends' },
      { key: 'stockPositions', i18nKey: 'tabStockPositions' },
      { key: 'scorecard', i18nKey: 'tabScorecard' },
      { key: 'backtest', i18nKey: 'tabBacktest' },
    ],
  },
]

// Düz liste (komut paleti "Sayfalar" grubu vb. için) aynı sırayı paylaşır
const NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items)

const mLabel = (m, lang) => (lang === 'en' ? m.labelEn : m.label)
const tfLabel = (tf, lang) => (lang === 'en' ? tf.labelEn : tf.label)

// Emtia/kripto: dost isim + TradingView grafik sembolü eşlemesi
const COMMODITY_INFO = {
  'GC=F': { name: 'Altın', tv: 'TVC:GOLD' },
  'SI=F': { name: 'Gümüş', tv: 'TVC:SILVER' },
  'PL=F': { name: 'Platin', tv: 'TVC:PLATINUM' },
  'PA=F': { name: 'Paladyum', tv: 'TVC:PALLADIUM' },
  'HG=F': { name: 'Bakır', tv: 'TVC:COPPER' },
  'CL=F': { name: 'Petrol (WTI)', tv: 'TVC:USOIL' },
  'BZ=F': { name: 'Petrol (Brent)', tv: 'TVC:UKOIL' },
  'NG=F': { name: 'Doğalgaz', tv: 'TVC:NATURALGAS' },
  'BTC-USD': { name: 'Bitcoin', tv: 'BINANCE:BTCUSDT' },
  'ETH-USD': { name: 'Ethereum', tv: 'BINANCE:ETHUSDT' },
}

function displaySymbol(symbol) {
  return COMMODITY_INFO[symbol]?.name || symbol.replace('.IS', '')
}

/* ---------- Para birimi dönüşümü (TL / $ / gram altın) ----------
 * Yüksek enflasyonda TL bazlı getiri yanıltıcıdır: TL'de "+%50" dolar bazında
 * kayıp olabilir. Dönüşüm her nokta için O GÜNÜN kuruyla yapılır — geçmişi tek
 * bir güncel kurla çevirmek getiri eğrisini tamamen çarpıtırdı. */

const GRAMS_PER_OUNCE = 31.1034768

const CURRENCIES = [
  { key: 'native', i18nKey: 'curNative' },
  { key: 'usd', i18nKey: 'curUsd' },
  { key: 'gold', i18nKey: 'curGold' },
]

/** Sembolün kendi para birimi: BIST TL, geri kalan (S&P, ETF, emtia) dolar. */
const symbolCurrency = (symbol) => (symbol.endsWith('.IS') ? 'TRY' : 'USD')

/**
 * [[tarih, oran], ...] sıralı listesinden "tarihe ait ya da ondan önceki en yakın"
 * oranı veren arama fonksiyonu üretir. Kur serisi ile hisse serisinin işlem günleri
 * birebir örtüşmediğinden (tatiller) tam eşleşme aramak çok noktayı düşürürdü.
 */
function buildRateLookup(pairs) {
  if (!pairs?.length) return null
  const dates = pairs.map((p) => p[0])
  const rates = pairs.map((p) => p[1])
  return (date) => {
    let lo = 0
    let hi = dates.length - 1
    let best = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (dates[mid] <= date) {
        best = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    return best >= 0 ? rates[best] : null
  }
}

/**
 * Fiyat serisini hedef para birimine çevirir. Serinin formatı korunur:
 * [tarih, kapanış, açılış, yüksek, düşük]. Kuru bilinmeyen tarihler DÜŞÜRÜLÜR —
 * eksik kuru komşusuyla doldurmak sessizce yanlış rakam üretirdi.
 */
function convertSeries(points, currency, fx, symbol) {
  if (!points?.length || currency === 'native' || !fx) return points
  const usdLookup = buildRateLookup(fx.usdtry)
  const goldLookup = buildRateLookup(fx.goldusd)
  if (currency === 'usd' && !usdLookup) return points
  if (currency === 'gold' && !goldLookup) return points

  const native = symbolCurrency(symbol)
  const out = []
  for (const p of points) {
    const date = p[0]
    // Önce dolara çevir (ortak ara birim), sonra hedefe
    let usdRate = null
    if (native === 'TRY') {
      usdRate = usdLookup?.(date)
      if (!usdRate) continue
    }
    const toUsd = (v) => (native === 'TRY' ? v / usdRate : v)

    let scale
    if (currency === 'usd') {
      scale = (v) => toUsd(v)
    } else {
      const goldOz = goldLookup?.(date)
      if (!goldOz) continue
      const goldPerGram = goldOz / GRAMS_PER_OUNCE
      scale = (v) => toUsd(v) / goldPerGram
    }

    const conv = [date]
    for (let i = 1; i < p.length; i += 1) {
      const v = p[i]
      conv.push(v == null ? v : Number(scale(v).toFixed(6)))
    }
    out.push(conv)
  }
  return out
}

/* ---------- Paylaşılabilir sinyal kartı ----------
 * Hisseyi tek bakışta özetleyen bir PNG üretir (sohbette/sosyalde paylaşmak için).
 * Tamamen istemci tarafında canvas ile çizilir: harici servis, font ya da istek yok.
 * "Yatırım tavsiyesi değildir" ibaresi karta gömülüdür — görsel siteden koparak
 * dolaştığında uyarının onunla birlikte gitmesi gerekir. */

// Kartta en fazla kaç satır gösterilir (yüksekliğe sığan sayı).
const SHARE_CARD_ROWS = 8
const SHARE_SITE_LABEL = 'keremcan534.github.io/borsa-tarama'
const SHARE_CARD_W = 1080
const SHARE_CARD_H = 1080

function drawShareCard(canvas, { symbol, stock, score, lang }) {
  const ctx = canvas.getContext('2d')
  canvas.width = SHARE_CARD_W
  canvas.height = SHARE_CARD_H

  const name = displaySymbol(symbol)
  const change = stock?.change
  const up = (change ?? 0) >= 0

  // Arka plan: koyu, hafif degrade (açık/koyu temadan bağımsız sabit görsel kimlik)
  const bg = ctx.createLinearGradient(0, 0, SHARE_CARD_W, SHARE_CARD_H)
  bg.addColorStop(0, '#12141a')
  bg.addColorStop(1, '#1c2030')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, SHARE_CARD_W, SHARE_CARD_H)

  // Üstte ince vurgu şeridi
  const accent = ctx.createLinearGradient(0, 0, SHARE_CARD_W, 0)
  accent.addColorStop(0, '#7c3aed')
  accent.addColorStop(1, '#a855f7')
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, SHARE_CARD_W, 10)

  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '600 30px system-ui, sans-serif'
  ctx.fillText(t(lang, 'brand').toUpperCase(), 80, 110)

  // Sembol
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 140px system-ui, sans-serif'
  ctx.fillText(name, 80, 270)

  // Günlük değişim (kartın ana rakamı)
  ctx.fillStyle = up ? '#4ade80' : '#f87171'
  ctx.font = '800 110px system-ui, sans-serif'
  ctx.fillText(change == null ? '—' : `${up ? '+' : ''}${(change * 100).toFixed(2)}%`, 80, 410)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '400 32px system-ui, sans-serif'
  ctx.fillText(t(lang, 'shareChangeLabel'), 80, 460)

  // Metrik kutuları
  const metrics = [
    [t(lang, 'colScore'), score == null ? '—' : String(score)],
    [t(lang, 'colClose'), stock?.close == null ? '—' : formatNum(stock.close, 2)],
    ['RSI', stock?.rsi == null ? '—' : formatNum(stock.rsi, 1)],
    [t(lang, 'colPe'), stock?.pe == null ? '—' : formatNum(stock.pe, 1)],
  ]
  let y = 540
  for (const [label, value] of metrics) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(80, y, SHARE_CARD_W - 160, 96)
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = '500 34px system-ui, sans-serif'
    ctx.fillText(label, 110, y + 60)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 40px system-ui, sans-serif'
    ctx.fillText(value, SHARE_CARD_W - 110, y + 60)
    ctx.textAlign = 'left'
    y += 112
  }

  // Tarih + zorunlu uyarı (görselden koparılamaz)
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.font = '400 28px system-ui, sans-serif'
  ctx.fillText(new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'tr-TR'), 80, SHARE_CARD_H - 120)

  ctx.fillStyle = 'rgba(255,255,255,0.38)'
  ctx.font = '400 24px system-ui, sans-serif'
  ctx.fillText(t(lang, 'shareDisclaimer'), 80, SHARE_CARD_H - 70)
}

/** Kartı PNG olarak indirir. */
function downloadShareCard(opts) {
  const canvas = document.createElement('canvas')
  drawShareCard(canvas, opts)
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${displaySymbol(opts.symbol)}-${new Date().toISOString().slice(0, 10)}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, 'image/png')
}

/* ---------- Portföy çeşitliliği (korelasyon + sektör yoğunluğu) ----------
 * Backtest'in "en fazla 10 pozisyon" kuralı örtük olarak ÇEŞİTLİLİK varsayar.
 * 10 pozisyonun hepsi aynı sektörde ve birlikte hareket ediyorsa bu 10 ayrı bahis
 * değil, tek bir bahsin 10 katıdır — ve düşüşte hepsi birlikte düşer. */

/** Fiyat serisinden günlük getiri dizisi (tarih → getiri) üretir. */
function returnsByDate(points) {
  const map = new Map()
  if (!points?.length) return map
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1][1]
    const cur = points[i][1]
    if (prev > 0 && cur > 0) map.set(points[i][0], cur / prev - 1)
  }
  return map
}

/** İki getiri serisinin ORTAK tarihlerdeki Pearson korelasyonu. */
function correlation(aMap, bMap) {
  const xs = []
  const ys = []
  for (const [date, av] of aMap) {
    const bv = bMap.get(date)
    if (bv != null) {
      xs.push(av)
      ys.push(bv)
    }
  }
  // 30 ortak günden azsa korelasyon gürültüdür; hesaplamak yerine "bilinmiyor" de
  if (xs.length < 30) return null
  const n = xs.length
  const mx = xs.reduce((s, v) => s + v, 0) / n
  const my = ys.reduce((s, v) => s + v, 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i += 1) {
    const a = xs[i] - mx
    const b = ys[i] - my
    num += a * b
    dx += a * a
    dy += b * b
  }
  const den = Math.sqrt(dx * dy)
  return den > 0 ? num / den : null
}

/**
 * Pozisyonların ortalama ikili korelasyonu ve en yoğun sektör payı.
 * Dönen `level`: 'ok' | 'warn' | 'risk' — arayüzdeki uyarının şiddeti.
 */
function diversificationOf(symbols, seriesOf, sectorOf) {
  if (symbols.length < 2) return null

  const maps = symbols.map((s) => returnsByDate(seriesOf(s)))
  const pairs = []
  for (let i = 0; i < symbols.length; i += 1) {
    for (let j = i + 1; j < symbols.length; j += 1) {
      const c = correlation(maps[i], maps[j])
      if (c != null) pairs.push(c)
    }
  }
  const avgCorr = pairs.length ? pairs.reduce((s, v) => s + v, 0) / pairs.length : null

  const counts = new Map()
  for (const s of symbols) {
    const sec = sectorOf(s)
    if (sec) counts.set(sec, (counts.get(sec) || 0) + 1)
  }
  let topSector = null
  let topCount = 0
  for (const [sec, n] of counts) {
    if (n > topCount) {
      topSector = sec
      topCount = n
    }
  }
  const sectorShare = symbols.length ? topCount / symbols.length : 0

  const level =
    (avgCorr != null && avgCorr >= 0.7) || sectorShare >= 0.6
      ? 'risk'
      : (avgCorr != null && avgCorr >= 0.5) || sectorShare >= 0.4
        ? 'warn'
        : 'ok'

  return { avgCorr, topSector, topCount, sectorShare, level, pairCount: pairs.length }
}

/**
 * Tablo sıralama karşılaştırıcısı. Veri OLMAYAN satırlar yönden bağımsız olarak
 * hep sona gider: "F/K'ya artan sırala" diyen kullanıcı en ucuz hisseyi arıyordur,
 * verisi olmayan satır yığınını değil.
 */
function compareRows(a, b, key, dir) {
  if (key === 'symbol') {
    return dir === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol)
  }
  const av = a[key]
  const bv = b[key]
  const aMissing = av == null || Number.isNaN(av)
  const bMissing = bv == null || Number.isNaN(bv)
  if (aMissing || bMissing) return aMissing && bMissing ? 0 : aMissing ? 1 : -1
  return dir === 'asc' ? av - bv : bv - av
}

/** Seçili para biriminde dönem getirisi: (son / ilk - 1). Kıyas için tek rakam. */
function seriesReturn(points) {
  if (!points || points.length < 2) return null
  const first = points[0][1]
  const last = points[points.length - 1][1]
  if (!(first > 0)) return null
  return last / first - 1
}

const DEFAULT_FILTERS = {
  rsi: 70,
  stochK: 80,
  stochRsiK: 80,
  macdPositive: true,
  emas: { 9: true, 21: true, 50: true, 200: true },
  sectors: [], // boş = tüm sektörler
}

// Hazır tarama şablonları: filtre paneli yeni kullanıcı için karmaşık; tek tıkla
// anlamlı bir taramaya inmeyi sağlar. Eşikler ÜST sınırdır (aşırı alımı eler).
const FILTER_PRESETS = [
  {
    key: 'strong',
    i18nKey: 'presetStrong',
    // Fiyat tüm EMA'ların üstünde + MACD pozitif; momentum sınırı gevşek
    filters: { rsi: 80, stochK: 90, stochRsiK: 90, macdPositive: true, emas: { 9: true, 21: true, 50: true, 200: true } },
  },
  {
    key: 'momentum',
    i18nKey: 'presetMomentum',
    // Kısa EMA'ların üstünde, MACD pozitif, henüz aşırı alımda değil
    filters: { rsi: 65, stochK: 70, stochRsiK: 70, macdPositive: true, emas: { 9: true, 21: true, 50: false, 200: false } },
  },
  {
    key: 'oversold',
    i18nKey: 'presetOversold',
    // Düşük RSI/stokastik: aşırı satım bölgesi (trend/MACD şartı yok)
    filters: { rsi: 45, stochK: 30, stochRsiK: 30, macdPositive: false, emas: { 9: false, 21: false, 50: false, 200: false } },
  },
]

function filtersMatchPreset(filters, preset, availableEmas) {
  const f = preset.filters
  if (filters.rsi !== f.rsi || filters.stochK !== f.stochK || filters.stochRsiK !== f.stochRsiK) return false
  if (filters.macdPositive !== f.macdPositive) return false
  return availableEmas.every((p) => Boolean(filters.emas[p]) === Boolean(f.emas[p]))
}

function formatNum(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return '—'
  return Number(value).toLocaleString('tr-TR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function formatMarketCap(value) {
  if (value == null) return '—'
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  return value.toLocaleString('tr-TR')
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-box" style={{ margin: 24 }}>
          Sayfa yüklenirken hata oluştu: {this.state.error.message}
          <br />
          <button
            className="btn primary"
            style={{ marginTop: 12 }}
            onClick={() => window.location.reload()}
          >
            Yeniden yükle
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function tvSymbol(symbol) {
  if (COMMODITY_INFO[symbol]) return COMMODITY_INFO[symbol].tv
  return symbol.endsWith('.IS') ? `BIST:${symbol.replace('.IS', '')}` : symbol
}

function rsiTone(rsi) {
  if (rsi >= 65) return 'hot'
  if (rsi >= 55) return 'warm'
  return 'cool'
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))

// RSI sağlığı 0..1: 55-65 bandında zirve; aşırı alım/satımda düşer
function rsiHealth(rsi) {
  if (rsi >= 55 && rsi <= 65) return 1
  if (rsi > 65) return clamp(1 - (rsi - 65) / 20, 0.2, 1) // 65→1, 85→0.2
  return clamp(0.3 + ((rsi - 30) / 25) * 0.7, 0.3, 1) // 30→0.3, 55→1
}

// Tüm göstergeleri harmanlayan 0-100 teknik güç puanı.
// Trend hizası (40) + MACD momentumu (25) + RSI sağlığı (20) + Stokastik alanı (15)
function technicalScore(s, emaPeriods) {
  const emasAbove = emaPeriods.filter((p) => s.close > s[`ema_${p}`]).length
  const trend = emaPeriods.length ? (emasAbove / emaPeriods.length) * 40 : 0
  const ratio = s.close ? s.macd_line / s.close : 0
  const macd = s.macd_line > 0 ? clamp(ratio / 0.015, 0, 1) * 25 : 0
  const rsi = rsiHealth(s.rsi) * 20
  const stoch = clamp((100 - s.stoch_k) / 100, 0, 1) * 15
  return Math.round(trend + macd + rsi + stoch)
}

function scoreTone(score) {
  if (score >= 75) return 'strong'
  if (score >= 55) return 'good'
  return 'weak'
}

// Ticker/isimden üretilen tutarlı renkli monogram rozeti (harici logo servisi gerektirmez)
/**
 * Sembol rozeti: gerçek şirket logosu DEĞİL, koddan türetilen iki harf.
 *
 * Eskiden her sembole isminden türetilen rastgele doygun bir renk atanıyordu;
 * ekranda yan yana onlarca farklı renk "yapay zekaya çizdirilmiş" bir izlenim
 * bırakıyordu. Artık tek nötr yüzey kullanılıyor — rozet bir dekor değil,
 * satırı taramayı kolaylaştıran tipografik bir işaret.
 */
function TickerLogo({ symbol }) {
  const t = displaySymbol(symbol)
  return (
    <span className="ticker-logo" aria-hidden="true">
      {t.slice(0, 2).toUpperCase()}
    </span>
  )
}

// i18nKey verilen kolonun başlığı sözlükten gelir; verilmeyenler (RSI, MACD gibi
// evrensel gösterge adları) her iki dilde de aynı kaldığından label yeterli.
const COLUMNS = [
  { key: 'symbol', label: 'Sembol', i18nKey: 'colSymbol', align: 'left' },
  { key: 'score', label: 'Puan', i18nKey: 'colScore' },
  { key: 'close', label: 'Kapanış', i18nKey: 'colClose' },
  { key: 'change', label: 'Değişim', i18nKey: 'colChange' },
  { key: 'market_cap', label: 'Piyasa Değeri', i18nKey: 'colMcap' },
  { key: 'relative_strength', label: 'Göreli Güç', i18nKey: 'colRs' },
  // Temel oranlar: "teknik güçlü ama pahalı mı?" sorusuna cevap. Kaynak (yfinance)
  // BIST'te bayat/tutarsız olabildiğinden tabloda ayrı bir uyarı notu var.
  { key: 'pe', label: 'F/K', i18nKey: 'colPe' },
  { key: 'pb', label: 'PD/DD', i18nKey: 'colPb' },
  { key: 'dividend_yield', label: 'Temettü %', i18nKey: 'colDiv' },
  { key: 'rsi', label: 'RSI' },
  { key: 'macd_line', label: 'MACD' },
  { key: 'stoch_k', label: 'Stoch %K' },
  { key: 'stoch_rsi_k', label: 'Stoch RSI %K' },
]

const FUND_COLUMNS = [
  { key: 'symbol', label: 'Fon', i18nKey: 'colFund', align: 'left' },
  { key: 'score', label: 'Puan', i18nKey: 'colScore' },
  { key: 'return_1d', label: 'Bugün %', i18nKey: 'colChange' },
  { key: 'investor_count', label: 'Yatırımcı', i18nKey: 'colInvestors' },
  { key: 'return_1m', label: '1A %' },
  { key: 'return_3m', label: '3A %' },
  { key: 'return_6m', label: '6A %' },
  { key: 'return_1y', label: '1Y %' },
  { key: 'return_ytd', label: 'YTD %' },
  { key: 'volatility', label: 'Vol %' },
  { key: 'sharpe', label: 'Sharpe' },
  { key: 'max_drawdown', label: 'Max DD %' },
  { key: 'portfolio_size', label: 'Büyüklük', i18nKey: 'colSize' },
]

/** Oran yüzdesi (temettü verimi, dağıtım oranı, ROE): DEĞİŞİM değil, seviye.
 *  formatPct'in artı işareti burada yanlış olurdu — "+%11 verim" bir artışı ima eder. */
function formatRatioPct(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(digits)}%`
}

function formatPct(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return '—'
  const pct = value * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(digits)}%`
}

function pctTone(value) {
  if (value == null) return ''
  if (value > 0.02) return 'pos'
  if (value < -0.02) return 'neg'
  return 'flat'
}

function formatRelativeTime(iso, lang = 'tr') {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 60) return t(lang, 'agoMinutes', Math.max(mins, 1))
  const hours = Math.round(mins / 60)
  if (hours < 24) return t(lang, 'agoHours', hours)
  const days = Math.round(hours / 24)
  if (days < 7) return t(lang, 'agoDays', days)
  return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-US' : 'tr-TR')
}

function AdSlot({ id }) {
  // Reklam ağı bağlanana kadar hiçbir şey render edilmez (sahte reklam yok).
  if (!ADS_ENABLED) return null
  return <div className="ad-slot" data-slot={id} />
}

function stockPassesFilters(stock, filters, availableEmas) {
  for (const p of availableEmas) {
    if (filters.emas[p] && !(stock.close > stock[`ema_${p}`])) return false
  }
  if (filters.macdPositive && !(stock.macd_line > 0)) return false
  if (!(stock.rsi < filters.rsi)) return false
  if (!(stock.stoch_k < filters.stochK)) return false
  if (!(stock.stoch_rsi_k < filters.stochRsiK)) return false
  // Sektör filtresi (boşsa hepsi geçer)
  if (filters.sectors?.length && !filters.sectors.includes(stock.sector)) return false
  return true
}

function loadSavedScreens() {
  try {
    const list = JSON.parse(localStorage.getItem('saved_screens') || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function saveSavedScreens(list) {
  localStorage.setItem('saved_screens', JSON.stringify(list))
}

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="9" fill="url(#lg)" />
      <rect x="9" y="21" width="5" height="10" rx="1.5" fill="white" opacity="0.9" />
      <rect x="17.5" y="15" width="5" height="16" rx="1.5" fill="white" opacity="0.9" />
      <rect x="26" y="9" width="5" height="22" rx="1.5" fill="white" opacity="0.9" />
    </svg>
  )
}

// BIST sembolleri yfinance'te '.IS' ekiyle gelir; geri kalan her şey (S&P, ETF,
// emtia/kripto) global tarafa düşer.
const isBistSymbol = (symbol) => symbol.endsWith('.IS')

const NEWS_PER_GROUP = 50

function NewsList({ items, lang, onOpenChart }) {
  return (
    <div className="news-list">
      {items.map((item, i) => (
        <div key={item.link + i}>
          <article className="news-item">
            <div className="news-meta">
              <button className="chip" onClick={() => onOpenChart(item.symbol)}>
                {displaySymbol(item.symbol)}
              </button>
              {item.source && <span className="news-source">{item.source}</span>}
              <span className="news-time">{formatRelativeTime(item.published_at, lang)}</span>
            </div>
            <a className="news-title" href={item.link} target="_blank" rel="noreferrer noopener">
              {item.title}
            </a>
          </article>
          {(i + 1) % 6 === 0 && <AdSlot id={`news-${i}`} />}
        </div>
      ))}
    </div>
  )
}

/**
 * Haberler market sekmesiyle değil, tek akışta BIST/Global bölümleriyle gösterilir:
 * marketlerin üçü (S&P, ETF, emtia) ABD olduğundan market sekmesi kullanıcıyı
 * kolayca ABD akışında bırakıyordu.
 */
function NewsFeed({ news, loading, error, lang, onOpenChart }) {
  const [query, setQuery] = useState('')
  // 'all' | 'bist' | 'global': tek akışta kaybolmamak için BIST/ABD sekmeleri
  const [scope, setScope] = useState('all')
  const groups = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR')
    let items = news?.items || []
    if (q) {
      items = items.filter(
        (i) =>
          (i.title || '').toLocaleLowerCase('tr-TR').includes(q) ||
          displaySymbol(i.symbol || '').toLocaleLowerCase('tr-TR').includes(q),
      )
    }
    // Tek grup seçiliyken daha fazla haber gösterilebilir
    const cap = scope === 'all' ? NEWS_PER_GROUP : NEWS_PER_GROUP * 2
    return {
      bist: items.filter((i) => isBistSymbol(i.symbol)).slice(0, cap),
      global: items.filter((i) => !isBistSymbol(i.symbol)).slice(0, cap),
    }
  }, [news, query, scope])

  if (loading) return <div className="empty-box">{t(lang, 'newsLoading')}</div>
  if (error) return <div className="error-box">{error}</div>
  if (!news || news.items.length === 0) return <div className="empty-box">{t(lang, 'newsEmpty')}</div>

  const sections = [
    { key: 'bist', title: t(lang, 'newsBist'), items: groups.bist },
    { key: 'global', title: t(lang, 'newsGlobal'), items: groups.global },
  ].filter((s) => s.items.length > 0 && (scope === 'all' || s.key === scope))

  const scopeTabs = [
    { key: 'all', i18nKey: 'newsTabAll' },
    { key: 'bist', i18nKey: 'newsTabBist' },
    { key: 'global', i18nKey: 'newsTabGlobal' },
  ]

  return (
    <div className="news-groups">
      <div className="tabs news-scope-tabs" role="group" aria-label={t(lang, 'newsTabAll')}>
        {scopeTabs.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`tab ${scope === s.key ? 'active' : ''}`}
            onClick={() => setScope(s.key)}
          >
            {t(lang, s.i18nKey)}
          </button>
        ))}
      </div>
      <div className="search-row">
        <input
          className="search-input"
          type="search"
          placeholder={t(lang, 'newsSearch')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {sections.length === 0 && (
        <div className="empty-box">{t(lang, 'newsNoMatch', query.trim())}</div>
      )}
      {sections.map((section) => (
        <section key={section.key} className="news-group">
          <h2 className="news-group-title">
            {section.title}
            <span className="news-group-count">{section.items.length}</span>
          </h2>
          <NewsList items={section.items} lang={lang} onOpenChart={onOpenChart} />
        </section>
      ))}
    </div>
  )
}

/**
 * Hisse detay istatistikleri: teknik göstergeler, EMA trend hizası, 52 hafta
 * aralığı, skor geçmişi ve hisseyi taşıyan fonlar. ChartModal içinde grafiğin
 * altında gösterilir; her blok verisi olmadığında sessizce gizlenir.
 */
function StockDetailStats({ stock, positions, scoreSeries, series, lang, dividend }) {
  const emaPeriods = stock ? [9, 21, 50, 200].filter((p) => stock[`ema_${p}`] != null) : []
  const score = stock ? technicalScore(stock, emaPeriods) : null

  // 52 hafta aralığı: hisse serisi ~270 günlük kapanış taşır (≈ 52 hafta)
  const range = useMemo(() => {
    const pts = cleanFundPoints(series)
    if (pts.length < 5) return null
    const pxs = pts.map((p) => p.px)
    const hi = Math.max(...pxs)
    const lo = Math.min(...pxs)
    const last = pxs[pxs.length - 1]
    if (!(hi > lo)) return null
    return { hi, lo, last, fromHigh: last / hi - 1, pos: (last - lo) / (hi - lo) }
  }, [series])

  // Fonlar: en son ayki ağırlığa göre ilk 6
  const funds = useMemo(() => {
    const list = positions?.funds || []
    const latestWeight = (row) => {
      const ms = Object.keys(row.positions || {}).sort()
      for (let i = ms.length - 1; i >= 0; i -= 1) {
        const w = row.positions[ms[i]]?.weight
        if (w != null) return w
      }
      return null
    }
    return list
      .map((row) => ({ code: row.fund_code, name: row.fund_name, weight: latestWeight(row) }))
      .filter((r) => r.weight != null)
      .sort((a, b) => b.weight - a.weight)
  }, [positions])

  const metric = (label, value, cls = '') =>
    value == null || value === '—' ? null : (
      <div className="sd-metric">
        <span className="sd-metric-label">{label}</span>
        <span className={`sd-metric-value ${cls}`}>{value}</span>
      </div>
    )

  const hasFundamentals =
    stock && (stock.pe != null || stock.pb != null || stock.roe != null)

  const hasAnything =
    stock || range || funds.length || dividend || (scoreSeries && scoreSeries.length > 1)
  if (!hasAnything) return null

  return (
    <div className="sd-stats">
      {stock && (
        <div className="sd-block">
          <div className="sd-block-title">{t(lang, 'sdStats')}</div>
          <div className="sd-metrics">
            {metric(t(lang, 'colScore'), score != null ? <span className={`badge score-${scoreTone(score)}`}>{score}</span> : null)}
            {metric('RSI', stock.rsi != null ? <span className={`badge rsi-${rsiTone(stock.rsi)}`}>{formatNum(stock.rsi, 1)}</span> : null)}
            {metric('MACD', stock.macd_line != null ? formatNum(stock.macd_line, 2) : null, stock.macd_line > 0 ? 'pos' : 'neg')}
            {metric('Stoch %K', stock.stoch_k != null ? formatNum(stock.stoch_k, 1) : null)}
            {metric('Stoch RSI %K', stock.stoch_rsi_k != null ? formatNum(stock.stoch_rsi_k, 1) : null)}
            {metric(t(lang, 'colRs'), stock.relative_strength != null ? formatPct(stock.relative_strength, 1) : null, pctTone(stock.relative_strength))}
          </div>
        </div>
      )}

      {hasFundamentals && (
        <div className="sd-block">
          <div className="sd-block-title">{t(lang, 'sdFundamentals')}</div>
          <div className="sd-metrics">
            {metric(t(lang, 'colPe'), stock.pe != null ? formatNum(stock.pe, 1) : null)}
            {metric(t(lang, 'colPb'), stock.pb != null ? formatNum(stock.pb, 2) : null)}
            {metric(t(lang, 'colRoe'), stock.roe != null ? formatRatioPct(stock.roe, 1) : null, pctTone(stock.roe))}
            {/* Kaynağın hazır temettü verimi bilerek gösterilmiyor: aşağıdaki
                temettü bloğu aynı sayıyı gerçek ödemelerden hesaplıyor ve iki
                farklı "%" yan yana durursa hangisinin doğru olduğu belirsizleşir. */}
          </div>
        </div>
      )}

      {dividend && (
        <div className="sd-block">
          <div className="sd-block-title">{t(lang, 'sdDividend')}</div>
          <div className="sd-metrics">
            {/* Verim burada ÖDEMELERDEN hesaplanmıştır (dividends.json), kaynağın
                hazır alanı değil — ikisi ayrışabildiği için etiketi de dönemli. */}
            {metric(
              t(lang, 'sdDivYield'),
              dividend.yield_ttm != null ? formatRatioPct(dividend.yield_ttm, 2) : null,
              'pos',
            )}
            {metric(
              t(lang, 'sdDivLast'),
              dividend.last_date
                ? `${new Date(dividend.last_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'tr-TR')} · ${formatNum(dividend.last_amount, 2)}`
                : null,
            )}
            {metric(
              t(lang, 'sdDivNext'),
              dividend.next_ex_date
                ? `${new Date(dividend.next_ex_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'tr-TR')} (${t(lang, 'dvdDays', dividend.days_to_ex)})`
                : null,
            )}
            {metric(t(lang, 'dvdColYears'), dividend.years_paid || null)}
          </div>
        </div>
      )}

      {emaPeriods.length > 0 && (
        <div className="sd-block">
          <div className="sd-block-title">{t(lang, 'sdTrendTitle')}</div>
          <div className="sd-ema-row">
            {emaPeriods.map((p) => {
              const above = stock.close > stock[`ema_${p}`]
              return (
                <span
                  key={p}
                  className={`sd-ema ${above ? 'above' : 'below'}`}
                  title={above ? t(lang, 'sdTrendAbove') : t(lang, 'sdTrendBelow')}
                >
                  {above ? '▲' : '▼'} EMA {p}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {range && (
        <div className="sd-block">
          <div className="sd-block-title">{t(lang, 'sd52wTitle')}</div>
          <div className="sd-range">
            <div className="sd-range-bar">
              <div className="sd-range-fill" style={{ width: `${Math.round(range.pos * 100)}%` }} />
              <span className="sd-range-dot" style={{ left: `${Math.round(range.pos * 100)}%` }} />
            </div>
            <div className="sd-range-labels">
              <span>{t(lang, 'sd52Low')}: {formatNum(range.lo, 2)}</span>
              <span className={`pct ${pctTone(range.fromHigh)}`}>{formatPct(range.fromHigh, 1)} {t(lang, 'sdFromHigh')}</span>
              <span>{t(lang, 'sd52High')}: {formatNum(range.hi, 2)}</span>
            </div>
          </div>
        </div>
      )}

      {scoreSeries && scoreSeries.length > 1 && (
        <div className="sd-block">
          <div className="sd-block-title">{t(lang, 'sdScoreHistory')}</div>
          <Sparkline points={scoreSeries} days={40} />
        </div>
      )}

      {positions && (
        <div className="sd-block">
          <div className="sd-block-title">{t(lang, 'sdFundsTitle')}</div>
          {funds.length === 0 ? (
            <p className="sd-funds-empty">{t(lang, 'sdFundsEmpty')}</p>
          ) : (
            <div className="sd-funds">
              {funds.slice(0, 6).map((f) => (
                <div key={f.code} className="sd-fund">
                  <TickerLogo symbol={f.code} />
                  <span className="sd-fund-code">
                    <strong>{f.code}</strong>
                    {f.name && <span className="fund-name">{f.name}</span>}
                  </span>
                  <span className="sd-fund-weight">%{formatNum(f.weight, 2)}</span>
                </div>
              ))}
              {funds.length > 6 && <div className="sd-fund-more">{t(lang, 'sdMore', funds.length - 6)}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------------------------- Paylaşım altyapısı ----------------------------
 * Amaç: bir ekranı görsel olarak X'te paylaşmak ya da veriyi Excel'de açmak.
 * Kart, DOM'un ekran görüntüsü DEĞİL, canvas'a çizilen amaca özel bir görsel:
 * html2canvas gibi bir bağımlılık eklemeden her temada aynı görünür ve
 * yatırım tavsiyesi uyarısı görselden koparılamaz.
 */

/** Metni verilen piksel genişliğine sığdırır, taşarsa sonuna … koyar. */
function ellipsize(ctx, text, maxWidth) {
  const value = String(text ?? '')
  if (maxWidth <= 0 || ctx.measureText(value).width <= maxWidth) return value
  let cut = value
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1)
  }
  return `${cut}…`
}

/** Başlık + satır listesi taşıyan genel paylaşım kartı (tek hisse kartıyla aynı kimlik). */
function drawListCard(canvas, { title, subtitle, rows, lang }) {
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

function cardToBlob(draw) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    draw(canvas)
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

function downloadBlob(blob, filename) {
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
function shareToX({ text, url }) {
  const params = new URLSearchParams({ text, url })
  window.open(`https://x.com/intent/post?${params.toString()}`, '_blank', 'noopener,noreferrer')
}

/** Telefonun yerel paylaş menüsü; destekliyorsa görseli de ekler. */
async function nativeShare({ title, text, url, blob, filename }) {
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
function ShareBar({ lang, csv, card, shareText, onMessage }) {
  const [busy, setBusy] = useState(false)
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
          onClick={async () => {
            // Kart varsa önce indirilir: X intent'i dosya taşıyamadığından
            // kullanıcının görseli tweete elle eklemesi gerekiyor.
            if (card) await saveCard()
            shareToX({ text: shareText, url: window.location.href })
            onMessage?.(t(lang, 'shareXDone'))
          }}
        >
          𝕏 {t(lang, 'shareX')}
        </button>
      )}
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

function ChartModal({ symbol, news, onClose, lang = 'tr', series, seriesLoading, stock, positions, scoreSeries, fx, onCompare, dividend }) {
  // TL / $ / gram altın: TL bazlı bir getirinin reelde ne olduğunu göstermek için
  const [currency, setCurrency] = useState('native')

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // BIST verisi TradingView'in anonim embed widget'ında yok (abonelik istiyor);
  // widget sembolü çözemeyince varsayılan AAPL gösteriyordu. BIST hisseleri
  // kendi serimizden çizilir; TV iframe'i yalnızca çalıştığı yerde (ABD/emtia) kalır.
  const isBist = symbol.endsWith('.IS')

  // Seçili para biriminde seri + o birimdeki dönem getirisi
  const shownSeries = useMemo(
    () => convertSeries(series, currency, fx, symbol),
    [series, currency, fx, symbol],
  )
  const periodReturn = useMemo(() => seriesReturn(shownSeries), [shownSeries])
  // Kur serisi yoksa ilgili seçeneği hiç gösterme (yanlış rakam göstermektense gizle)
  const availableCurrencies = CURRENCIES.filter(
    (c) =>
      c.key === 'native' ||
      (c.key === 'usd' ? fx?.usdtry?.length : fx?.usdtry?.length && fx?.goldusd?.length),
  )

  const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  const src =
    'https://s.tradingview.com/widgetembed/?' +
    new URLSearchParams({
      symbol: tvSymbol(symbol),
      interval: 'D',
      theme: dark ? 'dark' : 'light',
      locale: 'tr',
      hidesidetoolbar: '1',
      allow_symbol_change: '0',
    }).toString()

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-stock" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>{displaySymbol(symbol)}</strong>
          <div className="modal-actions">
            {onCompare && isBist && (
              <button
                className="btn small"
                onClick={() => {
                  onCompare(symbol)
                  onClose()
                }}
              >
                {t(lang, 'fundCompareAction')}
              </button>
            )}
            <button
              className="btn small"
              type="button"
              title={t(lang, 'shareCardHint')}
              onClick={() =>
                downloadShareCard({
                  symbol,
                  stock,
                  score: stock ? technicalScore(stock, [9, 21, 50, 200].filter((p) => stock[`ema_${p}`] != null)) : null,
                  lang,
                })
              }
            >
              🖼 {t(lang, 'shareCard')}
            </button>
            <a
              className="btn small"
              href={`https://tr.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol(symbol))}`}
              target="_blank"
              rel="noreferrer"
            >
              TradingView'da aç ↗
            </a>
            <button className="btn small" onClick={onClose}>
              Kapat ✕
            </button>
          </div>
        </div>
        {/* Para birimi anahtarı: yalnızca kendi çizdiğimiz grafikte anlamlı
            (TradingView iframe'i kendi verisini gösterir, çeviremeyiz). */}
        {isBist && series?.length > 0 && availableCurrencies.length > 1 && (
          <div className="currency-row">
            <div className="tabs currency-tabs" role="group" aria-label={t(lang, 'curLabel')}>
              {availableCurrencies.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={`tab ${currency === c.key ? 'active' : ''}`}
                  onClick={() => setCurrency(c.key)}
                >
                  {t(lang, c.i18nKey)}
                </button>
              ))}
            </div>
            {periodReturn != null && (
              <span className="currency-return">
                {t(lang, 'curPeriodReturn')}{' '}
                <strong className={`pct ${pctTone(periodReturn)}`}>{formatPct(periodReturn, 1)}</strong>
              </span>
            )}
          </div>
        )}

        {isBist ? (
          series?.length ? (
            <div className="modal-own-chart">
              <FundPriceChart points={shownSeries} lang={lang} showEma />
              {currency !== 'native' && <p className="currency-note">{t(lang, 'curNote')}</p>}
            </div>
          ) : (
            <div className="empty-box modal-chart-empty">
              {seriesLoading ? t(lang, 'loading') : t(lang, 'stockChartPending')}
            </div>
          )
        ) : (
          <iframe title={`${symbol} grafiği`} src={src} className="chart-frame" />
        )}
        <StockDetailStats
          stock={stock}
          positions={positions}
          scoreSeries={scoreSeries}
          series={series}
          lang={lang}
          dividend={dividend}
        />
        {news && news.length > 0 && (
          <div className="modal-news">
            <div className="modal-news-title">📰 Son haberler</div>
            {news.slice(0, 3).map((item, i) => (
              <a
                key={item.link + i}
                className="modal-news-item"
                href={item.link}
                target="_blank"
                rel="noreferrer noopener"
              >
                <span className="news-time">{formatRelativeTime(item.published_at)}</span> {item.title}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// TEFAS fonlarının günlük fiyat (pay değeri) serisi fund_prices.json'dan gelir;
// gerçek bir zaman-fiyat grafiği çizmek için kullanılır.
const FUND_CHART_PERIODS = [
  { key: '1m', days: 30, label: '1A', labelEn: '1M' },
  { key: '3m', days: 90, label: '3A', labelEn: '3M' },
  { key: '6m', days: 180, label: '6A', labelEn: '6M' },
  { key: 'ytd', days: null, label: 'YTD', labelEn: 'YTD' },
  { key: '1y', days: 365, label: '1Y', labelEn: '1Y' },
]

function fundPeriodStartMs(periodKey, lastMs) {
  const p = FUND_CHART_PERIODS.find((x) => x.key === periodKey)
  if (!p) return lastMs - 90 * 86400000
  if (p.key === 'ytd') {
    const d = new Date(lastMs)
    return Date.UTC(d.getUTCFullYear(), 0, 1)
  }
  return lastMs - p.days * 86400000
}

/** [[YYYY-MM-DD, price], ...] → temiz, sıralı [{t, px}] (tümü). */
function cleanFundPoints(points) {
  if (!points?.length) return []
  // Format: [tarih, kapanış] (fonlar) veya [tarih, kapanış, açılış, yüksek, düşük]
  // (hisseler, mum grafiği için). Index 1 her iki formatta da kapanıştır.
  const fin = (v) => (Number.isFinite(v) ? v : null)
  return points
    .map(([d, c, o, h, l]) => ({
      t: Date.parse(d),
      px: Number(c),
      o: fin(Number(o)),
      h: fin(Number(h)),
      l: fin(Number(l)),
    }))
    .filter((x) => Number.isFinite(x.t) && Number.isFinite(x.px) && x.px > 0)
    .sort((a, b) => a.t - b.t)
}

/** [[YYYY-MM-DD, price], ...] → seçili dönemde sıralı [{t, px}] noktaları. */
function parseFundSeries(points, periodKey) {
  const parsed = cleanFundPoints(points)
  if (parsed.length < 2) return parsed
  const last = parsed[parsed.length - 1].t
  const start = fundPeriodStartMs(periodKey, last)
  const window = parsed.filter((x) => x.t >= start)
  return window.length >= 2 ? window : parsed
}

/**
 * Tam seri üzerinde EMA hesaplar ([{t, v}]). EMA pencereye göre değil tüm
 * geçmişe göre hesaplanır: 200-EMA'nın 3 aylık görünümde de anlamlı olması için
 * (aksi halde ilk gün fiyata eşitlenip çarpık başlardı).
 */
function emaOverPoints(full, n) {
  if (full.length < n) return []
  const k = 2 / (n + 1)
  let ema = full[0].px
  const out = []
  for (let i = 0; i < full.length; i += 1) {
    ema = i === 0 ? full[0].px : full[i].px * k + ema * (1 - k)
    // İlk n mumda EMA henüz "ısınmadı"; çizmeyip yanıltıcı düz başlangıçtan kaçınırız
    if (i >= n - 1) out.push({ t: full[i].t, v: ema })
  }
  return out
}

const EMA_DEFS = [
  { n: 20, color: '#2563eb' },
  { n: 50, color: '#d97706' },
  { n: 200, color: '#7c3aed' },
]

/** Tablo satırı için minik trend çizgisi (son ~3 ay). Eksen/etiket yok. */
function Sparkline({ points, days = 90 }) {
  const line = useMemo(() => {
    const full = cleanFundPoints(points)
    if (full.length < 2) return null
    const start = full[full.length - 1].t - days * 86400000
    const win = full.filter((p) => p.t >= start)
    const data = win.length >= 2 ? win : full.slice(-2)
    const W = 88
    const H = 26
    const xs = data.map((p) => p.t)
    const ys = data.map((p) => p.px)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const x = (t) => ((t - minX) / (maxX - minX || 1)) * (W - 2) + 1
    const y = (v) => H - 2 - ((v - minY) / (maxY - minY || 1)) * (H - 4)
    const d = data.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.px).toFixed(1)}`).join(' ')
    const up = data[data.length - 1].px >= data[0].px
    return { d, up, W, H }
  }, [points, days])

  if (!line) return <span className="spark-empty">—</span>
  return (
    <svg className="sparkline" viewBox={`0 0 ${line.W} ${line.H}`} width={line.W} height={line.H} aria-hidden="true">
      <path d={line.d} fill="none" className={line.up ? 'up' : 'down'} />
    </svg>
  )
}

function formatFundPrice(value, lang) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${Number(value).toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })} ₺`
}

function fundAxisPrice(v) {
  const a = Math.abs(v)
  if (a >= 100) return v.toFixed(0)
  if (a >= 1) return v.toFixed(2)
  return v.toFixed(4)
}

function nearestFundPoint(points, t) {
  let best = points[0]
  let bestDist = Math.abs(points[0].t - t)
  for (let i = 1; i < points.length; i += 1) {
    const dist = Math.abs(points[i].t - t)
    if (dist < bestDist) {
      best = points[i]
      bestDist = dist
    }
  }
  return best
}

/**
 * Tek fonun pay değeri zaman serisini gerçek eksenlerle (tarih + fiyat) çizen
 * çizgi grafik. Fareyle üzerine gelince tarih/fiyat/getiri gösteren tooltip verir.
 */
function FundPriceChart({ points, lang, showEma = false }) {
  const [period, setPeriod] = useState('3m')
  const [hover, setHover] = useState(null)
  const [emaOn, setEmaOn] = useState(false)
  const [candleOn, setCandleOn] = useState(false)
  const full = useMemo(() => cleanFundPoints(points), [points])
  const data = useMemo(() => parseFundSeries(points, period), [points, period])
  // Mum grafiği yalnızca OHLC taşıyan serilerde (hisseler) mümkün; fonlarda kapanış var
  const hasOhlc = useMemo(() => data.some((d) => d.o != null && d.h != null && d.l != null), [data])
  const candle = candleOn && hasOhlc

  // EMA'lar tam seriden hesaplanıp görünen pencereye kırpılır (aşağıda minT ile)
  const emaLines = useMemo(() => {
    if (!showEma || !emaOn) return []
    return EMA_DEFS.map((d) => ({ ...d, pts: emaOverPoints(full, d.n) })).filter((l) => l.pts.length)
  }, [showEma, emaOn, full])

  const W = 640
  const H = 240
  const pad = { t: 14, r: 16, b: 26, l: 52 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b
  const locale = lang === 'en' ? 'en-US' : 'tr-TR'

  const selector = (
    <div className="fund-price-periods">
      {FUND_CHART_PERIODS.map((p) => (
        <button
          key={p.key}
          type="button"
          className={`fund-price-period ${period === p.key ? 'active' : ''}`}
          onClick={() => setPeriod(p.key)}
        >
          {lang === 'en' ? p.labelEn : p.label}
        </button>
      ))}
      {hasOhlc && (
        <button
          type="button"
          className={`fund-price-period ${candle ? 'active' : ''}`}
          onClick={() => setCandleOn((v) => !v)}
        >
          {t(lang, 'chartCandle')}
        </button>
      )}
      {showEma && (
        <button
          type="button"
          className={`fund-price-period fund-price-ema ${emaOn ? 'active' : ''}`}
          title={t(lang, 'emaHint')}
          onClick={() => setEmaOn((v) => !v)}
        >
          EMA
        </button>
      )}
    </div>
  )

  if (data.length < 2) {
    return (
      <div className="fund-price">
        {selector}
        <div className="empty-box">{t(lang, 'fundCompareNoChart')}</div>
      </div>
    )
  }

  const minT = data[0].t
  const maxT = data[data.length - 1].t
  const base = data[0].px
  const last = data[data.length - 1].px
  const totalRet = last / base - 1
  const dir = totalRet >= 0 ? 'up' : 'down'

  // EMA'ları görünen pencereye kırp; ölçeğe dahil et (aksi halde taşarlardı)
  const emaWindows = emaLines
    .map((l) => ({ ...l, pts: l.pts.filter((p) => p.t >= minT) }))
    .filter((l) => l.pts.length >= 2)

  const pxVals = data.map((d) => d.px)
  // Mum modunda fitil uçları (yüksek/düşük) da ölçeğe girsin, taşmasın
  if (candle) for (const d of data) if (d.h != null) pxVals.push(d.h, d.l)
  for (const l of emaWindows) for (const p of l.pts) pxVals.push(p.v)
  const minP = Math.min(...pxVals)
  const maxP = Math.max(...pxVals)
  const span = maxP - minP
  const pPad = Math.max(span * 0.1, minP * 0.002, 1e-6)
  const lo = minP - pPad
  const hi = maxP + pPad

  const x = (tt) => pad.l + ((tt - minT) / (maxT - minT || 1)) * innerW
  const y = (p) => pad.t + (1 - (p - lo) / (hi - lo || 1)) * innerH
  const tFromX = (px) => minT + ((px - pad.l) / (innerW || 1)) * (maxT - minT)

  const linePath = data.map((d, i) => `${i ? 'L' : 'M'}${x(d.t).toFixed(1)},${y(d.px).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${x(maxT).toFixed(1)},${(H - pad.b).toFixed(1)} L${x(minT).toFixed(1)},${(H - pad.b).toFixed(1)} Z`
  const gridVals = [hi, (lo + hi) / 2, lo]

  function onMove(event) {
    const svg = event.currentTarget
    const rect = svg.getBoundingClientRect()
    // Fare + dokunma desteği: mobilde koordinat touches[0]'dan gelir. Sayfa
    // kayması CSS'teki touch-action:none ile engellenir.
    const source = event.touches?.[0] || event.changedTouches?.[0] || event
    if (source.clientX == null) return
    const px = (source.clientX - rect.left) * (W / rect.width)
    if (px < pad.l || px > W - pad.r) {
      setHover(null)
      return
    }
    const point = nearestFundPoint(data, tFromX(px))
    if (!point) {
      setHover(null)
      return
    }
    setHover({ t: point.t, px: point.px, ret: point.px / base - 1 })
  }

  // Tooltip imlecin noktasına sabitlenir; sağ yarıdaysa kendi genişliği kadar
  // sola çevrilir (mobilde ekrandan taşmasın).
  const tipPct = hover ? (x(hover.t) / W) * 100 : 0
  const tipFlip = hover ? x(hover.t) > W * 0.5 : false

  return (
    <div className="fund-price">
      <div className="fund-price-head">
        {selector}
        <span className={`fund-price-change pct ${pctTone(totalRet)}`}>{formatPct(totalRet)}</span>
      </div>
      <div className="fund-price-wrap">
        <svg
          className="fund-price-chart"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={t(lang, 'fundPriceChartLabel')}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          onTouchStart={onMove}
          onTouchMove={onMove}
        >
          {gridVals.map((v) => (
            <g key={v}>
              <line className="fund-price-grid" x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} />
              <text className="fund-price-axis" x={pad.l - 8} y={y(v) + 3} textAnchor="end">
                {fundAxisPrice(v)}
              </text>
            </g>
          ))}
          {candle ? (
            <g className="candles">
              {data.map((d) => {
                const cx = x(d.t)
                const w = Math.max(1.5, Math.min(9, (innerW / data.length) * 0.62))
                const up = d.px >= (d.o ?? d.px)
                const yo = y(d.o ?? d.px)
                const yc = y(d.px)
                const top = Math.min(yo, yc)
                const bh = Math.max(1, Math.abs(yc - yo))
                return (
                  <g key={d.t} className={`candle ${up ? 'up' : 'down'}`}>
                    <line className="candle-wick" x1={cx} x2={cx} y1={y(d.h ?? d.px)} y2={y(d.l ?? d.px)} />
                    <rect className="candle-body" x={cx - w / 2} y={top} width={w} height={bh} />
                  </g>
                )
              })}
            </g>
          ) : (
            <>
              <path className={`fund-price-area ${dir}`} d={areaPath} />
              <path className={`fund-price-line ${dir}`} d={linePath} />
            </>
          )}
          {emaWindows.map((l) => (
            <path
              key={l.n}
              className="fund-price-ema-line"
              d={l.pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}
              stroke={l.color}
              fill="none"
            />
          ))}
          {hover && (
            <g pointerEvents="none">
              <line className="fund-price-crosshair" x1={x(hover.t)} x2={x(hover.t)} y1={pad.t} y2={H - pad.b} />
              <circle className={`fund-price-dot ${dir}`} cx={x(hover.t)} cy={y(hover.px)} r="4" />
            </g>
          )}
          <text className="fund-price-axis" x={pad.l} y={H - 6}>
            {new Date(minT).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
          </text>
          <text className="fund-price-axis" x={W - pad.r} y={H - 6} textAnchor="end">
            {new Date(maxT).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
          </text>
        </svg>
        {hover && (
          <div
            className="fund-price-tooltip"
            style={{
              left: `${tipPct}%`,
              transform: tipFlip ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
            }}
          >
            <div className="fund-price-tooltip-date">
              {new Date(hover.t).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            <div className="fund-price-tooltip-row">
              <strong>{formatFundPrice(hover.px, lang)}</strong>
              <span className={`pct ${pctTone(hover.ret)}`}>{formatPct(hover.ret)}</span>
            </div>
          </div>
        )}
      </div>
      {emaWindows.length > 0 && (
        <div className="fund-price-ema-legend">
          {emaWindows.map((l) => (
            <span key={l.n} className="fund-price-ema-item">
              <span className="fund-price-ema-swatch" style={{ background: l.color }} />
              EMA {l.n}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** TEFAS fonları TradingView'da yok; dönem getirilerini bar grafik olarak gösteriyoruz. */
const FUND_RETURN_BARS = [
  { key: 'return_1d', label: '1G', labelEn: '1D' },
  { key: 'return_1m', label: '1A', labelEn: '1M' },
  { key: 'return_3m', label: '3A', labelEn: '3M' },
  { key: 'return_6m', label: '6A', labelEn: '6M' },
  { key: 'return_ytd', label: 'YTD', labelEn: 'YTD' },
  { key: 'return_1y', label: '1Y', labelEn: '1Y' },
]

function FundReturnsChart({ fund, lang }) {
  const values = FUND_RETURN_BARS.map((p) => fund[p.key]).filter((v) => v != null)
  const maxAbs = Math.max(...values.map(Math.abs), 0.01)

  return (
    <div className="fund-chart" role="img" aria-label={t(lang, 'fundChartLabel')}>
      {FUND_RETURN_BARS.map((p) => {
        const v = fund[p.key]
        const h = v == null ? 0 : (Math.abs(v) / maxAbs) * 100
        return (
          <div key={p.key} className="fund-bar">
            <span className={`fund-bar-val pct ${pctTone(v)}`}>{formatPct(v)}</span>
            <div className="fund-bar-track">
              <div
                className={`fund-bar-fill ${v == null ? '' : v >= 0 ? 'pos' : 'neg'}`}
                style={{ height: `${h}%` }}
              />
            </div>
            <span className="fund-bar-label">{lang === 'en' ? p.labelEn : p.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function FundModal({ fund, news, lang, onClose, onCompare, prices, pricesLoading, funds }) {
  const series = prices?.series?.[fund.symbol]

  // Kategori (addan) + kategori içi puan sırası: fon "ligindeki" yerini gösterir
  const catInfo = useMemo(() => {
    const category = categorizeFund(fund.name)
    const peers = (funds?.results || []).filter((f) => categorizeFund(f.name) === category)
    const sorted = [...peers].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    const rank = sorted.findIndex((f) => f.symbol === fund.symbol) + 1
    return { category, count: peers.length, rank }
  }, [fund, funds])
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-fund" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-fund-title">
            <TickerLogo symbol={fund.symbol} />
            <div>
              <strong>{fund.symbol}</strong>
              {fund.name && <div className="modal-fund-name">{fund.name}</div>}
            </div>
          </div>
          <div className="modal-actions">
            {onCompare && (
              <button
                className="btn small"
                onClick={() => {
                  onCompare(fund.symbol)
                  onClose()
                }}
              >
                {t(lang, 'fundCompareAction')}
              </button>
            )}
            {fund.tefas_url && (
              <a className="btn small" href={fund.tefas_url} target="_blank" rel="noreferrer noopener">
                TEFAS'ta aç ↗
              </a>
            )}
            <button className="btn small" onClick={onClose}>
              Kapat ✕
            </button>
          </div>
        </div>

        <div className="modal-fund-body">
          <div className="modal-fund-score">
            <span className={`badge score-${scoreTone(fund.score)}`}>{fund.score}</span>
            <span className="modal-fund-score-label">{t(lang, 'colScore')}</span>
            <span className="fund-cat-chip">{t(lang, catI18nKey(catInfo.category))}</span>
            {catInfo.rank > 0 && catInfo.count > 1 && (
              <span className="fund-cat-rank">{t(lang, 'fundCategoryRank', catInfo.rank, catInfo.count)}</span>
            )}
          </div>
          <div className="fund-price-section">
            <div className="fund-section-title">{t(lang, 'fundPriceTitle')}</div>
            {series?.length ? (
              <FundPriceChart points={series} lang={lang} />
            ) : (
              <div className="empty-box">
                {pricesLoading ? t(lang, 'fundCompareLoading') : t(lang, 'fundCompareNoPrices')}
              </div>
            )}
          </div>
          <div className="fund-returns-section">
            <div className="fund-section-title">{t(lang, 'fundChartLabel')}</div>
            <FundReturnsChart fund={fund} lang={lang} />
          </div>
          <div className="fund-metrics">
            <div className="fund-metric">
              <span className="fund-metric-label">{t(lang, 'colInvestors')}</span>
              <strong>
                {fund.investor_count == null
                  ? '—'
                  : fund.investor_count.toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR')}
              </strong>
            </div>
            <div className="fund-metric">
              <span className="fund-metric-label">Sharpe</span>
              <strong>{fund.sharpe != null ? fund.sharpe.toFixed(2) : '—'}</strong>
            </div>
            <div className="fund-metric">
              <span className="fund-metric-label">Vol</span>
              <strong>{fund.volatility != null ? `${(fund.volatility * 100).toFixed(1)}%` : '—'}</strong>
            </div>
            <div className="fund-metric">
              <span className="fund-metric-label">Max DD</span>
              <strong className={`pct ${pctTone(fund.max_drawdown)}`}>{formatPct(fund.max_drawdown)}</strong>
            </div>
            <div className="fund-metric">
              <span className="fund-metric-label">{t(lang, 'colSize')}</span>
              <strong>{formatMarketCap(fund.portfolio_size)}</strong>
            </div>
          </div>
        </div>

        <div className="modal-news">
          <div className="modal-news-title">📰 {t(lang, 'fundModalNews')}</div>
          {news && news.length > 0 ? (
            news.slice(0, 3).map((item, i) => (
              <a
                key={item.link + i}
                className="modal-news-item"
                href={item.link}
                target="_blank"
                rel="noreferrer noopener"
              >
                <span className="news-time">{formatRelativeTime(item.published_at, lang)}</span> {item.title}
              </a>
            ))
          ) : (
            <p className="modal-news-empty">{t(lang, 'fundModalNewsEmpty')}</p>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Listedeki sinyallerin sektör dağılımı. Filtre/arama sonucuna göre canlı hesaplanır.
 * Amacı süs değil: sinyaller tek sektörde toplanmışsa liste göründüğü kadar çeşitli
 * değildir. ETF/emtiada sektör kavramı olmadığından orada hiç render edilmez.
 */
function SectorBreakdown({ rows, lang }) {
  const counts = useMemo(() => {
    const map = new Map()
    for (const r of rows) {
      if (!r.sector) continue
      map.set(r.sector, (map.get(r.sector) || 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])

  if (!counts.length) return null

  const labels = t(lang, 'sectorLabels')
  const total = counts.reduce((sum, [, n]) => sum + n, 0)

  return (
    <div className="sector-row">
      <span className="sector-title">{t(lang, 'sectorTitle')}</span>
      <div className="sector-chips">
        {counts.map(([sector, n]) => (
          <span key={sector} className="chip sector-chip" title={t(lang, 'sectorHint')}>
            {labels[sector] || sector}
            <b>
              {n} · {Math.round((n / total) * 100)}%
            </b>
          </span>
        ))}
      </div>
    </div>
  )
}

function FilterPanel({ filters, setFilters, availableEmas, isCustom, lang, sectors = [] }) {
  const applyPreset = (preset) => setFilters({ ...preset.filters, emas: { ...preset.filters.emas }, sectors: [] })

  const [screens, setScreens] = useState(loadSavedScreens)
  const [screenName, setScreenName] = useState('')

  const toggleSector = (sec) => {
    const cur = filters.sectors || []
    const next = cur.includes(sec) ? cur.filter((s) => s !== sec) : [...cur, sec]
    setFilters({ ...filters, sectors: next })
  }

  const cloneFilters = (f) => ({ ...f, emas: { ...f.emas }, sectors: [...(f.sectors || [])] })

  const saveScreen = () => {
    const name = screenName.trim()
    if (!name) return
    const next = [...screens, { id: `${Date.now()}`, name, filters: cloneFilters(filters) }]
    setScreens(next)
    saveSavedScreens(next)
    setScreenName('')
  }

  const deleteScreen = (id) => {
    const next = screens.filter((s) => s.id !== id)
    setScreens(next)
    saveSavedScreens(next)
  }

  const slider = (label, key, value) => (
    <label className="slider-row">
      <span className="slider-label">
        {label} <b>&lt; {value}</b>
      </span>
      <input
        type="range"
        min="10"
        max="100"
        step="5"
        value={value}
        onChange={(e) => setFilters({ ...filters, [key]: Number(e.target.value) })}
      />
    </label>
  )

  return (
    <details className="filter-panel">
      <summary>
        ⚙️ {t(lang, 'filterTitle')}
        {isCustom && <span className="badge custom">{t(lang, 'filterCustom')}</span>}
      </summary>
      <div className="filter-presets">
        <span className="filter-presets-label">{t(lang, 'presetsLabel')}</span>
        {FILTER_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`fc-chip ${filtersMatchPreset(filters, p, availableEmas) ? 'active' : ''}`}
            title={t(lang, `${p.i18nKey}Hint`)}
            onClick={() => applyPreset(p)}
          >
            {t(lang, p.i18nKey)}
          </button>
        ))}
      </div>
      <div className="filter-grid">
        <div className="filter-group">
          <div className="filter-title">{t(lang, 'filterOverbought')}</div>
          {slider('RSI', 'rsi', filters.rsi)}
          {slider(t(lang, 'filterStochK'), 'stochK', filters.stochK)}
          {slider(t(lang, 'filterStochRsiK'), 'stochRsiK', filters.stochRsiK)}
        </div>
        <div className="filter-group">
          <div className="filter-title">{t(lang, 'filterTrend')}</div>
          <div className="check-row">
            {[9, 21, 50, 200].map((p) => (
              <label key={p} className={`check ${availableEmas.includes(p) ? '' : 'disabled'}`}>
                <input
                  type="checkbox"
                  disabled={!availableEmas.includes(p)}
                  checked={availableEmas.includes(p) ? filters.emas[p] : false}
                  onChange={(e) =>
                    setFilters({ ...filters, emas: { ...filters.emas, [p]: e.target.checked } })
                  }
                />
                {t(lang, 'filterPriceAbove', p)}
              </label>
            ))}
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={filters.macdPositive}
              onChange={(e) => setFilters({ ...filters, macdPositive: e.target.checked })}
            />
            MACD &gt; 0
          </label>
          <button
            className="btn small"
            onClick={() => setFilters({ ...DEFAULT_FILTERS, emas: { ...DEFAULT_FILTERS.emas }, sectors: [] })}
          >
            {t(lang, 'filterReset')}
          </button>
        </div>
        {sectors.length > 1 && (
          <div className="filter-group filter-sectors">
            <div className="filter-title">{t(lang, 'filterSector')}</div>
            <div className="sector-chips">
              {sectors.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className={`fc-chip ${filters.sectors?.includes(sec) ? 'active' : ''}`}
                  onClick={() => toggleSector(sec)}
                >
                  {sectorLabel(sec, lang)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="saved-screens">
        <span className="filter-presets-label">{t(lang, 'screensLabel')}</span>
        {screens.map((s) => (
          <span key={s.id} className="screen-chip">
            <button type="button" className="screen-load" onClick={() => setFilters(cloneFilters(s.filters))}>
              {s.name}
            </button>
            <button
              type="button"
              className="screen-del"
              title={t(lang, 'screenDelete')}
              onClick={() => deleteScreen(s.id)}
            >
              ✕
            </button>
          </span>
        ))}
        <input
          className="search-input screen-name"
          type="text"
          placeholder={t(lang, 'screenNamePh')}
          value={screenName}
          maxLength={28}
          onChange={(e) => setScreenName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && saveScreen()}
        />
        <button type="button" className="btn small" disabled={!screenName.trim()} onClick={saveScreen}>
          💾 {t(lang, 'screenSave')}
        </button>
      </div>
    </details>
  )
}

function loadWatchlist() {
  try {
    return new Set(JSON.parse(localStorage.getItem('watchlist') || '[]'))
  } catch {
    return new Set()
  }
}

// Fon favorileri ayrı anahtarda: fon kodları (ör. TTE) SP500 sembolleriyle
// çakışabilir, tek listede tip ayrımı yapılamazdı.
function loadFundWatchlist() {
  try {
    return new Set(JSON.parse(localStorage.getItem('watchlist_funds') || '[]'))
  } catch {
    return new Set()
  }
}

/**
 * "İzlediklerim": yıldızlanan hisse ve fonları tek sayfada toplar. Veri günlük
 * tarama çıktılarından gelir; favori artık tarama listesinde yoksa satır soluk
 * gösterilir ama grafiği yine açılabilir.
 */
function WatchlistView({
  watchlist,
  fundWatchlist,
  overview,
  funds,
  stockPrices,
  lang,
  loading,
  onOpenChart,
  onOpenFund,
  onToggleStock,
  onToggleFund,
  onCompareStocks,
  onCompareFunds,
  onShare,
}) {
  const stockRows = useMemo(() => {
    const bySymbol = new Map()
    for (const payload of Object.values(overview || {})) {
      for (const r of payload.results || []) bySymbol.set(r.symbol, r)
    }
    return [...watchlist].sort().map((symbol) => bySymbol.get(symbol) || { symbol, missing: true })
  }, [watchlist, overview])

  const fundRows = useMemo(() => {
    const bySymbol = new Map()
    for (const f of funds?.results || []) bySymbol.set(f.symbol, f)
    return [...fundWatchlist].sort().map((symbol) => bySymbol.get(symbol) || { symbol, missing: true })
  }, [fundWatchlist, funds])

  if (!watchlist.size && !fundWatchlist.size) {
    return (
      <>
        <div className="status-bar">
          <span>{t(lang, 'watchlistIntro')}</span>
        </div>
        <div className="empty-box">{t(lang, 'watchlistEmpty')}</div>
      </>
    )
  }

  return (
    <>
      <div className="status-bar">
        <span>{t(lang, 'watchlistIntro')}</span>
        <div className="actions">
          {/* Favori listesi bağlantıyla paylaşılabilir; karşı taraf kendi listesine
              EKLER, listesi değişmez (bkz. watchImport onayı). */}
          <button className="btn" onClick={onShare}>
            🔗 {t(lang, 'shareWatchlist')}
          </button>
        </div>
      </div>
      {loading && !stockRows.some((r) => !r.missing) && !fundRows.some((r) => !r.missing) && (
        <div className="empty-box">{t(lang, 'loading')}</div>
      )}

      {watchlist.size > 0 && (
        <section className="watch-section">
          <h2 className="today-title">
            {t(lang, 'watchlistStocks')}
            {watchlist.size >= 2 && (
              <button className="link-btn" onClick={() => onCompareStocks([...watchlist])}>
                {t(lang, 'fundCompareAction')} →
              </button>
            )}
          </h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="star-cell"></th>
                  <th className="left">{t(lang, 'colSymbol')}</th>
                  <th>{t(lang, 'colScore')}</th>
                  <th>{t(lang, 'colClose')}</th>
                  <th>{t(lang, 'changeColLabels').daily}</th>
                  <th className="spark-col">{t(lang, 'colTrend')}</th>
                </tr>
              </thead>
              <tbody>
                {stockRows.map((r) => (
                  <tr key={r.symbol} className={r.missing ? 'watch-missing' : ''}>
                    <td className="star-cell">
                      <button
                        className="star-btn active"
                        title={t(lang, 'watchRemove')}
                        onClick={() => onToggleStock(r.symbol)}
                      >
                        ★
                      </button>
                    </td>
                    <td className="symbol-cell">
                      <button className="symbol-btn" onClick={() => onOpenChart(r.symbol)}>
                        <TickerLogo symbol={r.symbol} />
                        {displaySymbol(r.symbol)}
                      </button>
                      {r.missing && <span className="watch-note">{t(lang, 'watchlistNotInScan')}</span>}
                    </td>
                    <td>
                      {r.missing ? '—' : <span className={`badge score-${scoreTone(r.score)}`}>{r.score ?? '—'}</span>}
                    </td>
                    <td>{r.missing ? '—' : formatNum(r.close, 2)}</td>
                    <td className={`pct ${pctTone(r.change)}`}>{r.missing ? '—' : formatPct(r.change, 2)}</td>
                    <td className="spark-col">
                      <Sparkline points={stockPrices?.series?.[r.symbol]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {fundWatchlist.size > 0 && (
        <section className="watch-section">
          <h2 className="today-title">
            {t(lang, 'watchlistFunds')}
            {fundWatchlist.size >= 2 && (
              <button className="link-btn" onClick={() => onCompareFunds([...fundWatchlist])}>
                {t(lang, 'fundCompareAction')} →
              </button>
            )}
          </h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="star-cell"></th>
                  <th className="left">{t(lang, 'colFund')}</th>
                  <th>{t(lang, 'colScore')}</th>
                  <th>{t(lang, 'colChange')}</th>
                  <th>1Y %</th>
                </tr>
              </thead>
              <tbody>
                {fundRows.map((f) => (
                  <tr key={f.symbol} className={f.missing ? 'watch-missing' : ''}>
                    <td className="star-cell">
                      <button
                        className="star-btn active"
                        title={t(lang, 'watchRemove')}
                        onClick={() => onToggleFund(f.symbol)}
                      >
                        ★
                      </button>
                    </td>
                    <td className="symbol-cell">
                      {f.missing ? (
                        <span className="symbol-btn watch-plain">
                          <TickerLogo symbol={f.symbol} />
                          <strong>{f.symbol}</strong>
                          <span className="watch-note">{t(lang, 'watchlistNotInScan')}</span>
                        </span>
                      ) : (
                        <button
                          className="symbol-btn fund-link"
                          type="button"
                          title={f.name}
                          onClick={() => onOpenFund(f)}
                        >
                          <TickerLogo symbol={f.symbol} />
                          <span className="fund-code-wrap">
                            <strong>{f.symbol}</strong>
                            <span className="fund-name">{f.name}</span>
                          </span>
                        </button>
                      )}
                    </td>
                    <td>
                      {f.missing ? '—' : <span className={`badge score-${scoreTone(f.score)}`}>{f.score}</span>}
                    </td>
                    <td className={`pct ${pctTone(f.return_1d)}`}>{f.missing ? '—' : formatPct(f.return_1d, 2)}</td>
                    <td className={`pct ${pctTone(f.return_1y)}`}>{f.missing ? '—' : formatPct(f.return_1y)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}

function loadPortfolio() {
  try {
    const list = JSON.parse(localStorage.getItem('portfolio_funds') || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function savePortfolio(list) {
  localStorage.setItem('portfolio_funds', JSON.stringify(list))
}

// Strateji Takip: kullanıcının bu stratejiye göre girdiği pozisyonlar (yalnızca
// localStorage — sunucuya hiçbir şey gitmez). Şekil: { id, symbol, market, entryDate }.
function loadStrategyPositions() {
  try {
    const list = JSON.parse(localStorage.getItem('strategy_positions') || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function saveStrategyPositions(list) {
  localStorage.setItem('strategy_positions', JSON.stringify(list))
}

const STRATEGY_DEFAULTS = { holdWeeks: 13, maxPositions: 10 }

function loadStrategySettings() {
  try {
    const s = JSON.parse(localStorage.getItem('strategy_settings') || '{}')
    return {
      holdWeeks: Number(s.holdWeeks) || STRATEGY_DEFAULTS.holdWeeks,
      maxPositions: Number(s.maxPositions) || STRATEGY_DEFAULTS.maxPositions,
    }
  } catch {
    return { ...STRATEGY_DEFAULTS }
  }
}

function saveStrategySettings(s) {
  localStorage.setItem('strategy_settings', JSON.stringify(s))
}

/* ---------- Yedekleme (dosya + kod) ----------
 * Tüm kişisel veri yalnızca localStorage'da yaşar; sunucu yoktur. Cihaz değiştirmenin
 * tek yolu bu yedek. Kod biçimi bilinçli bir tercihtir: kod, sunucudaki veriye açılan
 * bir ANAHTAR değil, verinin KENDİSİDİR. Böylece kimse başkasının kodunu tahmin edip
 * verisine ulaşamaz — ortada ulaşılacak bir sunucu yoktur. */

// Yedeğe girecek localStorage anahtarları ve birleştirme biçimleri.
// Yeni bir kişisel veri anahtarı eklendiğinde BURAYA da eklenmelidir.
const BACKUP_KEYS = [
  { key: 'watchlist', kind: 'set' },
  { key: 'watchlist_funds', kind: 'set' },
  { key: 'portfolio_funds', kind: 'list' },
  { key: 'strategy_positions', kind: 'list' },
  { key: 'alerts', kind: 'list' },
  { key: 'saved_screens', kind: 'list' },
  { key: 'strategy_settings', kind: 'object' },
]

const BACKUP_CODE_PREFIX = 'BT1.'

function buildBackupPayload() {
  const data = {}
  for (const { key } of BACKUP_KEYS) {
    const raw = localStorage.getItem(key)
    if (raw == null) continue
    try {
      data[key] = JSON.parse(raw)
    } catch {
      /* bozuk kayıt yedeğe alınmaz */
    }
  }
  return { app: 'borsa-tarama', exported_at: new Date().toISOString(), ...data }
}

/**
 * Yedeği localStorage'a uygular. ÜZERİNE YAZMAZ, birleştirir: yanlış kod/dosya
 * yapıştırıldığında mevcut veri kaybolmasın. Liste öğeleri id ile tekilleştirilir.
 */
function applyBackupPayload(data) {
  if (data?.app !== 'borsa-tarama') throw new Error('unrecognized')
  for (const { key, kind } of BACKUP_KEYS) {
    const incoming = data[key]
    if (incoming == null) continue

    if (kind === 'set') {
      const cur = new Set(JSON.parse(localStorage.getItem(key) || '[]'))
      for (const s of incoming) if (typeof s === 'string') cur.add(s)
      localStorage.setItem(key, JSON.stringify([...cur]))
    } else if (kind === 'list') {
      let cur = []
      try {
        cur = JSON.parse(localStorage.getItem(key) || '[]')
      } catch {
        cur = []
      }
      if (!Array.isArray(cur)) cur = []
      const ids = new Set(cur.map((x) => x?.id).filter(Boolean))
      for (const item of Array.isArray(incoming) ? incoming : []) {
        if (!item || typeof item !== 'object') continue
        if (item.id && ids.has(item.id)) continue
        cur.push(item)
      }
      localStorage.setItem(key, JSON.stringify(cur))
    } else if (kind === 'object') {
      // Ayarlarda birleştirme anlamsız: gelen değer geçerliyse olduğu gibi alınır
      if (incoming && typeof incoming === 'object') {
        localStorage.setItem(key, JSON.stringify(incoming))
      }
    }
  }
}

const bytesToBase64 = (bytes) => {
  let bin = ''
  // Parça parça: büyük dizilerde String.fromCharCode(...) yığın taşmasına yol açar
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

const base64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

/** Yedeği tek satırlık koda çevirir (varsa gzip ile sıkıştırarak). */
async function encodeBackupCode(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  if (typeof CompressionStream === 'undefined') {
    return `${BACKUP_CODE_PREFIX}0.${bytesToBase64(bytes)}`
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))
  const gz = new Uint8Array(await new Response(stream).arrayBuffer())
  return `${BACKUP_CODE_PREFIX}1.${bytesToBase64(gz)}`
}

async function decodeBackupCode(code) {
  const trimmed = (code || '').trim().replace(/\s+/g, '')
  if (!trimmed.startsWith(BACKUP_CODE_PREFIX)) throw new Error('bad prefix')
  const rest = trimmed.slice(BACKUP_CODE_PREFIX.length)
  const sep = rest.indexOf('.')
  const compressed = rest.slice(0, sep) === '1'
  let bytes = base64ToBytes(rest.slice(sep + 1))
  if (compressed) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
    bytes = new Uint8Array(await new Response(stream).arrayBuffer())
  }
  return JSON.parse(new TextDecoder().decode(bytes))
}

// Girişten bu yana geçen tam hafta sayısı (yerel saat, gün farkından)
function weeksSince(dateStr) {
  const start = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(start.getTime())) return 0
  const days = Math.floor((Date.now() - start.getTime()) / 86400000)
  return Math.max(0, Math.floor(days / 7))
}

/** Tutar (maliyet/değer) 2 ondalıkla; pay fiyatı için formatFundPrice (4 ondalık) kullanılır. */
function formatLira(value, lang) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${Number(value).toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₺`
}

/** Serideki [tarih, fiyat] noktalarından verilen güne (veya öncesindeki son güne) ait fiyat. */
function priceOn(series, dateStr) {
  if (!series?.length) return null
  let best = null
  for (const [d, px] of series) {
    if (d <= dateStr) best = px
    else break
  }
  return best
}

/**
 * Fon akışı: günlük yatırımcı sayısı arşivinden (fund_flows.json) seçilen
 * penceredeki değişimi hesaplar. "Para nereye akıyor" sorusuna popülerlik
 * üzerinden yaklaşık bir cevap; arşiv birikene kadar panel görünmez.
 */
function FundFlowsPanel({ flows, funds, lang, onOpenFund }) {
  const [win, setWin] = useState(30)
  const history = flows?.history || {}
  const dates = useMemo(() => Object.keys(history).sort(), [history])

  const computed = useMemo(() => {
    if (dates.length < 2) return null
    const lastDate = dates[dates.length - 1]
    const cutoff = new Date(Date.parse(lastDate) - win * 86400000).toISOString().slice(0, 10)
    const baseDate = dates.find((d) => d >= cutoff) ?? dates[0]
    if (baseDate === lastDate) return null
    const base = history[baseDate]
    const last = history[lastDate]
    const bySymbol = new Map((funds?.results || []).map((f) => [f.symbol, f]))
    const rows = []
    for (const [sym, cur] of Object.entries(last)) {
      const prev = base?.[sym]
      if (prev == null || cur == null) continue
      const delta = cur - prev
      if (!delta) continue
      rows.push({ symbol: sym, fund: bySymbol.get(sym) || null, delta, pct: prev > 0 ? delta / prev : null })
    }
    if (!rows.length) return null
    const gainers = [...rows].sort((a, b) => b.delta - a.delta).filter((r) => r.delta > 0).slice(0, 5)
    const losers = [...rows].sort((a, b) => a.delta - b.delta).filter((r) => r.delta < 0).slice(0, 5)
    return { gainers, losers, baseDate, lastDate }
  }, [dates, history, win, funds])

  if (!computed) return null
  const locale = lang === 'en' ? 'en-US' : 'tr-TR'

  const renderList = (items, tone) => (
    <div className="flow-col">
      <h3 className="flow-col-title">{t(lang, tone === 'pos' ? 'flowGainers' : 'flowLosers')}</h3>
      {items.length === 0 && <div className="flow-empty">—</div>}
      {items.map((r) => (
        <button
          key={r.symbol}
          type="button"
          className="flow-row"
          disabled={!r.fund}
          onClick={() => r.fund && onOpenFund(r.fund)}
          title={r.fund?.name}
        >
          <TickerLogo symbol={r.symbol} />
          <span className="flow-code">
            <strong>{r.symbol}</strong>
            {r.fund?.name && <span className="fund-name">{r.fund.name}</span>}
          </span>
          <span className={`pct ${tone}`}>
            {r.delta > 0 ? '+' : ''}
            {r.delta.toLocaleString(locale)}
            {r.pct != null && ` (${formatPct(r.pct)})`}
          </span>
        </button>
      ))}
    </div>
  )

  return (
    <section className="watch-section flow-panel">
      <div className="pf-chart-head">
        <h2 className="today-title">{t(lang, 'flowTitle')}</h2>
        <div className="tabs">
          {[7, 30].map((d) => (
            <button key={d} type="button" className={`tab ${win === d ? 'active' : ''}`} onClick={() => setWin(d)}>
              {d}G
            </button>
          ))}
        </div>
      </div>
      <p className="fc-overlap-hint">
        {t(
          lang,
          'flowRange',
          new Date(computed.baseDate).toLocaleDateString(locale),
          new Date(computed.lastDate).toLocaleDateString(locale),
        )}
      </p>
      <div className="flow-grid">
        {renderList(computed.gainers, 'pos')}
        {renderList(computed.losers, 'neg')}
      </div>
    </section>
  )
}

/**
 * Portföyün gün gün toplam değeri. Bir günün değeri, o güne kadar alınmış tüm
 * pozisyonların o günkü pay değeriyle çarpımı; maliyet de aynı günün birikimli
 * yatırılan tutarı (kademeli alımlar basamak olarak görünür).
 */
function buildPortfolioSeries(positions, seriesOf) {
  const seriesBySym = {}
  const dateSet = new Set()
  for (const p of positions) {
    const s = seriesOf(p.symbol)
    if (!s?.length) continue
    seriesBySym[p.symbol] = s
    for (const [d] of s) dateSet.add(d)
  }
  if (!Object.keys(seriesBySym).length) return null
  const firstBuy = positions.reduce((m, p) => (m == null || p.date < m ? p.date : m), null)
  const dates = [...dateSet].sort().filter((d) => d >= firstBuy)
  const points = []
  for (const d of dates) {
    let value = 0
    let invested = 0
    let complete = true
    for (const p of positions) {
      if (p.date > d) continue
      const px = priceOn(seriesBySym[p.symbol], d)
      if (px == null) {
        complete = false
        break
      }
      value += px * p.qty
      invested += p.price * p.qty
    }
    if (!complete || invested <= 0) continue
    points.push({ t: Date.parse(d), d, value, invested })
  }
  return points.length >= 2 ? points : null
}

/**
 * "Aynı parayı aynı tarihlerde benchmark'a koysaydın": her alımın maliyeti o
 * günkü benchmark fiyatından pay'a çevrilir, toplam değer gün gün izlenir.
 * Herhangi bir alım gününde benchmark fiyatı yoksa (seri o kadar geriye
 * gitmiyorsa) yanıltıcı kısmi eğri yerine hiç çizilmez.
 */
function buildBenchmarkSeries(positions, benchPoints, portfolioPoints) {
  if (!benchPoints?.length || !portfolioPoints?.length) return null
  const units = []
  for (const p of positions) {
    const px = priceOn(benchPoints, p.date)
    if (px == null || px <= 0) return null
    units.push({ date: p.date, units: (p.price * p.qty) / px })
  }
  const points = []
  for (const pt of portfolioPoints) {
    const bpx = priceOn(benchPoints, pt.d)
    if (bpx == null) continue
    let value = 0
    for (const u of units) {
      if (u.date > pt.d) continue
      value += u.units * bpx
    }
    if (value > 0) points.push({ t: pt.t, d: pt.d, value })
  }
  return points.length >= 2 ? points : null
}

const PF_BENCH_DEFS = [
  { key: 'XU100.IS', label: 'BIST 100', color: '#2563eb' },
  { key: 'USDTRY=X', label: 'USD', color: '#d97706' },
]

function formatAxisMoney(v) {
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e4) return `${(v / 1e3).toFixed(0)}k`
  return v.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
}

/** Portföy değeri + maliyet + benchmark eğrilerini ₺ ekseniyle çizen grafik. */
function PortfolioChart({ lines, lang }) {
  const [hover, setHover] = useState(null)
  const W = 680
  const H = 260
  const pad = { t: 14, r: 16, b: 26, l: 56 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b
  const locale = lang === 'en' ? 'en-US' : 'tr-TR'

  const all = lines.flatMap((l) => l.points)
  if (all.length < 2) return null
  const minT = Math.min(...all.map((p) => p.t))
  const maxT = Math.max(...all.map((p) => p.t))
  const minV = Math.min(...all.map((p) => p.value))
  const maxV = Math.max(...all.map((p) => p.value))
  const vPad = Math.max((maxV - minV) * 0.08, maxV * 0.01, 1)
  const lo = minV - vPad
  const hi = maxV + vPad

  const x = (tt) => pad.l + ((tt - minT) / (maxT - minT || 1)) * innerW
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * innerH
  const tFromX = (px) => minT + ((px - pad.l) / (innerW || 1)) * (maxT - minT)
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const gridVals = [hi, (lo + hi) / 2, lo]

  function onMove(event) {
    const svg = event.currentTarget
    const rect = svg.getBoundingClientRect()
    const source = event.touches?.[0] || event.changedTouches?.[0] || event
    if (source.clientX == null) return
    const px = (source.clientX - rect.left) * (W / rect.width)
    if (px < pad.l || px > W - pad.r) {
      setHover(null)
      return
    }
    const targetT = tFromX(px)
    const items = lines
      .map((line) => {
        const point = nearestFundPoint(line.points, targetT)
        if (!point) return null
        return { key: line.key, label: line.label, color: line.color, dashed: line.dashed, t: point.t, value: point.value }
      })
      .filter(Boolean)
    if (!items.length) {
      setHover(null)
      return
    }
    setHover({ t: items[0].t, x: x(items[0].t), items })
  }

  const tipPct = hover ? (hover.x / W) * 100 : 0
  const tipFlip = hover ? hover.x > W * 0.5 : false

  return (
    <div className="fund-price-wrap">
      <svg
        className="fund-price-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t(lang, 'pfChartLabel')}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onTouchStart={onMove}
        onTouchMove={onMove}
      >
        {gridVals.map((v) => (
          <g key={v}>
            <line className="fund-price-grid" x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} />
            <text className="fund-price-axis" x={pad.l - 8} y={y(v) + 3} textAnchor="end">
              {formatAxisMoney(v)}
            </text>
          </g>
        ))}
        {lines.map((line) => (
          <path
            key={line.key}
            className={`pf-line ${line.dashed ? 'dashed' : ''}`}
            d={path(line.points)}
            stroke={line.color}
            fill="none"
          />
        ))}
        {hover && (
          <g pointerEvents="none">
            <line className="fund-price-crosshair" x1={hover.x} x2={hover.x} y1={pad.t} y2={H - pad.b} />
            {hover.items.map((item) => (
              <circle key={item.key} cx={hover.x} cy={y(item.value)} r="4" fill={item.color} stroke="#fff" strokeWidth="1.5" />
            ))}
          </g>
        )}
        <text className="fund-price-axis" x={pad.l} y={H - 6}>
          {new Date(minT).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
        </text>
        <text className="fund-price-axis" x={W - pad.r} y={H - 6} textAnchor="end">
          {new Date(maxT).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
        </text>
      </svg>
      {hover && (
        <div
          className="fund-price-tooltip"
          style={{ left: `${tipPct}%`, transform: tipFlip ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)' }}
        >
          <div className="fund-price-tooltip-date">
            {new Date(hover.t).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          {hover.items.map((item) => (
            <div key={item.key} className="fc-tooltip-row">
              <span className="fc-swatch" style={{ background: item.color }} />
              <strong>{item.label}</strong>
              <span>{formatLira(item.value, lang)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * "Portföyüm": kullanıcının kendi fon alımlarını (tarih, fiyat, adet) girip
 * güncel pay değeriyle kâr/zarar takibi. Veriler yalnızca tarayıcıda
 * (localStorage) tutulur; sunucuya hiçbir şey gönderilmez.
 */
// Dağılım/analiz grafikleri için ayrık renk paleti
const PIE_COLORS = [
  '#7c3aed', '#2563eb', '#16a34a', '#d97706', '#db2777',
  '#0891b2', '#65a30d', '#dc2626', '#9333ea', '#0d9488',
]

/** Basit SVG donut: her segment strokeDasharray ile çizilir. */
function Donut({ segments, size = 168 }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  if (total <= 0) return null
  const r = size / 2 - 14
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <svg className="pa-donut" viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-hidden="true">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {segments.map((seg) => {
          const len = (seg.value / total) * c
          const node = (
            <circle
              key={seg.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="20"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            />
          )
          offset += len
          return node
        })}
      </g>
    </svg>
  )
}

/**
 * Portföy analizi: özet kartları, holding bazında dağılım donut'u ve
 * sektör/fon-kategorisi dağılım çubukları. Tümü mevcut pozisyon verisinden;
 * hisse sektörü günlük özetten, fon kategorisi ad çıkarımından gelir.
 */
function PortfolioAnalytics({ rows, totals, stockMap, lang }) {
  const known = useMemo(() => rows.filter((r) => r.value != null && r.value > 0), [rows])

  const alloc = useMemo(() => {
    const sorted = [...known].sort((a, b) => b.value - a.value)
    const top = sorted.slice(0, 8)
    const rest = sorted.slice(8)
    const segs = top.map((r, i) => ({
      label: displaySymbol(r.symbol),
      value: r.value,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }))
    if (rest.length) {
      segs.push({ label: t(lang, 'paOther'), value: rest.reduce((s, r) => s + r.value, 0), color: '#94a3b8' })
    }
    return segs
  }, [known, lang])

  const exposure = useMemo(() => {
    const m = new Map()
    for (const r of known) {
      let label
      if (r.isStock) label = sectorLabel(stockMap?.get(r.symbol)?.sector || t(lang, 'paOther'), lang)
      else if (r.fund) label = t(lang, catI18nKey(categorizeFund(r.fund.name)))
      else label = t(lang, 'paOther')
      m.set(label, (m.get(label) || 0) + r.value)
    }
    const tot = [...m.values()].reduce((s, v) => s + v, 0) || 1
    return [...m.entries()]
      .map(([label, value], i) => ({ label, value, pct: value / tot, color: PIE_COLORS[i % PIE_COLORS.length] }))
      .sort((a, b) => b.value - a.value)
  }, [known, stockMap, lang])

  if (known.length < 1) return null
  const best = known.reduce((a, b) => ((b.plPct ?? -Infinity) > (a.plPct ?? -Infinity) ? b : a))
  const worst = known.reduce((a, b) => ((b.plPct ?? Infinity) < (a.plPct ?? Infinity) ? b : a))
  const totalVal = totals.value || 1

  return (
    <section className="watch-section pa">
      <h2 className="today-title">{t(lang, 'paTitle')}</h2>
      <div className="pa-tiles">
        <div className="today-card">
          <span className="today-card-label">{t(lang, 'pfValue')}</span>
          <strong className="today-card-value">{formatLira(totals.value, lang)}</strong>
        </div>
        <div className="today-card">
          <span className="today-card-label">{t(lang, 'pfCost')}</span>
          <strong className="today-card-value">{formatLira(totals.cost, lang)}</strong>
        </div>
        <div className="today-card">
          <span className="today-card-label">K/Z</span>
          <strong className={`today-card-value pct ${pctTone(totals.plPct)}`}>{formatPct(totals.plPct)}</strong>
        </div>
        <div className="today-card">
          <span className="today-card-label">{t(lang, 'paPositions')}</span>
          <strong className="today-card-value">{rows.length}</strong>
        </div>
        <div className="today-card">
          <span className="today-card-label">{t(lang, 'paBest')}</span>
          <strong className="today-card-value pa-tile-mini">
            <span className="pa-tile-sym">{displaySymbol(best.symbol)}</span>
            <span className={`pct ${pctTone(best.plPct)}`}>{formatPct(best.plPct)}</span>
          </strong>
        </div>
        <div className="today-card">
          <span className="today-card-label">{t(lang, 'paWorst')}</span>
          <strong className="today-card-value pa-tile-mini">
            <span className="pa-tile-sym">{displaySymbol(worst.symbol)}</span>
            <span className={`pct ${pctTone(worst.plPct)}`}>{formatPct(worst.plPct)}</span>
          </strong>
        </div>
      </div>

      <div className="pa-charts">
        <div className="pa-chart-block">
          <h3 className="pa-sub">{t(lang, 'paAllocation')}</h3>
          <div className="pa-alloc">
            <Donut segments={alloc} />
            <ul className="pa-legend">
              {alloc.map((s) => (
                <li key={s.label}>
                  <span className="pa-dot" style={{ background: s.color }} />
                  <span className="pa-legend-label">{s.label}</span>
                  <span className="pa-legend-pct">{formatRate(s.value / totalVal, 0)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="pa-chart-block">
          <h3 className="pa-sub">{t(lang, 'paExposure')}</h3>
          <div className="pa-exposure">
            {exposure.map((e) => (
              <div key={e.label} className="pa-exp-row">
                <span className="pa-exp-label" title={e.label}>{e.label}</span>
                <div className="pa-exp-bar">
                  <div className="pa-exp-fill" style={{ width: `${Math.round(e.pct * 100)}%`, background: e.color }} />
                </div>
                <span className="pa-exp-pct">{formatRate(e.pct, 0)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function PortfolioView({ funds, prices, stockPrices, stockMap, lang, loading, onOpenFund, onOpenStock }) {
  const [positions, setPositions] = useState(loadPortfolio)
  const [form, setForm] = useState(() => ({
    symbol: '',
    date: new Date().toISOString().slice(0, 10),
    price: '',
    qty: '',
  }))
  const [formError, setFormError] = useState(null)

  const fundList = funds?.results || []
  const bySymbol = useMemo(() => {
    const m = new Map()
    for (const f of fundList) m.set(f.symbol, f)
    return m
  }, [fundList])

  // Fon ve hisse serilerini tek erişimle birleştir: portföy ikisini de tutabilir.
  const seriesOf = useMemo(() => {
    return (symbol) => stockPrices?.series?.[symbol] || prices?.series?.[symbol] || null
  }, [stockPrices, prices])

  const locale = lang === 'en' ? 'en-US' : 'tr-TR'

  // Kullanıcı "THYAO" yazsa da seri anahtarı "THYAO.IS"tir: fon/ham kod
  // bulunamazsa .IS ekli hisse serisini dener.
  const resolveSymbol = useMemo(() => {
    return (raw) => {
      const s = raw.trim().toUpperCase()
      if (!s) return ''
      if (bySymbol.has(s) || seriesOf(s)) return s
      if (seriesOf(`${s}.IS`)) return `${s}.IS`
      return s
    }
  }, [bySymbol, seriesOf])

  const symbolInput = resolveSymbol(form.symbol)

  // Sembol + tarih seçilince alış fiyatını o günkü fiyattan önerelim;
  // kullanıcı isterse üzerine kendi fiyatını yazar.
  const suggestedPrice = useMemo(
    () => priceOn(seriesOf(symbolInput), form.date),
    [seriesOf, symbolInput, form.date],
  )

  function addPosition(e) {
    e.preventDefault()
    const price = Number(String(form.price || suggestedPrice || '').replace(',', '.'))
    const qty = Number(String(form.qty).replace(',', '.'))
    if (!symbolInput) return setFormError(t(lang, 'pfErrSymbol'))
    if (!bySymbol.has(symbolInput) && !seriesOf(symbolInput)) {
      return setFormError(t(lang, 'pfErrUnknown', symbolInput))
    }
    if (!Number.isFinite(price) || price <= 0) return setFormError(t(lang, 'pfErrPrice'))
    if (!Number.isFinite(qty) || qty <= 0) return setFormError(t(lang, 'pfErrQty'))
    const next = [
      ...positions,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, symbol: symbolInput, date: form.date, price, qty },
    ]
    setPositions(next)
    savePortfolio(next)
    setForm((f) => ({ ...f, symbol: '', price: '', qty: '' }))
    setFormError(null)
  }

  function removePosition(id) {
    const next = positions.filter((p) => p.id !== id)
    setPositions(next)
    savePortfolio(next)
  }

  const rows = useMemo(
    () =>
      positions.map((p) => {
        const series = seriesOf(p.symbol)
        const current = series?.length ? series[series.length - 1][1] : null
        const cost = p.price * p.qty
        const value = current != null ? current * p.qty : null
        return {
          ...p,
          fund: bySymbol.get(p.symbol) || null,
          isStock: p.symbol.endsWith('.IS'),
          current,
          cost,
          value,
          pl: value != null ? value - cost : null,
          plPct: current != null ? current / p.price - 1 : null,
        }
      }),
    [positions, seriesOf, bySymbol],
  )

  const totals = useMemo(() => {
    // Güncel fiyatı bilinmeyen pozisyonlar toplam K/Z'ye katılamaz; ayrı sayılır
    const known = rows.filter((r) => r.value != null)
    const cost = known.reduce((s, r) => s + r.cost, 0)
    const value = known.reduce((s, r) => s + r.value, 0)
    return { cost, value, pl: value - cost, plPct: cost > 0 ? value / cost - 1 : null, missing: rows.length - known.length }
  }, [rows])

  const [pfBench, setPfBench] = useState(() => new Set(['XU100.IS']))
  const portfolioPoints = useMemo(() => buildPortfolioSeries(positions, seriesOf), [positions, seriesOf])
  const pfChartLines = useMemo(() => {
    if (!portfolioPoints) return null
    const lines = [
      { key: 'pf', label: t(lang, 'pfLineValue'), color: '#7c3aed', points: portfolioPoints },
      {
        key: 'cost',
        label: t(lang, 'pfLineCost'),
        color: '#94a3b8',
        dashed: true,
        points: portfolioPoints.map((p) => ({ t: p.t, d: p.d, value: p.invested })),
      },
    ]
    for (const b of PF_BENCH_DEFS) {
      if (!pfBench.has(b.key)) continue
      const pts = buildBenchmarkSeries(positions, prices?.benchmarks?.[b.key]?.points, portfolioPoints)
      if (pts) lines.push({ key: b.key, label: t(lang, 'pfLineBench', b.label), color: b.color, points: pts })
    }
    return lines
  }, [portfolioPoints, positions, prices, pfBench, lang])

  function togglePfBench(key) {
    setPfBench((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const [backupMsg, setBackupMsg] = useState(null)
  const [codeInput, setCodeInput] = useState('')

  // Tüm kişisel veri (favoriler, portföy, strateji pozisyonları, alarmlar, kayıtlı
  // taramalar) localStorage'da yaşar; cihaz değişiminde tek taşıma yolu bu yedek.
  // Sunucu tarafı olmadığından senkronizasyon bilinçli olarak yok.
  function exportBackup() {
    const payload = buildBackupPayload()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `borsa-tarama-yedek-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setBackupMsg(t(lang, 'bkExported'))
  }

  function importBackup(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        applyBackupPayload(JSON.parse(reader.result))
        // Veriler App state'inde de tutuluyor: en güvenilir senkron tam yeniden yükleme
        window.location.reload()
      } catch {
        setBackupMsg(t(lang, 'bkImportErr'))
      }
    }
    reader.readAsText(file)
  }

  // Kod ile taşıma: dosya indirip taşımak mobilde zahmetli. Kod, verinin kendisidir
  // (sunucudaki bir kayda açılan anahtar değil), bu yüzden paylaşılmadıkça risk yok.
  async function copyBackupCode() {
    try {
      const code = await encodeBackupCode(buildBackupPayload())
      await navigator.clipboard.writeText(code)
      setBackupMsg(t(lang, 'bkCopied', code.length))
    } catch {
      setBackupMsg(t(lang, 'bkCopyErr'))
    }
  }

  async function applyBackupCode() {
    try {
      applyBackupPayload(await decodeBackupCode(codeInput))
      window.location.reload()
    } catch {
      setBackupMsg(t(lang, 'bkCodeErr'))
    }
  }

  return (
    <>
      <div className="status-bar">
        <span>{t(lang, 'pfIntro')}</span>
      </div>

      <form className="pf-form" onSubmit={addPosition}>
        <div className="pf-field">
          <label htmlFor="pf-symbol">{t(lang, 'pfSymbol')}</label>
          <input
            id="pf-symbol"
            className="search-input"
            list="pf-fund-options"
            placeholder={t(lang, 'pfSymbolPh')}
            value={form.symbol}
            onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))}
          />
          <datalist id="pf-fund-options">
            {fundList.map((f) => (
              <option key={f.symbol} value={f.symbol}>
                {f.name}
              </option>
            ))}
            {Object.keys(stockPrices?.series || {})
              .filter((s) => s.endsWith('.IS'))
              .map((s) => (
                <option key={s} value={s.replace('.IS', '')}>
                  {s.replace('.IS', '')}
                </option>
              ))}
          </datalist>
        </div>
        <div className="pf-field">
          <label htmlFor="pf-date">{t(lang, 'pfDate')}</label>
          <input
            id="pf-date"
            className="search-input"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
        </div>
        <div className="pf-field">
          <label htmlFor="pf-price">{t(lang, 'pfPrice')}</label>
          <input
            id="pf-price"
            className="search-input"
            type="text"
            inputMode="decimal"
            placeholder={suggestedPrice != null ? String(suggestedPrice) : '—'}
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          />
        </div>
        <div className="pf-field">
          <label htmlFor="pf-qty">{t(lang, 'pfQty')}</label>
          <input
            id="pf-qty"
            className="search-input"
            type="text"
            inputMode="decimal"
            placeholder="100"
            value={form.qty}
            onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
          />
        </div>
        <button className="btn primary pf-add" type="submit" disabled={loading}>
          {t(lang, 'pfAdd')}
        </button>
      </form>
      {formError && <div className="error-box">{formError}</div>}

      {positions.length === 0 ? (
        <div className="empty-box">{t(lang, 'pfEmpty')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="left">{t(lang, 'pfSymbol')}</th>
                <th>{t(lang, 'pfDate')}</th>
                <th>{t(lang, 'pfPrice')}</th>
                <th>{t(lang, 'pfQty')}</th>
                <th>{t(lang, 'pfCost')}</th>
                <th>{t(lang, 'pfCurrent')}</th>
                <th>{t(lang, 'pfValue')}</th>
                <th>K/Z %</th>
                <th>K/Z ₺</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="symbol-cell">
                    {r.fund ? (
                      <button
                        className="symbol-btn fund-link"
                        type="button"
                        title={r.fund.name}
                        onClick={() => onOpenFund(r.fund)}
                      >
                        <TickerLogo symbol={r.symbol} />
                        <span className="fund-code-wrap">
                          <strong>{r.symbol}</strong>
                          <span className="fund-name">{r.fund.name}</span>
                        </span>
                      </button>
                    ) : r.isStock ? (
                      <button
                        className="symbol-btn"
                        type="button"
                        onClick={() => onOpenStock(r.symbol)}
                      >
                        <TickerLogo symbol={r.symbol} />
                        {displaySymbol(r.symbol)}
                      </button>
                    ) : (
                      <span className="symbol-btn watch-plain">
                        <TickerLogo symbol={r.symbol} />
                        <strong>{r.symbol}</strong>
                      </span>
                    )}
                  </td>
                  <td>{new Date(r.date).toLocaleDateString(locale)}</td>
                  <td>{formatFundPrice(r.price, lang)}</td>
                  <td>{r.qty.toLocaleString(locale)}</td>
                  <td>{formatLira(r.cost, lang)}</td>
                  <td>{r.current == null ? '—' : formatFundPrice(r.current, lang)}</td>
                  <td>{r.value == null ? '—' : formatLira(r.value, lang)}</td>
                  <td className={`pct ${pctTone(r.plPct)}`}>{formatPct(r.plPct)}</td>
                  <td className={`pct ${pctTone(r.plPct)}`}>
                    {r.pl == null
                      ? '—'
                      : `${r.pl > 0 ? '+' : ''}${r.pl.toLocaleString(locale, { maximumFractionDigits: 0 })} ₺`}
                  </td>
                  <td>
                    <button
                      className="star-btn pf-remove"
                      type="button"
                      title={t(lang, 'pfRemove')}
                      onClick={() => removePosition(r.id)}
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="pf-total">
                <td className="left" colSpan={4}>
                  {t(lang, 'pfTotal')}
                  {totals.missing > 0 && <span className="watch-note">{t(lang, 'pfMissing', totals.missing)}</span>}
                </td>
                <td>{formatLira(totals.cost, lang)}</td>
                <td></td>
                <td>{formatLira(totals.value, lang)}</td>
                <td className={`pct ${pctTone(totals.plPct)}`}>{formatPct(totals.plPct)}</td>
                <td className={`pct ${pctTone(totals.plPct)}`}>
                  {`${totals.pl > 0 ? '+' : ''}${totals.pl.toLocaleString(locale, { maximumFractionDigits: 0 })} ₺`}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {positions.length > 0 && (
        <PortfolioAnalytics rows={rows} totals={totals} stockMap={stockMap} lang={lang} />
      )}

      {pfChartLines && (
        <section className="watch-section">
          <div className="pf-chart-head">
            <h2 className="today-title">{t(lang, 'pfChartTitle')}</h2>
            <div className="fc-bench">
              {PF_BENCH_DEFS.filter((b) => prices?.benchmarks?.[b.key]?.points?.length).map((b) => (
                <button
                  key={b.key}
                  type="button"
                  className={`fc-chip ${pfBench.has(b.key) ? 'active' : ''}`}
                  title={t(lang, 'pfBenchHint', b.label)}
                  onClick={() => togglePfBench(b.key)}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          <PortfolioChart lines={pfChartLines} lang={lang} />
          <div className="fc-legend">
            {pfChartLines.map((l) => {
              const last = l.points[l.points.length - 1]
              return (
                <span key={l.key} className="fc-legend-item">
                  <span className="fc-swatch" style={{ background: l.color }} />
                  {l.label}
                  <span>{formatLira(last.value, lang)}</span>
                </span>
              )
            })}
          </div>
        </section>
      )}

      <section className="watch-section pf-backup">
        <h2 className="today-title">{t(lang, 'bkTitle')}</h2>
        <p className="fc-overlap-hint">{t(lang, 'bkHint')}</p>
        <div className="actions">
          <button className="btn" type="button" onClick={exportBackup}>
            ⬇ {t(lang, 'bkExport')}
          </button>
          <label className="btn">
            ⬆ {t(lang, 'bkImport')}
            <input type="file" accept="application/json,.json" hidden onChange={importBackup} />
          </label>
        </div>

        {/* Kod ile taşıma: dosya indirmeden, kopyala-yapıştır ile */}
        <div className="bk-code">
          <h3 className="bk-code-title">{t(lang, 'bkCodeTitle')}</h3>
          <p className="fc-overlap-hint">{t(lang, 'bkCodeHint')}</p>
          <div className="actions">
            <button className="btn primary" type="button" onClick={copyBackupCode}>
              📋 {t(lang, 'bkCopyCode')}
            </button>
          </div>
          <div className="bk-code-row">
            <input
              className="search-input"
              type="text"
              placeholder={t(lang, 'bkCodePlaceholder')}
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
            />
            <button className="btn" type="button" disabled={!codeInput.trim()} onClick={applyBackupCode}>
              {t(lang, 'bkApplyCode')}
            </button>
          </div>
          <p className="bk-code-warning">{t(lang, 'bkCodeWarning')}</p>
        </div>

        {backupMsg && <p className="fc-overlap-note">{backupMsg}</p>}
      </section>

      <p className="disclaimer">{t(lang, 'pfDisclaimer')}</p>
    </>
  )
}

// yfinance sektör adları İngilizce; arayüzde Türkçeleştirilir.
const SECTOR_LABELS = {
  'Financial Services': { tr: 'Finans', en: 'Financials' },
  Industrials: { tr: 'Sanayi', en: 'Industrials' },
  'Basic Materials': { tr: 'Temel Malzeme', en: 'Basic Materials' },
  'Consumer Cyclical': { tr: 'Tüketim (Döngüsel)', en: 'Consumer Cyclical' },
  'Consumer Defensive': { tr: 'Tüketim (Savunmacı)', en: 'Consumer Defensive' },
  Utilities: { tr: 'Kamu Hizmetleri', en: 'Utilities' },
  Technology: { tr: 'Teknoloji', en: 'Technology' },
  'Real Estate': { tr: 'Gayrimenkul', en: 'Real Estate' },
  'Communication Services': { tr: 'İletişim', en: 'Communication' },
  Healthcare: { tr: 'Sağlık', en: 'Healthcare' },
  Energy: { tr: 'Enerji', en: 'Energy' },
}

function sectorLabel(sector, lang) {
  const m = SECTOR_LABELS[sector]
  return m ? (lang === 'en' ? m.en : m.tr) : sector
}

/**
 * Değişim raporu: skor arşivinin (score_history.json) son iki gününü
 * karşılaştırır. Skoru en çok yükselen/düşen hisseler ve sinyale yeni
 * giren/çıkanlar. Arşiv iki gün birikene kadar panel görünmez.
 */
/** `scope`: 'bist' | 'global' | undefined (hepsi). Dize olarak alınır ki her
 *  render'da yeni bir fonksiyon referansı useMemo'yu boşuna geçersiz kılmasın. */
function ChangeReport({ scores, lang, scope, onOpenChart }) {
  const computed = useMemo(() => {
    const history = scores?.history || {}
    const days = Object.keys(history).sort()
    if (days.length < 2) return null
    const today = history[days[days.length - 1]]
    const prev = history[days[days.length - 2]]
    const moves = []
    const entered = []
    const dropped = []
    for (const [sym, cur] of Object.entries(today)) {
      // Seçili piyasa dışındaki semboller rapora girmez (BIST/ABD ayrımı)
      if (scope && (scope === 'bist') !== isBistSymbol(sym)) continue
      const before = prev[sym]
      if (before) {
        const delta = (cur.s ?? 0) - (before.s ?? 0)
        if (delta) moves.push({ symbol: sym, delta, score: cur.s })
        if (cur.g && !before.g) entered.push({ symbol: sym, score: cur.s })
        if (!cur.g && before.g) dropped.push({ symbol: sym, score: cur.s })
      } else if (cur.g) {
        entered.push({ symbol: sym, score: cur.s })
      }
    }
    const risers = [...moves].filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5)
    const fallers = [...moves].filter((m) => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5)
    if (!risers.length && !fallers.length && !entered.length && !dropped.length) return null
    return { risers, fallers, entered, dropped, from: days[days.length - 2], to: days[days.length - 1] }
  }, [scores, scope])

  if (!computed) return null
  const locale = lang === 'en' ? 'en-US' : 'tr-TR'

  const scoreList = (items, tone) => (
    <div className="flow-col">
      <h3 className="flow-col-title">{t(lang, tone === 'pos' ? 'changeRisers' : 'changeFallers')}</h3>
      {items.length === 0 && <div className="flow-empty">—</div>}
      {items.map((r) => (
        <button key={r.symbol} type="button" className="flow-row" onClick={() => onOpenChart(r.symbol)}>
          <TickerLogo symbol={r.symbol} />
          <span className="flow-code">
            <strong>{displaySymbol(r.symbol)}</strong>
          </span>
          <span className={`pct ${tone}`}>
            {r.delta > 0 ? '+' : ''}
            {r.delta} {t(lang, 'changePoint')} → {r.score}
          </span>
        </button>
      ))}
    </div>
  )

  const chipList = (items, cls) =>
    items.length === 0 ? null : (
      <div className="change-chips">
        {items.map((r) => (
          <button key={r.symbol} type="button" className={`chip ${cls}`} onClick={() => onOpenChart(r.symbol)}>
            {displaySymbol(r.symbol)} <span className="change-chip-score">{r.score}</span>
          </button>
        ))}
      </div>
    )

  return (
    <section className="today-section watch-section">
      <h2 className="today-title">{t(lang, 'changeTitle')}</h2>
      <p className="today-note">
        {t(lang, 'changeRange', new Date(computed.from).toLocaleDateString(locale), new Date(computed.to).toLocaleDateString(locale))}
      </p>
      <div className="flow-grid">
        {scoreList(computed.risers, 'pos')}
        {scoreList(computed.fallers, 'neg')}
      </div>
      {(computed.entered.length > 0 || computed.dropped.length > 0) && (
        <div className="change-signals">
          {computed.entered.length > 0 && (
            <div className="change-signal-group">
              <span className="change-signal-label pos">{t(lang, 'changeEntered')}</span>
              {chipList(computed.entered, 'change-in')}
            </div>
          )}
          {computed.dropped.length > 0 && (
            <div className="change-signal-group">
              <span className="change-signal-label neg">{t(lang, 'changeDropped')}</span>
              {chipList(computed.dropped, 'change-out')}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// Yarım daire gauge için kutupsal nokta ve yay yolu yardımcıları
function gaugePolar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)]
}

function gaugeArc(cx, cy, r, startDeg, endDeg) {
  const [x1, y1] = gaugePolar(cx, cy, r, startDeg)
  const [x2, y2] = gaugePolar(cx, cy, r, endDeg)
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0
  const sweep = startDeg > endDeg ? 1 : 0
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} ${sweep} ${x2.toFixed(1)} ${y2.toFixed(1)}`
}

/**
 * Piyasa genişliği: taranan tüm hisselerin bugünkü yükselen/düşen dağılımını
 * yarım daire göstergeyle özetler. "Piyasa risk iştahı" için tek bakışlık ölçü;
 * veri zaten tarama çıktısında (stocks[].change).
 */
function MarketBreadth({ overview, allMarkets, lang }) {
  const stats = useMemo(() => {
    let up = 0
    let down = 0
    let flat = 0
    let sum = 0
    let n = 0
    for (const m of allMarkets) {
      for (const s of overview?.[m.key]?.stocks || []) {
        if (s.change == null) continue
        n += 1
        sum += s.change
        if (s.change > 0.0005) up += 1
        else if (s.change < -0.0005) down += 1
        else flat += 1
      }
    }
    return { up, down, flat, avg: n ? sum / n : 0, total: n }
  }, [overview, allMarkets])

  if (stats.total < 4) return null
  const advancers = stats.up + stats.down > 0 ? stats.up / (stats.up + stats.down) : 0.5
  const W = 260
  const H = 150
  const cx = W / 2
  const cy = 132
  const r = 104
  const split = 180 - advancers * 180 // yükselen oranı kadar sol taraf yeşil
  const pct = Math.round(advancers * 100)

  return (
    <section className="today-section">
      <h2 className="today-title">{t(lang, 'breadthTitle')}</h2>
      <p className="today-note">{t(lang, 'breadthHint')}</p>
      <div className="breadth">
        <svg className="breadth-gauge" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t(lang, 'breadthTitle')}>
          <path className="breadth-track" d={gaugeArc(cx, cy, r, 180, 0)} />
          <path className="breadth-up-arc" d={gaugeArc(cx, cy, r, 180, split)} />
          <path className="breadth-down-arc" d={gaugeArc(cx, cy, r, split, 0)} />
          <text className="breadth-pct" x={cx} y={cy - 30} textAnchor="middle">
            {pct}%
          </text>
          <text className="breadth-pct-label" x={cx} y={cy - 12} textAnchor="middle">
            {t(lang, 'breadthAdvancers')}
          </text>
        </svg>
        <div className="breadth-stats">
          <div className="breadth-stat">
            <span className="breadth-dot up" />
            <span className="breadth-stat-label">{t(lang, 'breadthUp')}</span>
            <strong className="pos">{stats.up}</strong>
          </div>
          <div className="breadth-stat">
            <span className="breadth-dot flat" />
            <span className="breadth-stat-label">{t(lang, 'breadthFlat')}</span>
            <strong>{stats.flat}</strong>
          </div>
          <div className="breadth-stat">
            <span className="breadth-dot down" />
            <span className="breadth-stat-label">{t(lang, 'breadthDown')}</span>
            <strong className="neg">{stats.down}</strong>
          </div>
          <div className="breadth-stat">
            <span className="breadth-stat-label">{t(lang, 'breadthAvg')}</span>
            <strong className={`pct ${pctTone(stats.avg)}`}>{formatPct(stats.avg, 2)}</strong>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * Sektör ısı haritası: taranan tüm hisseleri sektöre göre gruplar, günlük
 * değişim ortalamasına göre yeşil/kırmızı tonlar. "Bugün para hangi sektörde"
 * sorusuna tek bakışta cevap; veri zaten tarama çıktısında (stocks[].sector).
 */
function SectorHeatmap({ overview, allMarkets, lang }) {
  const sectors = useMemo(() => {
    if (!overview) return []
    const agg = new Map()
    for (const m of allMarkets) {
      for (const s of overview[m.key]?.stocks || []) {
        if (!s.sector || s.change == null) continue
        if (!agg.has(s.sector)) agg.set(s.sector, { sum: 0, count: 0, up: 0, down: 0 })
        const a = agg.get(s.sector)
        a.sum += s.change
        a.count += 1
        if (s.change > 0) a.up += 1
        else if (s.change < 0) a.down += 1
      }
    }
    return [...agg.entries()]
      .map(([sector, a]) => ({ sector, avg: a.sum / a.count, count: a.count, up: a.up, down: a.down }))
      .sort((x, y) => y.avg - x.avg)
  }, [overview, allMarkets])

  if (sectors.length < 2) return null
  const maxAbs = Math.max(...sectors.map((s) => Math.abs(s.avg)), 0.001)

  // Ortalama değişimi 0.6 doygunlukta yeşil/kırmızıya eşle
  const tileStyle = (avg) => {
    const mag = Math.min(Math.abs(avg) / maxAbs, 1)
    const alpha = 0.12 + mag * 0.5
    const rgb = avg >= 0 ? '22, 163, 74' : '220, 38, 38'
    return { background: `rgba(${rgb}, ${alpha})` }
  }

  return (
    <section className="today-section">
      <h2 className="today-title">{t(lang, 'sectorHeatTitle')}</h2>
      <p className="today-note">{t(lang, 'sectorHeatHint')}</p>
      <div className="sector-heat">
        {sectors.map((s) => (
          <div key={s.sector} className="sector-tile" style={tileStyle(s.avg)}>
            <span className="sector-name">{sectorLabel(s.sector, lang)}</span>
            <strong className={`sector-avg pct ${pctTone(s.avg)}`}>{formatPct(s.avg, 2)}</strong>
            <span className="sector-sub">{t(lang, 'sectorHeatCount', s.count, s.up, s.down)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * "Bugün": kullanıcıyı doğrudan ham tabloya düşürmek yerine günün özetini veren
 * açılış sayfası. Buradaki her blok, detayı olan bir sekmeye kapı açar.
 */
function TodayView({
  overview,
  marketOverview,
  funds,
  news,
  scores,
  lang,
  loading,
  error,
  allMarkets,
  todayTimeframe,
  onTodayTimeframe,
  onOpenChart,
  onOpenFund,
  onNavigate,
}) {
  // BIST / ABD ayrımı: iki piyasanın seansı, para birimi ve gündemi ayrı. Tek sayfada
  // harmanlandığında "bugün ne oldu" sorusunun cevabı bulanıklaşıyordu (ör. nabız
  // kartında BIST yükselirken S&P düşüyor, hareketliler listesi ikisinden karışık).
  // allMarkets'ı kapsama göre filtrelemek ayrımı tüm alt bölümlere birden yayar.
  // Seçim hatırlanır: "Bugün" açılış sayfası, ABD takip eden biri her ziyarette
  // sekme değiştirmek zorunda kalmamalı.
  const [scope, setScopeState] = useState(() => {
    const saved = localStorage.getItem('today_scope')
    return saved === 'global' || saved === 'bist' ? saved : 'bist'
  })
  const setScope = (next) => {
    setScopeState(next)
    localStorage.setItem('today_scope', next)
  }
  const isBistMarket = (key) => key === 'bist100'
  const scopedMarkets = useMemo(
    () => allMarkets.filter((m) => (scope === 'bist' ? isBistMarket(m.key) : !isBistMarket(m.key))),
    [allMarkets, scope],
  )

  // Market kartları seçilen zaman dilimine göre; öne çıkan sinyaller / nabız günlük kalır.
  const markets = useMemo(
    () => (marketOverview ? scopedMarkets.filter((m) => marketOverview[m.key]) : []),
    [marketOverview, scopedMarkets],
  )

  // Tüm marketlerin sinyalleri, teknik puana göre. Önceden yalnızca "yeni" sinyaller
  // gösteriliyordu; yeni sinyal olmayan günlerde (sık) sayfada hiç hisse kalmıyordu.
  // Artık sinyaller hep listelenir, yeni olanlar rozetle ayrışır.
  const signals = useMemo(() => {
    if (!overview) return []
    const out = []
    for (const m of scopedMarkets) {
      const payload = overview[m.key]
      const emaPeriods = payload?.ema_periods || [9, 21, 50, 200]
      for (const s of payload?.results || []) {
        out.push({ ...s, market: m, score: technicalScore(s, emaPeriods) })
      }
    }
    // Yeniler önce, sonra puan: yeni sinyal günün asıl haberi
    out.sort((a, b) => Number(b.is_new || false) - Number(a.is_new || false) || b.score - a.score)
    return out.slice(0, 12)
  }, [overview, scopedMarkets])

  // Sayım, rozetlerle AYNI alandan (is_new) türetilir. Payload'daki new_count'u
  // kullanmak, ikisinin ayrışıp "1 yeni sinyal" yazarken hiç rozet göstermemesine
  // yol açabiliyordu.
  const newSignalCount = useMemo(() => {
    if (!overview) return 0
    return scopedMarkets.reduce(
      (n, m) => n + (overview[m.key]?.results || []).filter((s) => s.is_new).length,
      0,
    )
  }, [overview, scopedMarkets])

  const indexes = useMemo(() => {
    if (!overview) return []
    const seen = new Set()
    const out = []
    for (const m of scopedMarkets) {
      const b = overview[m.key]?.benchmark
      // Endeksin adı marketin adından gelmez: S&P nabzı, sp500 kapalıyken ETF
      // marketi üzerinden geliyor ve kart yine "S&P 500" demeli.
      if (!b || seen.has(b.symbol)) continue
      seen.add(b.symbol)
      out.push({ ...b, label: b.name || mLabel(m, lang) })
    }
    return out
  }, [overview, scopedMarkets, lang])

  // Popülerliğe (yatırımcı sayısı) göre — puana göre sıralamak, 1-18 yatırımcılı
  // niş fonları "öne çıkan" diye tepeye taşıyordu. Puan yine kartta duruyor.
  const popularFunds = useMemo(
    () =>
      [...(funds?.results || [])]
        .filter((f) => f.investor_count)
        .sort((a, b) => b.investor_count - a.investor_count)
        .slice(0, 3),
    [funds],
  )

  // Haberler de seçili piyasadan: BIST sekmesinde ABD haberi göstermek sayfanın
  // "bugün burada ne oldu" vaadini bozardı.
  const topNews = useMemo(() => {
    const items = news?.items || []
    return items
      .filter((i) => (scope === 'bist' ? isBistSymbol(i.symbol) : !isBistSymbol(i.symbol)))
      .slice(0, 6)
  }, [news, scope])

  if (loading && !overview) return <div className="empty-box">{t(lang, 'todayLoading')}</div>
  if (error && !overview) return <div className="error-box">{error}</div>
  if (!overview) return null

  const firstMarketKey = scopedMarkets.find((m) => overview[m.key])?.key
  const generatedAt = firstMarketKey ? overview[firstMarketKey]?.generated_at : null

  return (
    <div className="today">
      <div className="status-bar">
        <span>{t(lang, 'todayIntro')}</span>
        {generatedAt && (
          <span className="bt-period">
            {t(lang, 'todayLastScan', new Date(generatedAt).toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR'))}
          </span>
        )}
      </div>

      {/* Piyasa seçimi: sayfanın tamamı (nabız, sinyaller, hareketliler, genişlik,
          sektör ısı haritası, haberler) seçili piyasaya göre filtrelenir. */}
      <div className="tabs today-scope-tabs" role="group" aria-label={t(lang, 'todayScopeLabel')}>
        {[
          { key: 'bist', i18nKey: 'todayScopeBist' },
          { key: 'global', i18nKey: 'todayScopeGlobal' },
        ].map((s) => (
          <button
            key={s.key}
            type="button"
            className={`tab ${scope === s.key ? 'active' : ''}`}
            onClick={() => setScope(s.key)}
          >
            {t(lang, s.i18nKey)}
          </button>
        ))}
      </div>

      {indexes.length > 0 && (
        <section className="today-section">
          <h2 className="today-title">{t(lang, 'todayIndexes')}</h2>
          <div className="today-cards">
            {indexes.map((idx) => (
              <div key={idx.symbol} className="today-card index-card">
                <span className="today-card-label">{idx.label}</span>
                <strong className="today-card-value">{formatNum(idx.close, 2)}</strong>
                <span className={`pct ${pctTone(idx.change)}`}>{formatPct(idx.change, 2)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="today-section">
        <h2 className="today-title">
          {t(lang, 'todaySignals')}
          <button className="link-btn" onClick={() => onNavigate('screener')}>
            {t(lang, 'todaySeeAll')}
          </button>
        </h2>
        <p className="today-note">
          {newSignalCount > 0 ? t(lang, 'todayNewCount', newSignalCount) : t(lang, 'todayNoNew')}
        </p>
        {signals.length === 0 ? (
          <div className="empty-box">{t(lang, 'todaySignalsEmpty')}</div>
        ) : (
          <div className="today-signals">
            {signals.map((s) => (
              <button key={s.symbol} className="today-signal" onClick={() => onOpenChart(s.symbol)}>
                <TickerLogo symbol={s.symbol} />
                <span className="today-signal-main">
                  <span className="today-signal-symbol">
                    {displaySymbol(s.symbol)}
                    {s.is_new && <span className="badge new-badge">{t(lang, 'todayNewBadge')}</span>}
                  </span>
                  <span className="today-signal-sub">
                    {mLabel(s.market, lang)} · {t(lang, 'colScore')} {s.score}
                  </span>
                </span>
                {/* Bugünün değişimi: "Bugün" sayfasında beklenen rakam bu.
                    Göreli güç 3 aylık bir ölçü, burada yanıltıcı oluyordu. */}
                <span className={`pct ${pctTone(s.change)}`}>{formatPct(s.change, 2)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <TopMovers overview={overview} allMarkets={scopedMarkets} lang={lang} onOpenChart={onOpenChart} />

      <ChangeReport scores={scores} lang={lang} scope={scope} onOpenChart={onOpenChart} />

      <MarketBreadth overview={overview} allMarkets={scopedMarkets} lang={lang} />

      <SectorHeatmap overview={overview} allMarkets={scopedMarkets} lang={lang} />

      <section className="today-section">
        <h2 className="today-title">{t(lang, 'todayMarkets')}</h2>
        <div className="tabs today-tf-tabs">
          {TODAY_TIMEFRAMES.map((tf) => (
            <button
              key={tf.key}
              className={`tab ${todayTimeframe === tf.key ? 'active' : ''}`}
              onClick={() => onTodayTimeframe(tf.key)}
            >
              {tfLabel(tf, lang)}
            </button>
          ))}
        </div>
        {loading && !marketOverview ? (
          <div className="empty-box">{t(lang, 'todayLoading')}</div>
        ) : error && !marketOverview ? (
          <div className="error-box">{error}</div>
        ) : marketOverview ? (
          <div className="today-cards">
            {markets.map((m) => (
              <button
                key={m.key}
                className="today-card market-card"
                onClick={() => onNavigate('screener', m.key, todayTimeframe)}
              >
                <span className="today-card-label">{mLabel(m, lang)}</span>
                <strong className="today-card-value">{marketOverview[m.key].count}</strong>
                <span className="today-card-sub">
                  {t(
                    lang,
                    'todayMarketLine',
                    marketOverview[m.key].count,
                    marketOverview[m.key].scanned,
                  )}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {/* TEFAS fonları yalnızca Türkiye piyasasına ait; ABD sekmesinde gösterilmez */}
      {scope === 'bist' && popularFunds.length > 0 && (
        <section className="today-section">
          <h2 className="today-title">
            {t(lang, 'todayFunds')}
            <button className="link-btn" onClick={() => onNavigate('funds')}>
              {t(lang, 'todaySeeAll')}
            </button>
          </h2>
          <p className="today-note">{t(lang, 'todayFundsNote')}</p>
          <div className="today-cards">
            {popularFunds.map((f) => (
              <button key={f.symbol} className="today-card fund-card" onClick={() => onOpenFund(f)}>
                <span className="today-card-label fund-card-label">
                  <TickerLogo symbol={f.symbol} />
                  <strong>{f.symbol}</strong> ·{' '}
                  <span className={`badge score-${scoreTone(f.score)}`}>{f.score}</span>
                </span>
                {/* Büyük rakam bugünün getirisi ("Bugün" sayfasında beklenen bu),
                    1 yıllık altında ve HER İKİSİ de dönem etiketli: etiketsiz bir
                    +%226 bugünün getirisi sanılıyordu. */}
                <strong className="today-card-value">
                  <span className={`pct ${pctTone(f.return_1d)}`}>{formatPct(f.return_1d, 2)}</span>
                  <span className="today-card-unit">{t(lang, 'todayFundTodayLabel')}</span>
                </strong>
                <span className="today-card-sub">
                  <span className={`pct ${pctTone(f.return_1y)}`}>{formatPct(f.return_1y)}</span>{' '}
                  {t(lang, 'todayFundReturnLabel')} · {t(lang, 'todayFundHolders', f.investor_count)}
                </span>
                <span className="today-card-sub">{f.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {topNews.length > 0 && (
        <section className="today-section">
          <h2 className="today-title">
            {t(lang, 'todayNews')}
            <button className="link-btn" onClick={() => onNavigate('news')}>
              {t(lang, 'todaySeeAll')}
            </button>
          </h2>
          <NewsList items={topNews} lang={lang} onOpenChart={onOpenChart} />
        </section>
      )}

      <p className="disclaimer">{t(lang, 'disclaimer')}</p>
    </div>
  )
}

/** Oran gösterimi (isabet vb.): formatPct'in aksine işaret öneki istemez. */
const formatRate = (v, digits = 0) => (v == null ? '—' : `${(v * 100).toFixed(digits)}%`)

const MONEY_UNIT = { bist100: 'TL', sp500: '$', etf: '$', commodity: '$' }
// Binlik ayracı dile bağlı: "15.158" TR'de on beş bin, EN'de ondalık okunur.
const formatMoney = (v, lang) =>
  v == null ? '—' : Math.round(v).toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR')

/**
 * İki getiri eğrisini (portföy vs endeks) karşılaştıran SVG grafik.
 * Noktalar zamana göre yerleştirilir — eğri noktaları eşit aralıklı olmadığından
 * indekse göre çizmek zaman eksenini çarpıtırdı.
 */
function EquityChart({ curve, benchmarkCurve, lang }) {
  const W = 720
  const H = 240
  const PAD = { top: 10, right: 8, bottom: 20, left: 46 }

  const all = [...curve, ...(benchmarkCurve || [])]
  if (all.length < 2) return null

  const times = all.map((p) => Date.parse(p.date))
  const minT = Math.min(...times)
  const maxT = Math.max(...times)
  const maxV = Math.max(...all.map((p) => p.value))
  const minV = Math.min(0, ...all.map((p) => p.value))
  const spanT = maxT - minT || 1
  const spanV = maxV - minV || 1

  const x = (d) => PAD.left + ((Date.parse(d) - minT) / spanT) * (W - PAD.left - PAD.right)
  const y = (v) => PAD.top + (1 - (v - minV) / spanV) * (H - PAD.top - PAD.bottom)
  const path = (pts) => pts.map((p) => `${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')

  const ticks = [minV, minV + spanV / 2, maxV]
  const year = (d) => new Date(d).getFullYear()

  return (
    <svg className="equity-chart" viewBox={`0 0 ${W} ${H}`} role="img" preserveAspectRatio="none">
      {ticks.map((v) => (
        <g key={v}>
          <line className="eq-grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
          <text className="eq-label" x={PAD.left - 6} y={y(v) + 4} textAnchor="end">
            {formatMoney(v, lang)}
          </text>
        </g>
      ))}
      <text className="eq-label" x={PAD.left} y={H - 6}>
        {year(minT)}
      </text>
      <text className="eq-label" x={W - PAD.right} y={H - 6} textAnchor="end">
        {year(maxT)}
      </text>
      {benchmarkCurve?.length > 1 && (
        <polyline className="eq-line eq-benchmark" points={path(benchmarkCurve)} />
      )}
      <polyline className="eq-line eq-strategy" points={path(curve)} />
    </svg>
  )
}

function BacktestPortfolio({ lang, portfolio, market }) {
  const dist = portfolio.distribution
  const unit = MONEY_UNIT[market] || ''
  const beat = dist?.beat_benchmark_trials

  return (
    <div className="bt-portfolio">
      <h3>{t(lang, 'btPfTitle', formatMoney(portfolio.initial_capital, lang), unit)}</h3>

      <div className="bt-pf-figures">
        <div className="bt-pf-figure">
          <span className="bt-pf-legend eq-strategy-dot" />
          <span className="bt-pf-label">{t(lang, 'btPfStrategy')}</span>
          <strong className="bt-pf-value">
            {formatMoney(dist?.median_final_value ?? portfolio.final_value, lang)} {unit}
          </strong>
          {dist && (
            <span className="bt-pf-sub">
              {t(lang, 'btPfRange', formatMoney(dist.p10_final_value, lang), formatMoney(dist.p90_final_value, lang))}
            </span>
          )}
        </div>

        {portfolio.benchmark_final_value != null && (
          <div className="bt-pf-figure">
            <span className="bt-pf-legend eq-benchmark-dot" />
            <span className="bt-pf-label">{t(lang, 'btPfBenchmark')}</span>
            <strong className="bt-pf-value">
              {formatMoney(portfolio.benchmark_final_value, lang)} {unit}
            </strong>
            {beat != null && <span className="bt-pf-sub">{t(lang, 'btPfBeat', beat, dist.trials)}</span>}
          </div>
        )}
      </div>

      <EquityChart curve={portfolio.curve} benchmarkCurve={portfolio.benchmark_curve} lang={lang} />

      <p className="bt-pf-rules">
        {t(
          lang,
          'btPfRules',
          portfolio.max_positions,
          portfolio.horizon,
          portfolio.trades_taken,
          portfolio.signals_skipped,
        )}{' '}
        {t(lang, 'btPfDrawdown')}:{' '}
        <strong className="pct neg">{formatPct(portfolio.max_drawdown, 1)}</strong>
      </p>

      {/* Aralığın neden tek rakamdan daha dürüst olduğu: gizlenirse rakam abartılı okunur */}
      <p className="bt-pf-why">{t(lang, 'btPfWhyRange')}</p>
      <p className="bt-pf-why">{t(lang, 'btPfNote')}</p>
    </div>
  )
}

/** Tek bir ufkun (örn. "sinyalden 20 mum sonra") strateji/endeks karşılaştırması. */
function BacktestHorizon({ lang, bars, stats }) {
  const hasBenchmark = stats.beat_benchmark_rate != null

  return (
    <div className="bt-card">
      <div className="bt-card-head">
        <h3>{t(lang, 'btHorizonTitle', bars)}</h3>
        <span className="bt-sample">{t(lang, 'btSampleSize', stats.count)}</span>
      </div>

      <div className="bt-metric">
        <span>{t(lang, 'btAvgReturn')}</span>
        <strong className={`pct ${pctTone(stats.avg_return)}`}>{formatPct(stats.avg_return, 2)}</strong>
      </div>
      <div className="bt-metric">
        <span>{t(lang, 'btMedianReturn')}</span>
        <strong className={`pct ${pctTone(stats.median_return)}`}>{formatPct(stats.median_return, 2)}</strong>
      </div>

      {hasBenchmark && (
        <>
          {/* Endeks satırı stratejinin hemen altında: karşılaştırma kendiliğinden görünsün */}
          <div className="bt-metric bt-benchmark">
            <span>{t(lang, 'btBenchmark')}</span>
            <strong>{formatPct(stats.avg_benchmark_return, 2)}</strong>
          </div>
          <div className="bt-metric">
            <span>{t(lang, 'btExcess')}</span>
            <strong className={`pct ${pctTone(stats.avg_excess_return)}`}>
              {formatPct(stats.avg_excess_return, 2)}
            </strong>
          </div>
          <div className="bt-metric bt-headline">
            <span>{t(lang, 'btBeatRate')}</span>
            <strong>{formatRate(stats.beat_benchmark_rate)}</strong>
          </div>
        </>
      )}

      <div className="bt-metric">
        <span>{t(lang, 'btWinRate')}</span>
        <strong>{formatRate(stats.win_rate)}</strong>
      </div>
    </div>
  )
}

function BacktestView({ lang, data, market, timeframe, loading, error }) {
  const summary = data?.markets?.[market]?.[timeframe]
  const when = data?.generated_at
    ? new Date(data.generated_at).toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR')
    : ''
  const caveats = t(lang, 'btCaveats')

  return (
    <>
      <div className="status-bar">
        <span>
          {summary
            ? t(lang, 'btStatus', summary.signals, summary.symbols, when)
            : loading
              ? t(lang, 'btLoading')
              : ''}
        </span>
        {summary?.first_signal && (
          <span className="bt-period">{t(lang, 'btPeriod', summary.first_signal, summary.last_signal)}</span>
        )}
      </div>

      <details className="info-panel">
        <summary>{t(lang, 'btHowTitle')}</summary>
        <div className="info-content">
          <p>{t(lang, 'btHowBody1')}</p>
          <p>{t(lang, 'btHowBody2')}</p>
        </div>
      </details>

      {error && <div className="error-box">{error}</div>}

      {!error && !loading && !summary && <div className="empty-box">{t(lang, 'btEmpty')}</div>}

      {summary?.portfolio && (
        <BacktestPortfolio lang={lang} portfolio={summary.portfolio} market={market} />
      )}

      {summary && (
        <>
          <div className="bt-grid">
            {(summary.horizons_bars || []).map((bars) => {
              const stats = summary.horizons?.[String(bars)]
              return stats ? (
                <BacktestHorizon key={bars} lang={lang} bars={bars} stats={stats} />
              ) : null
            })}
          </div>

          {summary.avg_max_drawdown != null && (
            <div className="bt-note">
              {t(lang, 'btAvgDrawdown')}:{' '}
              <strong className="pct neg">{formatPct(summary.avg_max_drawdown, 1)}</strong>
            </div>
          )}

          <details className="info-panel bt-caveats" open>
            <summary>{t(lang, 'btCaveatsTitle')}</summary>
            <div className="info-content">
              <ul>
                {caveats.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </details>

          {summary.top_symbols?.length > 0 && (
            <>
              <div className="bt-note">
                <strong>{t(lang, 'btTopTitle')}</strong> — {t(lang, 'btTopNote')}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t(lang, 'colSymbol')}</th>
                      <th>{t(lang, 'btColSignals')}</th>
                      <th>{t(lang, 'btColAvg')}</th>
                      <th>{t(lang, 'btColWin')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.top_symbols.map((r) => (
                      <tr key={r.symbol}>
                        <td>{displaySymbol(r.symbol)}</td>
                        <td>{r.signals}</td>
                        <td className={`pct ${pctTone(r.avg_return)}`}>{formatPct(r.avg_return, 1)}</td>
                        <td>{formatRate(r.win_rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      <p className="disclaimer">{t(lang, 'disclaimer')}</p>
    </>
  )
}

// TR fon isimleri regüle olduğundan kategori büyük ölçüde addan çıkarılabilir.
// Sıra önemli: daha spesifik kalıplar önce denenir (ör. "Para Piyasası Katılım"
// para piyasasıdır, katılım değil).
const FUND_CATEGORY_RULES = [
  { key: 'money', i18nKey: 'catMoney', re: /PARA PİYASASI|LİKİT/ },
  { key: 'gold', i18nKey: 'catGold', re: /KIYMETLİ MADEN|ALTIN|GÜMÜŞ/ },
  { key: 'basket', i18nKey: 'catBasket', re: /FON SEPETİ|SEPET FONU/ },
  { key: 'hedge', i18nKey: 'catHedge', re: /SERBEST/ },
  { key: 'foreign', i18nKey: 'catForeign', re: /EUROBOND|YABANCI|DÖVİZ|(YABANCI )?BORÇLANMA.*DÖVİZ/ },
  { key: 'participation', i18nKey: 'catParticipation', re: /KATILIM/ },
  { key: 'bond', i18nKey: 'catBond', re: /BORÇLANMA ARAÇLARI|TAHVİL|BONO|BORÇLANMA/ },
  { key: 'index', i18nKey: 'catIndex', re: /ENDEKS/ },
  { key: 'equity', i18nKey: 'catEquity', re: /HİSSE SENEDİ|HİSSE/ },
  { key: 'mixed', i18nKey: 'catMixed', re: /KARMA|DEĞİŞKEN/ },
]

const FUND_CATEGORY_ORDER = [
  'equity', 'index', 'bond', 'gold', 'money', 'mixed',
  'participation', 'basket', 'hedge', 'foreign', 'other',
]

function categorizeFund(name) {
  const upper = (name || '').toLocaleUpperCase('tr-TR')
  for (const rule of FUND_CATEGORY_RULES) {
    if (rule.re.test(upper)) return rule.key
  }
  return 'other'
}

const catI18nKey = (key) => FUND_CATEGORY_RULES.find((r) => r.key === key)?.i18nKey || 'catOther'

function median(values) {
  const arr = values.filter((v) => v != null).sort((a, b) => a - b)
  if (!arr.length) return null
  const mid = Math.floor(arr.length / 2)
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2
}

const FUND_LEAGUE_METRICS = [
  { key: 'score', i18nKey: 'flMetricScore' },
  { key: 'return_1y', i18nKey: 'flMetricReturn' },
  { key: 'sharpe', i18nKey: 'flMetricSharpe' },
]

/**
 * Fon Ligi: fonları addan çıkarılan kategoriye göre gruplar; her ligde seçili
 * metriğe (puan / 1Y getiri / Sharpe) göre liderleri gösterir. Fonly'deki
 * kategori sıralamalarının hafif bir karşılığı — tümü mevcut fon verisinden.
 */
function FundLeague({ funds, lang, loading, onOpenFund }) {
  const [metric, setMetric] = useState('score')
  // Açık (tüm fonları listelenen) kategoriler: "+N fon daha" tıklanınca genişler
  const [expanded, setExpanded] = useState(() => new Set())

  const groups = useMemo(() => {
    const byCat = new Map()
    for (const f of funds?.results || []) {
      const cat = categorizeFund(f.name)
      if (!byCat.has(cat)) byCat.set(cat, [])
      byCat.get(cat).push(f)
    }
    return FUND_CATEGORY_ORDER.filter((c) => byCat.has(c)).map((cat) => {
      const list = byCat.get(cat)
      const sorted = [...list].sort((a, b) => (b[metric] ?? -Infinity) - (a[metric] ?? -Infinity))
      return {
        cat,
        count: list.length,
        medianReturn: median(list.map((f) => f.return_1y)),
        top: expanded.has(cat) ? sorted : sorted.slice(0, 5),
      }
    })
  }, [funds, metric, expanded])

  const toggleExpanded = (cat) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })

  if (loading && !funds) return <div className="empty-box">{t(lang, 'fundsLoading')}</div>
  if (!funds?.results?.length) return <div className="empty-box">{t(lang, 'flEmpty')}</div>

  const metricCell = (f) => {
    if (metric === 'score') return <span className={`badge score-${scoreTone(f.score)}`}>{f.score}</span>
    if (metric === 'sharpe') return <span className="fl-metric-num">{f.sharpe != null ? f.sharpe.toFixed(2) : '—'}</span>
    return <span className={`pct ${pctTone(f.return_1y)}`}>{formatPct(f.return_1y)}</span>
  }

  return (
    <>
      <div className="status-bar">
        <span>{t(lang, 'flIntro')}</span>
        <div className="fl-sort">
          <span className="fl-sort-label">{t(lang, 'flSortLabel')}:</span>
          <div className="tabs">
            {FUND_LEAGUE_METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`tab ${metric === m.key ? 'active' : ''}`}
                onClick={() => setMetric(m.key)}
              >
                {t(lang, m.i18nKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="fl-grid">
        {groups.map((g) => (
          <section key={g.cat} className="fl-cat">
            <div className="fl-cat-head">
              <h3 className="fl-cat-name">{t(lang, catI18nKey(g.cat))}</h3>
              <span className="fl-cat-meta">
                {t(lang, 'flCount', g.count)}
                {g.medianReturn != null && ` · ${t(lang, 'flMedian', formatPct(g.medianReturn))}`}
              </span>
            </div>
            <ol className="fl-list">
              {g.top.map((f, i) => (
                <li key={f.symbol}>
                  <button type="button" className="fl-row" onClick={() => onOpenFund(f)} title={f.name}>
                    <span className={`fl-rank ${i === 0 ? 'lead' : ''}`}>{i + 1}</span>
                    <TickerLogo symbol={f.symbol} />
                    <span className="fl-fund">
                      <strong>{f.symbol}</strong>
                      <span className="fund-name">{f.name}</span>
                    </span>
                    {metricCell(f)}
                  </button>
                </li>
              ))}
            </ol>
            {g.count > 5 && (
              <button type="button" className="fl-more" onClick={() => toggleExpanded(g.cat)}>
                {expanded.has(g.cat) ? t(lang, 'flLess') : t(lang, 'flMore', g.count - 5)}
              </button>
            )}
          </section>
        ))}
      </div>
      <p className="disclaimer">{t(lang, 'fundDisclaimer')}</p>
    </>
  )
}

/**
 * Squarified treemap yerleşimi: değerleri (value) verilen kutucukları, en-boy
 * oranı 1'e yakın (kare) kalacak şekilde dikdörtgen alana yerleştirir.
 * Klasik "squarify" algoritması. Dönen her öğe {x, y, w, h} taşır.
 */
function squarifyTreemap(items, x, y, width, height) {
  const out = []
  const positive = items.filter((it) => it.value > 0)
  const total = positive.reduce((s, it) => s + it.value, 0)
  if (total <= 0 || width <= 0 || height <= 0) return out
  const norm = (width * height) / total
  const scaled = positive.map((it) => ({ item: it, area: it.value * norm }))

  const rect = { x, y, w: width, h: height }

  const worst = (row, side) => {
    const sum = row.reduce((s, r) => s + r.area, 0)
    const max = Math.max(...row.map((r) => r.area))
    const min = Math.min(...row.map((r) => r.area))
    const s2 = sum * sum
    const side2 = side * side
    return Math.max((side2 * max) / s2, s2 / (side2 * min))
  }

  const flush = (row) => {
    const side = Math.min(rect.w, rect.h)
    const sum = row.reduce((s, r) => s + r.area, 0)
    const thickness = sum / side
    if (rect.w >= rect.h) {
      let cy = rect.y
      for (const r of row) {
        const ih = r.area / thickness
        out.push({ ...r.item, x: rect.x, y: cy, w: thickness, h: ih })
        cy += ih
      }
      rect.x += thickness
      rect.w -= thickness
    } else {
      let cx = rect.x
      for (const r of row) {
        const iw = r.area / thickness
        out.push({ ...r.item, x: cx, y: rect.y, w: iw, h: thickness })
        cx += iw
      }
      rect.y += thickness
      rect.h -= thickness
    }
  }

  let row = []
  for (const s of scaled) {
    const side = Math.min(rect.w, rect.h)
    if (row.length === 0 || worst([...row, s], side) <= worst(row, side)) {
      row.push(s)
    } else {
      flush(row)
      row = [s]
    }
  }
  if (row.length) flush(row)
  return out
}

// Değişimi (ör. ±%6 bandı) yeşil/kırmızı dolgu rengine çevirir (treemap kutuları).
function heatFill(change) {
  if (change == null) return 'rgba(148,163,184,0.35)'
  const mag = Math.min(Math.abs(change) / 0.06, 1)
  const alpha = 0.28 + mag * 0.62
  const rgb = change >= 0 ? '22, 163, 74' : '220, 38, 38'
  return `rgba(${rgb}, ${alpha})`
}

/**
 * Piyasa ısı haritası: seçili marketin taranan hisselerini sektöre göre gruplayıp
 * piyasa değeriyle orantılı kutulara böler; renk bugünkü değişimi verir (Finviz
 * tarzı). Veri "Bugün" özetiyle aynı kaynaktan (overview[market].stocks).
 */
function MarketMap({ overview, market, lang, onOpenChart }) {
  const W = 1000
  const H = 560
  const layout = useMemo(() => {
    const stocks = (overview?.[market]?.stocks || []).filter(
      (s) => s.market_cap > 0 && s.change != null,
    )
    if (stocks.length < 2) return null

    // Sektöre göre grupla (sektörsüz → "Diğer")
    const bySector = new Map()
    for (const s of stocks) {
      const key = s.sector || '—'
      if (!bySector.has(key)) bySector.set(key, [])
      bySector.get(key).push(s)
    }
    const sectors = [...bySector.entries()]
      .map(([sector, list]) => ({
        sector,
        list,
        value: list.reduce((sum, s) => sum + s.market_cap, 0),
      }))
      .sort((a, b) => b.value - a.value)

    // 1. seviye: sektör dikdörtgenleri; 2. seviye: sektör içinde hisseler
    const sectorRects = squarifyTreemap(sectors, 0, 0, W, H)
    const tiles = []
    for (const sr of sectorRects) {
      const pad = 1
      const inner = squarifyTreemap(
        [...sr.list].sort((a, b) => b.market_cap - a.market_cap).map((s) => ({ ...s, value: s.market_cap })),
        sr.x + pad,
        sr.y + pad + (sr.w > 90 && sr.h > 34 ? 16 : 0), // sektör başlığına yer
        sr.w - pad * 2,
        sr.h - pad * 2 - (sr.w > 90 && sr.h > 34 ? 16 : 0),
      )
      tiles.push({ sector: sr, cells: inner })
    }
    return { tiles }
  }, [overview, market])

  if (!layout) return <div className="empty-box">{t(lang, 'mapEmpty')}</div>

  return (
    <div className="marketmap-wrap">
      <svg
        className="marketmap"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t(lang, 'tabMap')}
        preserveAspectRatio="none"
      >
        {layout.tiles.map(({ sector, cells }) => (
          <g key={sector.sector}>
            {sector.w > 90 && sector.h > 34 && (
              <text className="marketmap-sector" x={sector.x + 6} y={sector.y + 12}>
                {sectorLabel(sector.sector, lang)}
              </text>
            )}
            {cells.map((c) => {
              const big = c.w > 46 && c.h > 26
              const mid = c.w > 30 && c.h > 16
              return (
                <g key={c.symbol} className="marketmap-tile" onClick={() => onOpenChart(c.symbol)}>
                  <rect
                    x={c.x}
                    y={c.y}
                    width={Math.max(c.w - 1, 0)}
                    height={Math.max(c.h - 1, 0)}
                    fill={heatFill(c.change)}
                    rx="2"
                  >
                    <title>{`${displaySymbol(c.symbol)} · ${formatPct(c.change, 2)}`}</title>
                  </rect>
                  {mid && (
                    <text
                      className="marketmap-label"
                      x={c.x + c.w / 2}
                      y={c.y + c.h / 2 + (big ? -1 : 3)}
                      textAnchor="middle"
                      style={{ fontSize: big ? 12 : 9 }}
                    >
                      {displaySymbol(c.symbol)}
                    </text>
                  )}
                  {big && (
                    <text
                      className="marketmap-change"
                      x={c.x + c.w / 2}
                      y={c.y + c.h / 2 + 12}
                      textAnchor="middle"
                    >
                      {formatPct(c.change, 1)}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        ))}
      </svg>
      <div className="marketmap-legend">
        <span>{t(lang, 'mapLegendDown')}</span>
        <span className="marketmap-scale" />
        <span>{t(lang, 'mapLegendUp')}</span>
        <span className="marketmap-size-note">{t(lang, 'mapSizeNote')}</span>
      </div>
    </div>
  )
}

// Değişimi (±%6 bandı) canlı bir yeşil/kırmızı balon rengine çevirir.
function bubbleColor(change) {
  const mag = Math.min(Math.abs(change) / 0.06, 1)
  if (change >= 0) {
    const g = Math.round(120 + mag * 90)
    return { fill: `rgba(22, ${g}, 74, 0.92)`, glow: 'rgba(34,197,94,0.55)' }
  }
  const r = Math.round(200 + mag * 55)
  return { fill: `rgba(${r}, 38, 38, 0.92)`, glow: 'rgba(239,68,68,0.55)' }
}

/**
 * Piyasa Baloncukları: her hisse fiziksel bir balon — yarıçapı piyasa değeri,
 * rengi günlük değişim. Yükselenler yukarı süzülür, düşenler dibe iner; hafif
 * çarpışma + salınımla canlı durur. Kanvas + requestAnimationFrame. Veri "Bugün"
 * özetinden (overview[market].stocks), ek istek yok. Bir balona tık → grafik.
 */
function MarketBubbles({ overview, market, lang, onOpenChart }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)

  const stocks = useMemo(
    () =>
      (overview?.[market]?.stocks || [])
        .filter((s) => s.market_cap > 0 && s.change != null)
        .sort((a, b) => b.market_cap - a.market_cap)
        .slice(0, 120), // BIST 100'ün tamamı sığar; S&P'de en büyük 120 gösterilir
    [overview, market],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap || stocks.length < 2) return

    let W = wrap.clientWidth || 800
    let H = Math.max(420, Math.min(640, Math.round(W * 0.6)))
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const ctx = canvas.getContext('2d')

    const caps = stocks.map((s) => s.market_cap)
    const sMin = Math.sqrt(Math.min(...caps))
    const sMax = Math.sqrt(Math.max(...caps))
    const maxAbs = Math.max(...stocks.map((s) => Math.abs(s.change)), 0.01)

    let bubbles = []
    const build = () => {
      // Balon sayısı arttıkça yarıçaplar küçülür; 100 hisse de kanvasa sığar
      const density = Math.sqrt(48 / Math.max(stocks.length, 1))
      const rMin = Math.max(10, (W / 46) * density)
      const rMax = Math.min(70, Math.max(rMin + 8, (W / 9) * density))
      bubbles = stocks.map((s) => {
        const tt = (Math.sqrt(s.market_cap) - sMin) / (sMax - sMin || 1)
        const r = rMin + tt * (rMax - rMin)
        return {
          s,
          r,
          x: r + Math.random() * (W - 2 * r),
          y: r + Math.random() * (H - 2 * r),
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          ...bubbleColor(s.change),
        }
      })
    }

    const resize = () => {
      W = wrap.clientWidth || 800
      H = Math.max(420, Math.min(640, Math.round(W * 0.6)))
      canvas.width = W * dpr
      canvas.height = H * dpr
      canvas.style.width = `${W}px`
      canvas.style.height = `${H}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      build()
    }
    resize()

    let raf
    const step = () => {
      const pad = 26
      // Dikey hedef: yükselen yukarı, düşen aşağı (değişim → y konumu)
      for (const b of bubbles) {
        const norm = Math.max(-1, Math.min(1, b.s.change / maxAbs))
        const yTarget = pad + b.r + (1 - (norm + 1) / 2) * (H - 2 * (pad + b.r))
        b.vy += (yTarget - b.y) * 0.012
        b.vx += (W / 2 - b.x) * 0.0006 // hafif merkeze çekim
        b.vx += (Math.random() - 0.5) * 0.15 // canlı salınım
        b.vy += (Math.random() - 0.5) * 0.15
      }
      // Çarpışma: birbirini yumuşakça iter
      for (let i = 0; i < bubbles.length; i += 1) {
        for (let j = i + 1; j < bubbles.length; j += 1) {
          const a = bubbles[i]
          const c = bubbles[j]
          let dx = c.x - a.x
          let dy = c.y - a.y
          let dist = Math.hypot(dx, dy) || 0.01
          const min = a.r + c.r + 2
          if (dist < min) {
            const push = (min - dist) / dist / 2
            dx *= push
            dy *= push
            a.x -= dx
            a.y -= dy
            c.x += dx
            c.y += dy
          }
        }
      }
      ctx.clearRect(0, 0, W, H)
      for (const b of bubbles) {
        b.vx *= 0.86
        b.vy *= 0.86
        b.x += b.vx
        b.y += b.vy
        if (b.x < b.r) { b.x = b.r; b.vx *= -0.5 }
        if (b.x > W - b.r) { b.x = W - b.r; b.vx *= -0.5 }
        if (b.y < b.r) { b.y = b.r; b.vy *= -0.5 }
        if (b.y > H - b.r) { b.y = H - b.r; b.vy *= -0.5 }

        // Balon: parıltı + gövde
        const grd = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1, b.x, b.y, b.r)
        grd.addColorStop(0, b.glow)
        grd.addColorStop(1, b.fill)
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
        ctx.fillStyle = grd
        ctx.fill()

        if (b.r > 20) {
          ctx.fillStyle = 'rgba(255,255,255,0.96)'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.font = `700 ${Math.min(15, b.r * 0.42)}px system-ui, sans-serif`
          ctx.fillText(displaySymbol(b.s.symbol), b.x, b.y - (b.r > 30 ? 6 : 0))
          if (b.r > 30) {
            ctx.font = `600 ${Math.min(12, b.r * 0.3)}px system-ui, sans-serif`
            ctx.fillText(`${b.s.change >= 0 ? '+' : ''}${(b.s.change * 100).toFixed(1)}%`, b.x, b.y + 9)
          }
        }
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)

    const hit = (e) => {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      return bubbles.find((b) => Math.hypot(b.x - mx, b.y - my) <= b.r)
    }
    const onClick = (e) => {
      const b = hit(e)
      if (b) onOpenChart(b.s.symbol)
    }
    const onMove = (e) => {
      canvas.style.cursor = hit(e) ? 'pointer' : 'default'
    }
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('mousemove', onMove)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('mousemove', onMove)
      window.removeEventListener('resize', resize)
    }
  }, [stocks, onOpenChart, lang])

  if (stocks.length < 2) return <div className="empty-box">{t(lang, 'bubblesEmpty')}</div>

  return (
    <div className="bubbles-wrap" ref={wrapRef}>
      <span className="bubbles-axis top">▲ {t(lang, 'bubblesUp')}</span>
      <span className="bubbles-axis bottom">▼ {t(lang, 'bubblesDown')}</span>
      <canvas ref={canvasRef} className="bubbles-canvas" />
    </div>
  )
}

/**
 * Piyasa hareketlileri: taranan tüm hisseleri günlük değişime göre sıralar,
 * en çok yükselen/düşen 8 hisseyi tek bakışta gösterir. Veri zaten "Bugün"
 * özetinin içinde (overview[market].stocks); ek istek gerektirmez.
 */
function TopMovers({ overview, allMarkets, lang, onOpenChart }) {
  const [tab, setTab] = useState('gainers')
  const movers = useMemo(() => {
    const bySymbol = new Map()
    for (const m of allMarkets) {
      for (const s of overview?.[m.key]?.stocks || []) {
        if (s.change == null) continue
        if (!bySymbol.has(s.symbol)) bySymbol.set(s.symbol, s)
      }
    }
    const all = [...bySymbol.values()]
    return {
      gainers: [...all].sort((a, b) => b.change - a.change).slice(0, 8),
      losers: [...all].sort((a, b) => a.change - b.change).slice(0, 8),
    }
  }, [overview, allMarkets])

  // En az birkaç hisse yoksa (ör. ilk tarama öncesi) panel gizlenir
  if (movers.gainers.length < 2) return null
  const list = tab === 'gainers' ? movers.gainers : movers.losers

  return (
    <section className="today-section">
      <h2 className="today-title">{t(lang, 'moversTitle')}</h2>
      <p className="today-note">{t(lang, 'moversHint')}</p>
      <div className="tabs movers-tabs">
        <button
          type="button"
          className={`tab ${tab === 'gainers' ? 'active' : ''}`}
          onClick={() => setTab('gainers')}
        >
          ▲ {t(lang, 'moversGainers')}
        </button>
        <button
          type="button"
          className={`tab ${tab === 'losers' ? 'active' : ''}`}
          onClick={() => setTab('losers')}
        >
          ▼ {t(lang, 'moversLosers')}
        </button>
      </div>
      <div className="movers-grid">
        {list.map((s) => (
          <button key={s.symbol} type="button" className="movers-row" onClick={() => onOpenChart(s.symbol)}>
            <TickerLogo symbol={s.symbol} />
            <span className="movers-main">
              <strong>{displaySymbol(s.symbol)}</strong>
              <span className="movers-sub">{formatNum(s.close, 2)}</span>
            </span>
            <span className={`pct movers-change ${pctTone(s.change)}`}>{formatPct(s.change, 2)}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

/**
 * Global arama paleti (⌘K / Ctrl+K): kullanıcı her sayfadan tek kısayolla tüm
 * taranan hisseler ve fonlar arasında arayıp grafiğe/fon detayına atlar.
 * "Her özelliğe kolay erişim" fikrinin merkezi giriş noktası.
 */
function CommandPalette({ open, onClose, overview, funds, allMarkets, navItems, lang, onOpenStock, onOpenFund, onNavigate }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)

  const index = useMemo(() => {
    const stocks = []
    const seen = new Set()
    for (const m of allMarkets) {
      for (const s of overview?.[m.key]?.stocks || []) {
        if (seen.has(s.symbol)) continue
        seen.add(s.symbol)
        stocks.push({ type: 'stock', symbol: s.symbol, name: displaySymbol(s.symbol), change: s.change })
      }
    }
    const fundItems = (funds?.results || []).map((f) => ({
      type: 'fund',
      symbol: f.symbol,
      name: f.name || f.symbol,
      fund: f,
    }))
    const pages = (navItems || []).map((it) => ({ type: 'page', key: it.key, name: t(lang, it.i18nKey) }))
    return { stocks, funds: fundItems, pages }
  }, [overview, funds, allMarkets, navItems, lang])

  const results = useMemo(() => {
    const query = q.trim().toLocaleUpperCase('tr-TR')
    // Sorgu boşken paleti açar açmaz tüm sayfalar hızlı erişim için listelenir
    if (!query) return { pages: index.pages, stocks: [], funds: [] }
    const match = (it) =>
      (it.symbol || '').toLocaleUpperCase('tr-TR').includes(query) ||
      (it.name || '').toLocaleUpperCase('tr-TR').includes(query)
    return {
      pages: index.pages.filter(match),
      stocks: index.stocks.filter(match).slice(0, 7),
      funds: index.funds.filter(match).slice(0, 7),
    }
  }, [q, index])

  const flat = useMemo(() => [...results.pages, ...results.stocks, ...results.funds], [results])

  useEffect(() => {
    setActive(0)
  }, [q])

  useEffect(() => {
    if (!open) return
    setQ('')
    setActive(0)
    const focusId = setTimeout(() => inputRef.current?.focus(), 30)
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(focusId)
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const choose = (item) => {
    if (!item) return
    if (item.type === 'page') onNavigate(item.key)
    else if (item.type === 'stock') onOpenStock(item.symbol)
    else onOpenFund(item.fund)
    onClose()
  }

  const onInputKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(flat[active])
    }
  }

  // idx her render'da yeniden sayılır; düz listeyle (flat) aynı sırayı tutar,
  // böylece klavye ile seçili satır tıklamayla birebir eşleşir.
  let idx = -1
  const row = (item) => {
    idx += 1
    const i = idx
    return (
      <button
        key={item.type + (item.symbol || item.key)}
        type="button"
        className={`cmdk-row ${i === active ? 'active' : ''}`}
        onMouseEnter={() => setActive(i)}
        onClick={() => choose(item)}
      >
        {item.type === 'page' ? (
          <span className="cmdk-page-icon" aria-hidden="true">
            <NavIcon name={item.key} />
          </span>
        ) : (
          <TickerLogo symbol={item.symbol} />
        )}
        <span className="cmdk-row-main">
          <strong>{item.type === 'page' ? item.name : displaySymbol(item.symbol)}</strong>
          {item.type === 'fund' && item.name && <span className="cmdk-row-sub">{item.name}</span>}
        </span>
        {item.type === 'stock' && item.change != null && (
          <span className={`pct ${pctTone(item.change)}`}>{formatPct(item.change, 2)}</span>
        )}
      </button>
    )
  }

  return (
    <div className="modal-backdrop cmdk-backdrop" onClick={onClose}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="cmdk-input-row">
          <span className="cmdk-search-icon" aria-hidden="true">🔍</span>
          <input
            ref={inputRef}
            className="cmdk-input"
            type="text"
            placeholder={t(lang, 'cmdkPlaceholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onInputKey}
            aria-label={t(lang, 'cmdkPlaceholder')}
          />
          <button className="cmdk-esc" type="button" onClick={onClose}>
            Esc
          </button>
        </div>
        <div className="cmdk-body">
          {flat.length === 0 ? (
            <div className="cmdk-hint">{t(lang, 'cmdkEmpty', q.trim())}</div>
          ) : (
            <>
              {results.pages.length > 0 && (
                <div className="cmdk-group">
                  <div className="cmdk-group-title">{t(lang, 'cmdkPages')}</div>
                  {results.pages.map(row)}
                </div>
              )}
              {results.stocks.length > 0 && (
                <div className="cmdk-group">
                  <div className="cmdk-group-title">{t(lang, 'cmdkStocks')}</div>
                  {results.stocks.map(row)}
                </div>
              )}
              {results.funds.length > 0 && (
                <div className="cmdk-group">
                  <div className="cmdk-group-title">{t(lang, 'cmdkFunds')}</div>
                  {results.funds.map(row)}
                </div>
              )}
            </>
          )}
        </div>
        <div className="cmdk-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> {t(lang, 'cmdkNav')}
          </span>
          <span>
            <kbd>↵</kbd> {t(lang, 'cmdkSelect')}
          </span>
          <span>
            <kbd>esc</kbd> {t(lang, 'cmdkClose')}
          </span>
        </div>
      </div>
    </div>
  )
}

/** "?" ile açılan klavye kısayolları penceresi. */
function ShortcutHelp({ open, onClose, lang }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const rows = [
    [['⌘', 'K'], t(lang, 'helpSearch')],
    [['↑', '↓', '↵'], t(lang, 'helpNavigate')],
    [['esc'], t(lang, 'helpClose')],
    [['?'], t(lang, 'helpHelp')],
  ]

  return (
    <div className="modal-backdrop cmdk-backdrop" onClick={onClose}>
      <div className="cmdk help-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="cmdk-input-row">
          <strong className="help-title">{t(lang, 'helpTitle')}</strong>
          <button className="cmdk-esc" type="button" onClick={onClose}>
            Esc
          </button>
        </div>
        <div className="cmdk-body help-body">
          {rows.map(([keys, label]) => (
            <div key={label} className="help-row">
              <span className="help-keys">
                {keys.map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </span>
              <span className="help-label">{label}</span>
            </div>
          ))}
          <p className="help-hint">{t(lang, 'helpHint')}</p>
        </div>
      </div>
    </div>
  )
}

function loadTheme() {
  try {
    const v = localStorage.getItem('theme')
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

// data-theme yoksa sistem tercihi (prefers-color-scheme) geçerli olur.
function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

const THEME_OPTIONS = [
  { key: 'light', i18nKey: 'themeLight', icon: '☀' },
  { key: 'dark', i18nKey: 'themeDark', icon: '☾' },
  { key: 'system', i18nKey: 'themeSystem', icon: '◐' },
]

// --- Fiyat / skor alarmları (client-side) ---
const ALERT_STOCK_FIELDS = [
  { key: 'score', i18nKey: 'colScore', kind: 'num' },
  { key: 'rsi', label: 'RSI', kind: 'num' },
  { key: 'close', i18nKey: 'alertPrice', kind: 'price' },
  { key: 'change', i18nKey: 'alertDailyChange', kind: 'pct' },
]
const ALERT_FUND_FIELDS = [
  { key: 'score', i18nKey: 'colScore', kind: 'num' },
  { key: 'return_1d', i18nKey: 'alertDailyChange', kind: 'pct' },
  { key: 'return_1y', label: '1Y %', kind: 'pct' },
]
const alertFields = (type) => (type === 'fund' ? ALERT_FUND_FIELDS : ALERT_STOCK_FIELDS)
const alertFieldLabel = (field, lang) => (field?.i18nKey ? t(lang, field.i18nKey) : field?.label || '')

function loadAlerts() {
  try {
    const list = JSON.parse(localStorage.getItem('alerts') || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function saveAlerts(list) {
  localStorage.setItem('alerts', JSON.stringify(list))
}

// Görünen tabloyu CSV olarak indirir. BOM eklenir ki Excel Türkçe karakterleri
// ve UTF-8'i doğru okusun; alanlar gerektiğinde tırnaklanır.
function downloadCsv(filename, headerRow, dataRows) {
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

// Alarmın güncel ölçüt değeri (hisse puanı anlık hesaplanır, diğerleri okunur)
function alertCurrentValue(alert, stockMap, fundMap) {
  if (alert.type === 'fund') {
    const f = fundMap.get(alert.symbol)
    return f ? f[alert.field] ?? null : null
  }
  const s = stockMap.get(alert.symbol)
  if (!s) return null
  if (alert.field === 'score') {
    const emaPeriods = [9, 21, 50, 200].filter((p) => s[`ema_${p}`] != null)
    return technicalScore(s, emaPeriods)
  }
  return s[alert.field] ?? null
}

function alertIsTriggered(value, alert) {
  if (value == null) return false
  const cur = alert.kind === 'pct' ? value * 100 : value
  return alert.op === 'above' ? cur >= alert.value : cur <= alert.value
}

function formatAlertCurrent(value, kind) {
  if (value == null) return '—'
  if (kind === 'pct') return formatPct(value, 2)
  if (kind === 'price') return formatNum(value, 2)
  return Number.isInteger(value) ? String(value) : formatNum(value, 1)
}

function alertCondText(alert, lang) {
  const field = alertFields(alert.type).find((f) => f.key === alert.field)
  const opWord = t(lang, alert.op === 'above' ? 'alertAbove' : 'alertBelow')
  const val = `${alert.value}${alert.kind === 'pct' ? '%' : ''}`
  return t(lang, 'alertCond', alertFieldLabel(field, lang), opWord, val)
}

/**
 * Alarmlar: hisse/fon için eşik alarmı kurma ve durum takibi. Değerler yüklü
 * tarama/fon verisinden anlık hesaplanır; tetiklenenler tarayıcı bildirimiyle
 * (App'teki genel efekt) haber verir. Alarmlar yalnızca localStorage'da yaşar.
 */
function AlertsView({ evals, stockMap, fundMap, funds, lang, notifyPerm, onEnableNotify, onAdd, onRemove, onOpenStock, onOpenFund }) {
  const [form, setForm] = useState({ type: 'stock', symbol: '', field: 'score', op: 'below', value: '' })
  const [err, setErr] = useState(null)

  const fields = alertFields(form.type)
  const stockCodes = useMemo(
    () => [...stockMap.keys()].filter((s) => s.endsWith('.IS')).map((s) => s.replace('.IS', '')).sort(),
    [stockMap],
  )
  const fundList = funds?.results || []

  function resolveSymbol() {
    const raw = form.symbol.trim().toUpperCase()
    if (!raw) return null
    if (form.type === 'fund') return fundMap.has(raw) ? raw : null
    if (stockMap.has(raw)) return raw
    if (stockMap.has(`${raw}.IS`)) return `${raw}.IS`
    return null
  }

  function submit(e) {
    e.preventDefault()
    const sym = resolveSymbol()
    if (!sym) return setErr(t(lang, 'alertErrSymbol'))
    const val = Number(String(form.value).replace(',', '.'))
    if (!Number.isFinite(val)) return setErr(t(lang, 'alertErrValue'))
    const field = fields.find((f) => f.key === form.field) || fields[0]
    onAdd({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: form.type,
      symbol: sym,
      field: field.key,
      kind: field.kind,
      op: form.op,
      value: val,
    })
    setForm((f) => ({ ...f, symbol: '', value: '' }))
    setErr(null)
  }

  const changeType = (type) =>
    setForm((f) => ({ ...f, type, field: alertFields(type)[0].key, symbol: '' }))

  const notifyBtn =
    notifyPerm === 'granted' ? (
      <span className="alert-notify-on">{t(lang, 'alertNotifyOn')}</span>
    ) : notifyPerm === 'denied' ? (
      <span className="alert-notify-blocked">{t(lang, 'alertNotifyBlocked')}</span>
    ) : notifyPerm === 'unsupported' ? null : (
      <button className="btn" type="button" onClick={onEnableNotify}>
        {t(lang, 'alertEnableNotify')}
      </button>
    )

  return (
    <>
      <div className="status-bar">
        <span>{t(lang, 'alertsIntro')}</span>
        {notifyBtn}
      </div>

      <form className="alert-form" onSubmit={submit}>
        <div className="tabs alert-type">
          <button type="button" className={`tab ${form.type === 'stock' ? 'active' : ''}`} onClick={() => changeType('stock')}>
            {t(lang, 'alertTypeStock')}
          </button>
          <button type="button" className={`tab ${form.type === 'fund' ? 'active' : ''}`} onClick={() => changeType('fund')}>
            {t(lang, 'alertTypeFund')}
          </button>
        </div>
        <input
          className="search-input alert-symbol"
          list="alert-symbol-options"
          placeholder={t(lang, 'alertSymbol')}
          value={form.symbol}
          onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))}
        />
        <datalist id="alert-symbol-options">
          {form.type === 'fund'
            ? fundList.map((f) => (
                <option key={f.symbol} value={f.symbol}>
                  {f.name}
                </option>
              ))
            : stockCodes.map((c) => <option key={c} value={c} />)}
        </datalist>
        <select
          className="search-input alert-select"
          value={form.field}
          onChange={(e) => setForm((f) => ({ ...f, field: e.target.value }))}
        >
          {fields.map((f) => (
            <option key={f.key} value={f.key}>
              {alertFieldLabel(f, lang)}
            </option>
          ))}
        </select>
        <select
          className="search-input alert-select"
          value={form.op}
          onChange={(e) => setForm((f) => ({ ...f, op: e.target.value }))}
        >
          <option value="below">{t(lang, 'alertBelow')}</option>
          <option value="above">{t(lang, 'alertAbove')}</option>
        </select>
        <input
          className="search-input alert-value"
          type="text"
          inputMode="decimal"
          placeholder={t(lang, 'alertValue')}
          value={form.value}
          onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
        />
        <button className="btn primary" type="submit">
          {t(lang, 'alertAdd')}
        </button>
      </form>
      {err && <div className="error-box">{err}</div>}

      {evals.length === 0 ? (
        <div className="empty-box">{t(lang, 'alertEmpty')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="left">{t(lang, 'alertSymbol')}</th>
                <th className="left">{t(lang, 'alertColCond')}</th>
                <th>{t(lang, 'alertColCurrent')}</th>
                <th>{t(lang, 'alertColStatus')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {evals.map((a) => (
                <tr key={a.id} className={a.triggered ? 'alert-hit' : ''}>
                  <td className="symbol-cell">
                    <button
                      className="symbol-btn"
                      type="button"
                      onClick={() => (a.type === 'fund' ? onOpenFund(fundMap.get(a.symbol)) : onOpenStock(a.symbol))}
                      disabled={a.type === 'fund' && !fundMap.get(a.symbol)}
                    >
                      <TickerLogo symbol={a.symbol} />
                      {displaySymbol(a.symbol)}
                    </button>
                  </td>
                  <td className="left">{alertCondText(a, lang)}</td>
                  <td>{a.current == null ? t(lang, 'alertNoData') : formatAlertCurrent(a.current, a.kind)}</td>
                  <td>
                    <span className={`badge ${a.triggered ? 'alert-badge-hit' : 'alert-badge-wait'}`}>
                      {a.triggered ? t(lang, 'alertTriggered') : t(lang, 'alertWaiting')}
                    </span>
                  </td>
                  <td>
                    <button className="star-btn pf-remove" type="button" title={t(lang, 'alertRemove')} onClick={() => onRemove(a.id)}>
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="disclaimer">{t(lang, 'disclaimer')}</p>
    </>
  )
}

/** Rotasyon tablosundaki ufuklar: her biri ilgili zaman diliminin SON mum değişimi. */
const ROTATION_HORIZONS = [
  { key: 'daily', i18nKey: 'rotH1d' },
  { key: 'weekly', i18nKey: 'rotH1w' },
  { key: 'monthly', i18nKey: 'rotH1m' },
]

/** Sektör getirisini (-%8..+%8 bandı) yeşil/kırmızı ısı rengine çevirir. */
function rotationTone(value) {
  if (value == null) return null
  const mag = Math.min(Math.abs(value) / 0.08, 1)
  const alpha = 0.1 + mag * 0.55
  return value >= 0 ? `rgba(22, 163, 74, ${alpha})` : `rgba(220, 38, 38, ${alpha})`
}

/** Sayı dizisinin medyanı (aykırı tek bir hisse sektörü temsil etmesin diye ortalama değil). */
function medianOf(values) {
  const v = values.filter((x) => x != null).sort((a, b) => a - b)
  if (!v.length) return null
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2
}

/**
 * Sektör Rotasyonu: hangi sektör ısınıyor, hangisi soğuyor?
 *
 * Her sektörün getirisi, o sektördeki hisselerin MEDYAN değişimidir — ortalama,
 * tek bir uç hissenin (örn. tavan yapan küçük bir şirket) sektörü olduğundan
 * güçlü göstermesine yol açıyordu. Sinyal yoğunluğu (kaç hisse filtreyi geçiyor)
 * ayrı bir kolonda: getiri geçmişi, sinyal ise şimdiki teknik durumu anlatır.
 */
function SectorRotation({ overviews, market, lang, loading, onNavigate }) {
  const [sortKey, setSortKey] = useState('weekly')

  const rows = useMemo(() => {
    // sektör -> { horizon -> [değişimler] , signals, count }
    const bySector = new Map()
    const ensure = (sec) => {
      if (!bySector.has(sec)) {
        bySector.set(sec, { sector: sec, changes: {}, signals: 0, count: 0 })
      }
      return bySector.get(sec)
    }

    // Tek market: BIST ile S&P'yi aynı sektör medyanında toplamak farklı para birimi
    // ve dinamikleri harmanlayıp yanıltırdı (üstteki market sekmesinden seçilir).
    for (const h of ROTATION_HORIZONS) {
      const payload = overviews?.[h.key]?.[market]
      if (!payload) continue
      const signalSyms = new Set((payload.results || []).map((r) => r.symbol))
      for (const s of payload.stocks || []) {
        if (!s.sector) continue // ETF/emtiada sektör kavramı yok
        const row = ensure(s.sector)
        if (s.change != null) (row.changes[h.key] ||= []).push(s.change)
        // Hisse sayısı ve sinyal yoğunluğu günlük taramadan (tek sayım)
        if (h.key === 'daily') {
          row.count += 1
          if (signalSyms.has(s.symbol)) row.signals += 1
        }
      }
    }

    const out = [...bySector.values()].map((r) => ({
      sector: r.sector,
      count: r.count,
      signals: r.signals,
      signalRate: r.count ? r.signals / r.count : null,
      values: Object.fromEntries(ROTATION_HORIZONS.map((h) => [h.key, medianOf(r.changes[h.key] || [])])),
    }))
    out.sort((a, b) => (b.values[sortKey] ?? -Infinity) - (a.values[sortKey] ?? -Infinity))
    return out
  }, [overviews, market, sortKey])

  // Özet kartları için asgari hisse sayısı: tek-iki hisselik bir "sektör" gerçek bir
  // sektör trendi değildir, onu "öne çıkan" ilan etmek yanıltıcı olurdu. Tablo yine
  // hepsini gösterir (hisse sayısı rozetiyle birlikte).
  const ROTATION_MIN_STOCKS = 3
  const representative = rows.filter((r) => r.count >= ROTATION_MIN_STOCKS && r.values[sortKey] != null)

  if (loading && !rows.length) return <div className="empty-box">{t(lang, 'loading')}</div>
  if (!rows.length) return <div className="empty-box">{t(lang, 'rotEmpty')}</div>

  const leader = representative[0]
  const laggard = representative[representative.length - 1]

  return (
    <>
      <div className="status-bar">
        <span>{t(lang, 'rotIntro')}</span>
      </div>

      <details className="info-panel">
        <summary>{t(lang, 'rotHowTitle')}</summary>
        <div className="info-content">
          <p>{t(lang, 'rotHowBody1')}</p>
          <p>{t(lang, 'rotHowBody2')}</p>
        </div>
      </details>

      {leader && laggard && leader !== laggard && (
        <div className="strat-summary">
          <div className="strat-stat">
            <span className="strat-stat-label">{t(lang, 'rotLeader')}</span>
            <strong className="strat-stat-value rot-stat-name">{sectorLabel(leader.sector, lang)}</strong>
            <span className={`strat-stat-sub pct ${pctTone(leader.values[sortKey])}`}>
              {formatPct(leader.values[sortKey], 1)}
            </span>
          </div>
          <div className="strat-stat">
            <span className="strat-stat-label">{t(lang, 'rotLaggard')}</span>
            <strong className="strat-stat-value rot-stat-name">{sectorLabel(laggard.sector, lang)}</strong>
            <span className={`strat-stat-sub pct ${pctTone(laggard.values[sortKey])}`}>
              {formatPct(laggard.values[sortKey], 1)}
            </span>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="rotation-table">
          <thead>
            <tr>
              <th className="left">{t(lang, 'rotColSector')}</th>
              {ROTATION_HORIZONS.map((h) => (
                <th
                  key={h.key}
                  className={`sortable ${sortKey === h.key ? 'sorted' : ''}`}
                  onClick={() => setSortKey(h.key)}
                  title={t(lang, 'sortHint')}
                >
                  {t(lang, h.i18nKey)}
                  <span className="sort-arrow">{sortKey === h.key ? '▼' : '⇅'}</span>
                </th>
              ))}
              <th title={t(lang, 'rotColSignalsTitle')}>{t(lang, 'rotColSignals')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sector}>
                <td className="left rot-sector">
                  <button className="link-btn" type="button" onClick={() => onNavigate(r.sector)}>
                    {sectorLabel(r.sector, lang)}
                  </button>
                  <span className="rot-count">{r.count}</span>
                </td>
                {ROTATION_HORIZONS.map((h) => (
                  <td
                    key={h.key}
                    className="rot-cell"
                    style={{ background: rotationTone(r.values[h.key]) || undefined }}
                  >
                    <span className={`pct ${pctTone(r.values[h.key])}`}>
                      {formatPct(r.values[h.key], 1)}
                    </span>
                  </td>
                ))}
                <td>
                  <span className="rot-signals">
                    {r.signals}
                    <span className="rot-signal-rate">({formatRate(r.signalRate)})</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="disclaimer">{t(lang, 'disclaimer')}</p>
    </>
  )
}

/**
 * Sinyal Karnesi: "site N hafta önce şu sinyalleri verdi — bugün ne durumdalar?"
 *
 * Backtest geçmişe bakar ve bu yüzden hep "geçmişe uydurdun" şüphesi taşır. Karne
 * bunun panzehiri: her tarama o günün TAZE sinyallerini fiyatıyla mühürler
 * (signal_log.json), burada yalnızca o mühürlü kayıt okunur. Kayıt ileriye doğru
 * dolduğundan geçmişe dönük değiştirilemez.
 */
/** Karne tablosunun sıralanabilir kolonları. */
const SCORECARD_COLUMNS = [
  { key: 'symbol', i18nKey: 'colSymbol', align: 'left' },
  { key: 'day', i18nKey: 'scColDate', align: 'left' },
  { key: 'daysHeld', i18nKey: 'scColElapsed' },
  { key: 'entry', i18nKey: 'scColEntry' },
  { key: 'current', i18nKey: 'scColNow' },
  { key: 'ret', i18nKey: 'scColReturn' },
]

function SignalScorecard({ log, stockMap, lang, loading, onOpenChart }) {
  const [tf, setTf] = useState('weekly')
  const [sort, setSort] = useState({ key: 'day', dir: 'desc' })

  const toggleSort = (key) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'symbol' || key === 'day' ? 'asc' : 'desc' },
    )

  // Mühürlü kayıtları bugünkü fiyatla karşılaştır
  const { rows, stats, firstDay, dayCount, counts } = useMemo(() => {
    const history = log?.history || {}
    const days = Object.keys(history).sort()
    const out = []
    // Sekme rozetleri: her zaman diliminde kaç kayıt var (boş sekmeye tıklamayı önler)
    const perTf = {}
    for (const day of days) {
      for (const e of history[day] || []) {
        perTf[e.tf] = (perTf[e.tf] || 0) + 1
      }
    }
    for (const day of days) {
      for (const e of history[day] || []) {
        if (e.tf !== tf) continue
        const current = stockMap.get(e.s)?.close
        const entry = e.p
        // Fiyatı bilinmeyen (taramadan düşmüş) sembolü karneye katma: eksik veriyi
        // "0 getiri" saymak isabet oranını sessizce şişirirdi.
        if (!(entry > 0) || !(current > 0)) continue
        const ret = current / entry - 1
        // floor: bugün kaydedilen sinyal "0 gün"dür. round kullanıldığında aradan
        // 18 saat geçmiş bir kayıt "1 gün" sayılıp olgunlaşmış gibi görünüyordu.
        const daysHeld = Math.max(
          0,
          Math.floor((Date.now() - Date.parse(`${day}T00:00:00Z`)) / 86400000),
        )
        out.push({ ...e, symbol: e.s, day, entry, current, ret, daysHeld })
      }
    }
    // Sıralama: metin kolonları (sembol, tarih) sözlük sırasına, sayısal olanlar
    // büyüklüğe göre. Eksik değer compareRows'daki gibi yönden bağımsız sona gider.
    const { key, dir } = sort
    out.sort((a, b) => {
      const av = a[key]
      const bv = b[key]
      if (typeof av === 'string' || typeof bv === 'string') {
        const cmp = String(av ?? '').localeCompare(String(bv ?? ''))
        return dir === 'asc' ? cmp : -cmp
      }
      return compareRows(a, b, key, dir)
    })

    // İstatistikler yalnızca üzerinden en az bir gün geçmiş kayıtlardan hesaplanır.
    // Sinyal, mumun kapanışıyla mühürlenir; aynı gün içinde güncel fiyat da o kapanış
    // olduğundan getiri zorunlu olarak 0'dır. Bunları katmak isabet oranını sıfıra
    // çekip "strateji hiç kazandırmadı" gibi okunuyordu — oysa henüz zaman geçmemiştir.
    // Olgunluk takvim gününe göre: kayıt günü bugünden ÖNCEyse olgunlaşmıştır.
    // (Tarama günü UTC yazıldığından karşılaştırma da UTC tarih dizesiyle yapılır.)
    const todayUtc = new Date().toISOString().slice(0, 10)
    const matured = out.filter((r) => r.day < todayUtc)
    const rets = matured.map((r) => r.ret)
    const wins = rets.filter((r) => r > 0).length
    const avg = rets.length ? rets.reduce((s, r) => s + r, 0) / rets.length : null
    const sorted = [...rets].sort((a, b) => a - b)
    const med = sorted.length
      ? sorted.length % 2
        ? sorted[(sorted.length - 1) / 2]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : null
    return {
      rows: out,
      stats: {
        count: rets.length,
        pending: out.length - matured.length, // henüz olgunlaşmamış (aynı gün) kayıtlar
        winRate: rets.length ? wins / rets.length : null,
        avg,
        med,
      },
      firstDay: days[0] || null,
      dayCount: days.length,
      counts: perTf,
    }
  }, [log, stockMap, tf, sort])

  if (loading) return <div className="empty-box">{t(lang, 'loading')}</div>

  return (
    <>
      <div className="status-bar">
        <span>{t(lang, 'scIntro')}</span>
        {firstDay && <span className="bt-period">{t(lang, 'scSince', firstDay, dayCount)}</span>}
      </div>

      <details className="info-panel">
        <summary>{t(lang, 'scHowTitle')}</summary>
        <div className="info-content">
          <p>{t(lang, 'scHowBody1')}</p>
          <p>{t(lang, 'scHowBody2')}</p>
        </div>
      </details>

      {/* Kayıt dört zaman dilimini birden tutar; hepsi görüntülenebilmeli */}
      <div className="tabs" role="group" aria-label={t(lang, 'scTfLabel')}>
        {TIMEFRAMES.map((x) => (
          <button
            key={x.key}
            type="button"
            className={`tab ${tf === x.key ? 'active' : ''}`}
            onClick={() => setTf(x.key)}
          >
            {tfLabel(x, lang)}
            {counts[x.key] > 0 && <span className="sc-tab-count">{counts[x.key]}</span>}
          </button>
        ))}
      </div>

      {!log || rows.length === 0 ? (
        <div className="empty-box">{t(lang, 'scEmpty')}</div>
      ) : (
        <>
          {/* Tüm kayıtlar bugünden ise istatistik yoktur: getiri zorunlu olarak 0 olurdu */}
          {stats.count === 0 ? (
            <div className="empty-box">{t(lang, 'scAllPending', stats.pending)}</div>
          ) : (
            stats.pending > 0 && (
              <p className="sc-pending-note">{t(lang, 'scPendingNote', stats.pending)}</p>
            )
          )}
          {stats.count > 0 && (
          <div className="strat-summary">
            <div className="strat-stat">
              <span className="strat-stat-label">{t(lang, 'scCount')}</span>
              <strong className="strat-stat-value">{stats.count}</strong>
              <span className="strat-stat-sub">{t(lang, 'scCountSub')}</span>
            </div>
            <div className="strat-stat">
              <span className="strat-stat-label">{t(lang, 'scWinRate')}</span>
              <strong className="strat-stat-value">{formatRate(stats.winRate)}</strong>
              <span className="strat-stat-sub">{t(lang, 'scWinRateSub')}</span>
            </div>
            <div className="strat-stat">
              <span className="strat-stat-label">{t(lang, 'scAvg')}</span>
              <strong className={`strat-stat-value pct ${pctTone(stats.avg)}`}>
                {formatPct(stats.avg, 1)}
              </strong>
              <span className="strat-stat-sub">{t(lang, 'scMedian', formatPct(stats.med, 1))}</span>
            </div>
          </div>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {SCORECARD_COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      className={`sortable ${c.align === 'left' ? 'left' : ''} ${sort.key === c.key ? 'sorted' : ''}`}
                      onClick={() => toggleSort(c.key)}
                      title={t(lang, 'sortHint')}
                    >
                      {t(lang, c.i18nKey)}
                      <span className="sort-arrow">
                        {sort.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.day}-${r.s}-${i}`}>
                    <td className="symbol-cell">
                      <button className="symbol-btn" type="button" onClick={() => onOpenChart(r.s)}>
                        <TickerLogo symbol={r.s} />
                        {displaySymbol(r.s)}
                      </button>
                    </td>
                    <td className="left">{r.day}</td>
                    <td>{t(lang, 'scDaysN', r.daysHeld)}</td>
                    <td>{formatNum(r.entry, 2)}</td>
                    <td>{formatNum(r.current, 2)}</td>
                    <td className={`pct ${pctTone(r.ret)}`}>{formatPct(r.ret, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="disclaimer">{t(lang, 'disclaimer')}</p>
    </>
  )
}

/**
 * Strateji Takip: "haftalık taze sinyalleri al, en fazla N pozisyon, H hafta tut, sat"
 * stratejisini yönetmek için. Backtest'in kuralını gerçek hayatta uygulamak elle
 * takip gerektiriyordu (hangi pozisyon kaç hafta doldu, slot boş mu, yeni sinyal var mı).
 * Bu sekme onu üstlenir. Pozisyonlar yalnızca localStorage'da — sunucuya gitmez.
 */
function StrategyTracker({
  signals,
  signalsLoading,
  lang,
  notifyPerm,
  stockPrices,
  stockMap,
  onEnableNotify,
  onOpenChart,
}) {
  const [allPositions, setAllPositions] = useState(loadStrategyPositions)
  const [settings, setSettings] = useState(loadStrategySettings)
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10))
  // BIST ve ABD ayrı stratejilerdir: farklı para birimi, farklı seans, farklı
  // dinamik. Slot bütçesi ve çeşitlilik ölçüsü de bu yüzden market başına tutulur —
  // 10 BIST + 10 ABD pozisyonunu tek havuzda saymak ikisini de yanlış gösterirdi.
  const [scope, setScope] = useState('bist')

  const inScope = (symbol) => (scope === 'bist' ? isBistSymbol(symbol) : !isBistSymbol(symbol))
  const positions = useMemo(
    () => allPositions.filter((p) => inScope(p.symbol)),
    [allPositions, scope],
  )

  const notifyBtn =
    notifyPerm === 'granted' ? (
      <span className="alert-notify-on">{t(lang, 'alertNotifyOn')}</span>
    ) : notifyPerm === 'denied' ? (
      <span className="alert-notify-blocked">{t(lang, 'alertNotifyBlocked')}</span>
    ) : notifyPerm === 'unsupported' ? null : (
      <button className="btn" type="button" onClick={onEnableNotify}>
        {t(lang, 'alertEnableNotify')}
      </button>
    )

  // Kayıt her zaman TÜM pozisyonlar üzerinden yapılır; ekranda yalnızca seçili
  // marketinkiler görünse de diğer marketin pozisyonları silinmemelidir.
  const update = (nextAll) => {
    setAllPositions(nextAll)
    saveStrategyPositions(nextAll)
  }
  const patchSettings = (patch) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveStrategySettings(next)
  }

  const held = new Set(allPositions.map((p) => p.symbol))

  const addPosition = (symbol, market) => {
    if (held.has(symbol)) return
    update([
      ...allPositions,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, symbol, market, entryDate },
    ])
  }
  const removePosition = (id) => update(allPositions.filter((p) => p.id !== id))

  // Her pozisyon için: kaç hafta doldu, kaç hafta kaldı, durumu
  const rows = useMemo(() => {
    return positions
      .map((p) => {
        const weeksHeld = weeksSince(p.entryDate)
        const weeksLeft = settings.holdWeeks - weeksHeld
        const status = weeksLeft <= 0 ? 'due' : weeksLeft <= 1 ? 'soon' : 'holding'
        return { ...p, weeksHeld, weeksLeft, status }
      })
      .sort((a, b) => a.weeksLeft - b.weeksLeft)
  }, [positions, settings.holdWeeks])

  const dueCount = rows.filter((r) => r.status === 'due').length
  const freeSlots = Math.max(0, settings.maxPositions - positions.length)

  // Çeşitlilik: 10 pozisyon kuralı ancak pozisyonlar farklı şeylere bahis oynuyorsa
  // risk dağıtır; hepsi birlikte hareket ediyorsa tek bahsin 10 katıdır.
  const diversification = useMemo(
    () =>
      diversificationOf(
        positions.map((p) => p.symbol),
        (s) => stockPrices?.series?.[s],
        (s) => stockMap?.get(s)?.sector,
      ),
    [positions, stockPrices, stockMap],
  )

  // Taze haftalık sinyaller: seçili marketten ve henüz portföyde olmayanlar
  const freshAvailable = useMemo(
    () => (signals || []).filter((s) => !held.has(s.symbol) && inScope(s.symbol)),
    [signals, positions, scope],
  )

  return (
    <>
      <div className="status-bar">
        <span>{t(lang, 'stratIntro')}</span>
        {notifyBtn}
      </div>

      {/* BIST / ABD: ayrı stratejiler, ayrı slot bütçesi */}
      <div className="tabs strat-scope-tabs" role="group" aria-label={t(lang, 'stratScopeLabel')}>
        {[
          { key: 'bist', i18nKey: 'stratScopeBist' },
          { key: 'global', i18nKey: 'stratScopeGlobal' },
        ].map((s) => (
          <button
            key={s.key}
            type="button"
            className={`tab ${scope === s.key ? 'active' : ''}`}
            onClick={() => setScope(s.key)}
          >
            {t(lang, s.i18nKey)}
            <span className="sc-tab-count">
              {allPositions.filter((p) => (s.key === 'bist' ? isBistSymbol(p.symbol) : !isBistSymbol(p.symbol))).length}
            </span>
          </button>
        ))}
      </div>

      <details className="info-panel">
        <summary>{t(lang, 'stratHowTitle')}</summary>
        <div className="info-content">
          <p>{t(lang, 'stratHowBody1')}</p>
          <p>{t(lang, 'stratHowBody2')}</p>
          <p>{t(lang, 'stratHowBody3')}</p>
        </div>
      </details>

      {/* Kapasite / süre ayarları */}
      <div className="strat-settings">
        <label className="strat-setting">
          <span>{t(lang, 'stratMaxPositions')}</span>
          <input
            type="number"
            min="1"
            max="50"
            value={settings.maxPositions}
            onChange={(e) => patchSettings({ maxPositions: Math.max(1, Number(e.target.value) || 1) })}
          />
        </label>
        <label className="strat-setting">
          <span>{t(lang, 'stratHoldWeeks')}</span>
          <input
            type="number"
            min="1"
            max="104"
            value={settings.holdWeeks}
            onChange={(e) => patchSettings({ holdWeeks: Math.max(1, Number(e.target.value) || 1) })}
          />
        </label>
      </div>

      {/* Özet kartları: slot doluluğu + bu hafta satılacaklar */}
      <div className="strat-summary">
        <div className="strat-stat">
          <span className="strat-stat-label">{t(lang, 'stratSlots')}</span>
          <strong className="strat-stat-value">
            {positions.length} / {settings.maxPositions}
          </strong>
          <span className="strat-stat-sub">{t(lang, 'stratFreeSlots', freeSlots)}</span>
        </div>
        <div className={`strat-stat ${dueCount ? 'strat-stat-due' : ''}`}>
          <span className="strat-stat-label">{t(lang, 'stratDueTitle')}</span>
          <strong className="strat-stat-value">{dueCount}</strong>
          <span className="strat-stat-sub">{t(lang, 'stratDueSub')}</span>
        </div>
      </div>

      {/* Çeşitlilik uyarısı: pozisyonlar aynı bahsin kopyasıysa 10 slot risk dağıtmaz */}
      {diversification && (
        <div className={`div-panel div-${diversification.level}`}>
          <div className="div-head">
            <strong>{t(lang, 'divTitle')}</strong>
            <span className={`badge div-badge-${diversification.level}`}>
              {t(lang, `divLevel_${diversification.level}`)}
            </span>
          </div>
          <div className="div-metrics">
            <span>
              {t(lang, 'divAvgCorr')}:{' '}
              <strong>
                {diversification.avgCorr == null
                  ? t(lang, 'divNoData')
                  : diversification.avgCorr.toFixed(2)}
              </strong>
            </span>
            {diversification.topSector && (
              <span>
                {t(lang, 'divTopSector')}:{' '}
                <strong>
                  {sectorLabel(diversification.topSector, lang)} ({diversification.topCount}/
                  {positions.length})
                </strong>
              </span>
            )}
          </div>
          <p className="div-note">{t(lang, `divNote_${diversification.level}`)}</p>
        </div>
      )}

      {/* Açık pozisyonlar */}
      {rows.length === 0 ? (
        <div className="empty-box">{t(lang, 'stratEmpty')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="left">{t(lang, 'colSymbol')}</th>
                <th className="left">{t(lang, 'stratColEntry')}</th>
                <th>{t(lang, 'stratColHeld')}</th>
                <th>{t(lang, 'stratColLeft')}</th>
                <th>{t(lang, 'stratColStatus')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.status === 'due' ? 'strat-row-due' : ''}>
                  <td className="symbol-cell">
                    <button className="symbol-btn" type="button" onClick={() => onOpenChart(r.symbol)}>
                      <TickerLogo symbol={r.symbol} />
                      {displaySymbol(r.symbol)}
                    </button>
                  </td>
                  <td className="left">{r.entryDate}</td>
                  <td>{t(lang, 'stratWeeksN', r.weeksHeld)}</td>
                  <td>
                    <div className="strat-progress" title={t(lang, 'stratWeeksN', Math.max(0, r.weeksLeft))}>
                      <div
                        className={`strat-progress-fill ${r.status}`}
                        style={{ width: `${Math.min(100, (r.weeksHeld / settings.holdWeeks) * 100)}%` }}
                      />
                    </div>
                  </td>
                  <td>
                    <span className={`badge strat-badge-${r.status}`}>
                      {r.status === 'due'
                        ? t(lang, 'stratSellNow')
                        : r.status === 'soon'
                          ? t(lang, 'stratSoon')
                          : t(lang, 'stratWeeksLeft', r.weeksLeft)}
                    </span>
                  </td>
                  <td>
                    <button
                      className="star-btn pf-remove"
                      type="button"
                      title={t(lang, 'stratRemove')}
                      onClick={() => removePosition(r.id)}
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Taze haftalık sinyaller: boş slot varsa doldurma önerisi */}
      <section className="strat-signals">
        <h3 className="strat-signals-title">
          {t(lang, 'stratFreshTitle')}
          <span className="news-group-count">{freshAvailable.length}</span>
        </h3>
        <div className="strat-signals-entry">
          <label>
            {t(lang, 'stratEntryDate')}
            <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </label>
        </div>
        {signalsLoading ? (
          <div className="empty-box">{t(lang, 'loading')}</div>
        ) : freshAvailable.length === 0 ? (
          <div className="empty-box">{t(lang, 'stratNoFresh')}</div>
        ) : (
          <div className="strat-chips">
            {freshAvailable.map((s) => (
              <div key={s.symbol} className="strat-chip">
                <button className="symbol-btn" type="button" onClick={() => onOpenChart(s.symbol)}>
                  <TickerLogo symbol={s.symbol} />
                  {displaySymbol(s.symbol)}
                </button>
                <button
                  className="btn small"
                  type="button"
                  disabled={freeSlots <= 0}
                  title={freeSlots <= 0 ? t(lang, 'stratNoSlot') : t(lang, 'stratAdd')}
                  onClick={() => addPosition(s.symbol, s.market)}
                >
                  + {t(lang, 'stratAdd')}
                </button>
              </div>
            ))}
          </div>
        )}
        {freeSlots <= 0 && freshAvailable.length > 0 && (
          <p className="strat-full-note">{t(lang, 'stratFullNote')}</p>
        )}
      </section>

      <p className="disclaimer">{t(lang, 'disclaimer')}</p>
    </>
  )
}

/* ---------------------------- Makro Panel ----------------------------
 * Kur / faiz / emtia / endeks kartları. Her kart: son değer, seçilen dönemin
 * değişimi, 1 yıllık mini grafik ve BIST ile getiri korelasyonu.
 * Veri app/data/macro.py'den gelir; burada yalnızca sunum yapılır. */

const MACRO_PERIODS = [
  { key: 'change_1d', i18nKey: 'macro1d' },
  { key: 'change_1w', i18nKey: 'macro1w' },
  { key: 'change_1m', i18nKey: 'macro1m' },
  { key: 'change_3m', i18nKey: 'macro3m' },
  { key: 'ytd', i18nKey: 'macroYtd' },
  { key: 'change_1y', i18nKey: 'macro1y' },
]

const MACRO_GROUP_LABELS = {
  fx: 'macroGroupFx',
  index: 'macroGroupIndex',
  rate: 'macroGroupRate',
  commodity: 'macroGroupCommodity',
  crypto: 'macroGroupCrypto',
}

/** Korelasyon rengi: güçlü ilişki (±0,5 üstü) vurgulanır, zayıfı nötr kalır. */
function corrTone(value) {
  if (value == null) return ''
  if (value >= 0.5) return 'pos'
  if (value <= -0.5) return 'neg'
  return ''
}

function MacroView({ data, loading, lang }) {
  // Kartların üstündeki dönem anahtarı: "her yüzde dönemini taşır" kuralının
  // panel karşılığı — hangi dönemin gösterildiği tek yerden, açıkça seçilir.
  const [period, setPeriod] = useState('change_1d')

  const groups = useMemo(() => {
    const items = data?.items || []
    const order = ['fx', 'index', 'rate', 'commodity', 'crypto']
    return order
      .map((g) => ({ group: g, items: items.filter((i) => i.group === g) }))
      .filter((g) => g.items.length > 0)
  }, [data])

  const periodLabel = t(lang, MACRO_PERIODS.find((p) => p.key === period)?.i18nKey || 'macro1d')

  if (loading && !data) return <div className="loading-box">{t(lang, 'loading')}</div>
  if (!data || !data.items?.length) return <div className="empty-box">{t(lang, 'macroEmpty')}</div>

  return (
    <>
      <section className="today-section">
        <h2 className="today-title">{t(lang, 'macroTitle')}</h2>
        <p className="today-note">{t(lang, 'macroIntro')}</p>

        <ShareBar
          lang={lang}
          csv={{
            filename: 'makro.csv',
            header: ['Gösterge', 'Son', '1g %', '1h %', '1a %', '3a %', 'YBB %', '1y %', 'BIST korelasyon'],
            rows: () =>
              (data.items || []).map((i) => [
                lang === 'en' ? i.name_en : i.name,
                i.last,
                ...['change_1d', 'change_1w', 'change_1m', 'change_3m', 'ytd', 'change_1y'].map((k) =>
                  i[k] == null ? '' : (i[k] * 100).toFixed(2),
                ),
                i.corr_bist ?? '',
              ]),
          }}
          card={{
            title: t(lang, 'macroTitle'),
            subtitle: periodLabel,
            filename: `makro-${new Date().toISOString().slice(0, 10)}.png`,
            rows: (data.items || []).slice(0, SHARE_CARD_ROWS).map((i) => ({
              label: lang === 'en' ? i.name_en : i.name,
              value: i[period] == null ? '—' : formatPct(i[period], 2),
              tone: pctTone(i[period]),
            })),
          }}
          shareText={t(lang, 'macroShareText', periodLabel)}
        />
        <div className="macro-periods" role="group" aria-label={t(lang, 'macroTitle')}>
          {MACRO_PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`chip ${period === p.key ? 'active' : ''}`}
              onClick={() => setPeriod(p.key)}
            >
              {t(lang, p.i18nKey)}
            </button>
          ))}
        </div>

        {groups.map(({ group, items }) => (
          <div key={group} className="macro-group">
            <h3 className="macro-group-title">{t(lang, MACRO_GROUP_LABELS[group] || 'macroGroupIndex')}</h3>
            <div className="macro-grid">
              {items.map((item) => {
                const change = item[period]
                return (
                  <article key={item.key} className="macro-card">
                    <header className="macro-card-head">
                      <span className="macro-name">
                        {lang === 'en' ? item.name_en : item.name}
                        {item.derived && (
                          <span className="macro-derived" title={t(lang, 'macroDerivedHint')}>
                            {t(lang, 'macroDerived')}
                          </span>
                        )}
                        {/* Rate-limit yüzünden bu koşuda çekilemeyen gösterge, önceki
                            yayından tamamlanır. Etiketsiz göstermek kullanıcıya bugünün
                            rakamı sanmasına yol açardı. */}
                        {item.stale && (
                          <span
                            className="macro-stale"
                            title={t(
                              lang,
                              'macroStaleHint',
                              item.as_of ? new Date(item.as_of).toLocaleDateString(lang === 'en' ? 'en-US' : 'tr-TR') : '—',
                            )}
                          >
                            {t(lang, 'macroStale')}
                          </span>
                        )}
                      </span>
                      <span className={`pct ${pctTone(change)}`}>
                        {change == null ? '—' : formatPct(change, 2)}
                        <span className="macro-period-tag">{periodLabel}</span>
                      </span>
                    </header>
                    <div className="macro-value">
                      {formatNum(item.last, item.last >= 1000 ? 0 : 2)}
                      {item.unit && <span className="macro-unit">{item.unit}</span>}
                    </div>
                    <Sparkline points={item.series} days={365} />
                    {item.corr_bist != null && (
                      <div className="macro-corr" title={t(lang, 'macroCorr', data.correlation_bars)}>
                        <span className="macro-corr-label">{t(lang, 'macroCorrShort')}</span>
                        <span className={`macro-corr-value ${corrTone(item.corr_bist)}`}>
                          {formatNum(item.corr_bist, 2)}
                        </span>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          </div>
        ))}
      </section>

      <details className="info-panel">
        <summary>{t(lang, 'macroCorrHelpTitle')}</summary>
        <p>{t(lang, 'macroCorrHelpBody')}</p>
      </details>

      <p className="disclaimer">{t(lang, 'disclaimer')}</p>
    </>
  )
}

/* -------------------------- Temettü Takvimi --------------------------
 * Verim = son 12 ayda ödenen toplam ÷ güncel fiyat (app/data/dividends.py).
 * Satır açıldığında ödemelerin kendisi gösterilir: rakamın doğrulanabilir
 * olması, hazır bir "verim" alanını olduğu gibi basmaktan daha değerli. */

// Yaklaşan temettü şeridinde en fazla bu kadar kart gösterilir. Canlıda ölçüldü:
// 99 yaklaşan ödeme yatay bir kaydırma canavarına dönüşüyordu; şerit "sıradaki
// birkaç tarih" içindir, tam liste zaten aşağıdaki tabloda.
const DIVIDEND_UPCOMING_LIMIT = 20

function DividendsView({ data, loading, lang, onOpenChart }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(() => new Set())
  const locale = lang === 'en' ? 'en-US' : 'tr-TR'

  // BIST / Global ayrımı — haber akışıyla aynı sebep: taranan hisselerin çoğu ABD
  // (S&P 500: 409, BIST: 61) olduğundan tek liste, BIST yatırımcısını kendi
  // hisselerini bulamadığı bir ABD akışında bırakıyordu. Seçim hatırlanır.
  const [scope, setScopeState] = useState(() => {
    const saved = localStorage.getItem('dividends_scope')
    return saved === 'global' || saved === 'bist' ? saved : 'bist'
  })
  const setScope = (next) => {
    setScopeState(next)
    localStorage.setItem('dividends_scope', next)
  }

  const scoped = useMemo(
    () => (data?.items || []).filter((i) => (scope === 'bist') === isBistSymbol(i.symbol)),
    [data, scope],
  )

  const items = useMemo(() => {
    const q = query.trim().toUpperCase()
    return q ? scoped.filter((r) => r.symbol.toUpperCase().includes(q)) : scoped
  }, [scoped, query])

  const upcoming = useMemo(
    () =>
      scoped
        .filter((i) => i.next_ex_date)
        .sort((a, b) => a.next_ex_date.localeCompare(b.next_ex_date)),
    [scoped],
  )

  const toggle = (symbol) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(symbol)) next.delete(symbol)
      else next.add(symbol)
      return next
    })

  if (loading && !data) return <div className="loading-box">{t(lang, 'loading')}</div>
  if (!data || !data.items?.length) return <div className="empty-box">{t(lang, 'dvdEmpty')}</div>

  return (
    <>
      <section className="today-section">
        <h2 className="today-title">{t(lang, 'dvdTitle')}</h2>
        <p className="today-note">{t(lang, 'dvdIntro')}</p>

        <div className="tabs news-scope-tabs" role="group" aria-label={t(lang, 'dvdTitle')}>
          {[
            { key: 'bist', i18nKey: 'todayScopeBist' },
            { key: 'global', i18nKey: 'todayScopeGlobal' },
          ].map((sc) => (
            <button
              key={sc.key}
              type="button"
              className={`tab ${scope === sc.key ? 'active' : ''}`}
              onClick={() => setScope(sc.key)}
            >
              {t(lang, sc.i18nKey)}
            </button>
          ))}
        </div>

        <h3 className="div-sub">{t(lang, 'dvdUpcoming')}</h3>
        <p className="today-note">{t(lang, 'dvdUpcomingHint', 90)}</p>
        {upcoming.length === 0 ? (
          <p className="flow-empty">{t(lang, 'dvdNoUpcoming')}</p>
        ) : (
          <div className="div-upcoming">
            {upcoming.slice(0, DIVIDEND_UPCOMING_LIMIT).map((i) => (
              <button key={i.symbol} type="button" className="div-up-card" onClick={() => onOpenChart(i.symbol)}>
                <TickerLogo symbol={i.symbol} />
                <span className="div-up-code">{displaySymbol(i.symbol)}</span>
                <span className="div-up-date">{new Date(i.next_ex_date).toLocaleDateString(locale)}</span>
                <span className="div-up-days">{t(lang, 'dvdDays', i.days_to_ex)}</span>
              </button>
            ))}
            {upcoming.length > DIVIDEND_UPCOMING_LIMIT && (
              <span className="div-up-more">
                {t(lang, 'dvdUpcomingMore', upcoming.length - DIVIDEND_UPCOMING_LIMIT)}
              </span>
            )}
          </div>
        )}
      </section>

      <section className="today-section">
        <ShareBar
          lang={lang}
          csv={{
            filename: `temettu-${scope}.csv`,
            header: [
              t(lang, 'dvdColSymbol'),
              t(lang, 'dvdColYield'),
              t(lang, 'dvdColTtm'),
              t(lang, 'dvdColLast'),
              t(lang, 'dvdColNext'),
              t(lang, 'dvdColPayout'),
              t(lang, 'dvdColYears'),
            ],
            rows: () =>
              items.map((i) => [
                displaySymbol(i.symbol),
                i.yield_ttm == null ? '' : (i.yield_ttm * 100).toFixed(2),
                i.ttm ?? '',
                i.last_date || '',
                i.next_ex_date || '',
                i.payout_ratio == null ? '' : (i.payout_ratio * 100).toFixed(0),
                i.years_paid,
              ]),
          }}
          card={{
            title: t(lang, 'dvdTitle'),
            subtitle: t(lang, 'dvdColYield'),
            filename: `temettu-${scope}-${new Date().toISOString().slice(0, 10)}.png`,
            rows: items
              .filter((i) => i.yield_ttm != null)
              .slice(0, SHARE_CARD_ROWS)
              .map((i) => ({
                label: displaySymbol(i.symbol),
                value: formatRatioPct(i.yield_ttm, 2),
                tone: 'pos',
              })),
          }}
          shareText={t(lang, 'dvdShareText', items.filter((i) => i.yield_ttm != null).length)}
        />
        <div className="div-toolbar">
          {/* Sayaç seçili kapsamı anlatmalı: toplam sayı, ekranda görülenle
              uyuşmayınca "hani nerede?" sorusunu doğuruyordu. */}
          <span className="div-count">{t(lang, 'dvdCount', scoped.length, upcoming.length)}</span>
          <input
            className="search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(lang, 'dvdSearch')}
            aria-label={t(lang, 'dvdSearch')}
          />
        </div>

        <div className="table-wrap">
          <table className="results div-table">
            <thead>
              <tr>
                <th>{t(lang, 'dvdColSymbol')}</th>
                <th>{t(lang, 'dvdColYield')}</th>
                <th>{t(lang, 'dvdColTtm')}</th>
                <th>{t(lang, 'dvdColLast')}</th>
                <th>{t(lang, 'dvdColNext')}</th>
                <th>{t(lang, 'dvdColPayout')}</th>
                <th>{t(lang, 'dvdColYears')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                // Satır + açılır detay iki <tr> olduğundan Fragment şart (tablo
                // yapısı bozulmasın); key kısa sözdiziminde verilemez.
                <Fragment key={i.symbol}>
                  <tr className="div-row" onClick={() => toggle(i.symbol)}>
                    <td>
                      <span className="cell-symbol">
                        <TickerLogo symbol={i.symbol} />
                        <button
                          type="button"
                          className="link-symbol"
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenChart(i.symbol)
                          }}
                        >
                          {displaySymbol(i.symbol)}
                        </button>
                      </span>
                    </td>
                    <td className={`pct ${i.yield_ttm ? 'pos' : ''}`}>
                      {i.yield_ttm == null ? <span className="muted">{t(lang, 'dvdYieldNone')}</span> : formatRatioPct(i.yield_ttm, 2)}
                    </td>
                    <td>{i.ttm == null ? '—' : formatNum(i.ttm, 2)}</td>
                    <td>{i.last_date ? new Date(i.last_date).toLocaleDateString(locale) : '—'}</td>
                    <td>
                      {i.next_ex_date ? (
                        <span className="div-next">
                          {new Date(i.next_ex_date).toLocaleDateString(locale)}
                          <span className="div-next-days">{t(lang, 'dvdDays', i.days_to_ex)}</span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{i.payout_ratio == null ? '—' : formatRatioPct(i.payout_ratio, 0)}</td>
                    <td>{i.years_paid}</td>
                  </tr>
                  {open.has(i.symbol) && (
                    <tr className="div-detail-row">
                      <td colSpan={7}>
                        <div className="div-detail">
                          <div>
                            <span className="sd-block-title">{t(lang, 'dvdByYear')}</span>
                            <div className="div-years">
                              {Object.entries(i.by_year || {}).map(([year, total]) => (
                                <span key={year} className="div-year">
                                  <strong>{year}</strong> {formatNum(total, 2)}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="sd-block-title">{t(lang, 'dvdPayments')}</span>
                            <div className="div-payments">
                              {(i.payments || []).slice(-8).reverse().map(([day, amount]) => (
                                <span key={day} className="div-payment">
                                  {new Date(day).toLocaleDateString(locale)} · {formatNum(amount, 4)}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="today-note">{t(lang, 'dvdNote')}</p>
      </section>

      <details className="info-panel">
        <summary>{t(lang, 'dvdWhatTitle')}</summary>
        <p>{t(lang, 'dvdWhatBody')}</p>
      </details>

      <p className="disclaimer">{t(lang, 'disclaimer')}</p>
    </>
  )
}

/* ------------------------ Derin bağlantı (URL durumu) ------------------------
 * Uygulamanın hiç URL durumu yoktu: paylaşılan her bağlantı karşı tarafı "Bugün"
 * sayfasına düşürüyordu ve hiçbir ekran yer imine eklenemiyordu. Artık görünüm,
 * market, zaman dilimi ve açık hisse adres çubuğuna yazılır.
 *
 * `replaceState` kullanılır, `pushState` DEĞİL: her sekme değişimi için geri
 * tuşuna bir adım eklemek, tarayıcıdan çıkmayı imkânsız hale getirirdi. */

const URL_KEYS = { view: 'v', market: 'm', timeframe: 'tf', symbol: 's' }

// Market/zaman dilimi seçicileri yalnızca bu sekmelerde görünür (bkz. content-head);
// bağlantıya da yalnızca burada yazılırlar ki URL ekranda olmayan bir seçim iddia etmesin.
const MARKET_AWARE_VIEWS = new Set(['screener', 'backtest', 'map', 'bubbles', 'rotation'])
const TIMEFRAME_AWARE_VIEWS = new Set(['screener', 'backtest'])

function readUrlState() {
  try {
    const params = new URLSearchParams(window.location.search)
    const get = (key) => params.get(key) || null
    return {
      view: get(URL_KEYS.view),
      market: get(URL_KEYS.market),
      timeframe: get(URL_KEYS.timeframe),
      symbol: get(URL_KEYS.symbol),
      watch: get('w'),
    }
  } catch {
    return {}
  }
}

/** Favori listesi paylaşım bağlantısı: `w=HISSE1,HISSE2|FON1,FON2` */
function encodeWatchParam(stocks, funds) {
  return `${(stocks || []).join(',')}|${(funds || []).join(',')}`
}

function decodeWatchParam(value) {
  const [stocks = '', funds = ''] = String(value || '').split('|')
  const clean = (s) =>
    s
      .split(',')
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 100) // bağlantıdan gelen liste sınırsız büyümesin
  return { stocks: clean(stocks), funds: clean(funds) }
}

function App() {
  const [lang, setLangState] = useState(getLang)

  // <html lang> arayüz diliyle senkron kalmalı: CSS'in text-transform: uppercase
  // kuralı dile duyarlıdır ve Türkçede "i" → "İ" olur. Yanlış dilde "eşikleri"
  // ekranda "EŞIKLERI" diye çıkıyordu. Ekran okuyucu ve arama motorları da bunu okur.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  // Paylaşılan bağlantıdaki durum. Yalnızca AÇILIŞTA okunur: sonrasında adres
  // çubuğunu uygulama yazar, tersi yönde dinlemek döngü yaratırdı.
  const [initialUrl] = useState(readUrlState)

  // Açılışta ham tablo yerine günün özeti karşılasın; bağlantı bir sekme
  // belirtiyorsa (ve o sekme gerçekten varsa) onunla açılır.
  const [view, setView] = useState(() =>
    NAV_ITEMS.some((i) => i.key === initialUrl.view) ? initialUrl.view : 'today',
  )
  const [market, setMarket] = useState(() =>
    MARKETS.some((m) => m.key === initialUrl.market) ? initialUrl.market : 'bist100',
  )
  const [timeframe, setTimeframe] = useState(() =>
    TIMEFRAMES.some((tf) => tf.key === initialUrl.timeframe) ? initialUrl.timeframe : 'daily',
  )
  const [watchlist, setWatchlist] = useState(loadWatchlist)
  const [onlyWatchlist, setOnlyWatchlist] = useState(false)
  // Filtreleri yok sayıp taranan tüm hisseleri (örn. BIST 100'ün tamamı) listele
  const [showAllStocks, setShowAllStocks] = useState(false)
  // Yalnızca bu mumda sinyal veren (taze) hisseleri göster
  const [onlyNew, setOnlyNew] = useState(false)
  const [fundWatchlist, setFundWatchlist] = useState(loadFundWatchlist)
  const [onlyFundWatchlist, setOnlyFundWatchlist] = useState(false)
  const [fundFlows, setFundFlows] = useState(null)
  const [fundFlowsReady, setFundFlowsReady] = useState(false)
  const [scoreHistory, setScoreHistory] = useState(null)
  const [scoreHistoryReady, setScoreHistoryReady] = useState(false)
  // Temettü ve makro veriler ilgili sekme (ya da hisse detayı) açılınca lazily yüklenir;
  // `*Ready` bayrağı "istek tamamlandı" demektir: dosya yoksa (null) tekrar denenmesin.
  const [dividends, setDividends] = useState(null)
  const [dividendsReady, setDividendsReady] = useState(false)
  const [dividendsLoading, setDividendsLoading] = useState(false)
  const [macro, setMacro] = useState(null)
  const [macroReady, setMacroReady] = useState(false)
  const [macroLoading, setMacroLoading] = useState(false)
  const [stockPrices, setStockPrices] = useState(null)
  const [stockPricesReady, setStockPricesReady] = useState(false)
  // Döviz/altın serileri (TL / $ / gram altın anahtarı)
  const [fx, setFx] = useState(null)
  const [fxReady, setFxReady] = useState(false)
  // Sinyal karnesi arşivi (mühürlü geçmiş sinyaller)
  const [signalLog, setSignalLog] = useState(null)
  const [signalLogLoading, setSignalLogLoading] = useState(false)
  const [signalLogReady, setSignalLogReady] = useState(false)
  const [stockPricesLoading, setStockPricesLoading] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS, emas: { ...DEFAULT_FILTERS.emas } })
  const [sort, setSort] = useState({ key: 'score', dir: 'desc' })
  const [search, setSearch] = useState('')
  // Bağlantıda hisse varsa detay penceresi doğrudan açık gelir ("şu hisseye bak" paylaşımı)
  const [chartSymbol, setChartSymbol] = useState(() => initialUrl.symbol || null)
  const [chartFund, setChartFund] = useState(null)
  const [news, setNews] = useState(null)
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsError, setNewsError] = useState(null)
  const [funds, setFunds] = useState(null)
  const [fundsLoading, setFundsLoading] = useState(false)
  const [fundsError, setFundsError] = useState(null)
  const [fundPrices, setFundPrices] = useState(null)
  const [fundPricesReady, setFundPricesReady] = useState(false)
  const [fundPricesLoading, setFundPricesLoading] = useState(false)
  const [stockPositions, setStockPositions] = useState(null)
  const [stockPositionsLoading, setStockPositionsLoading] = useState(false)
  const [stockPositionsError, setStockPositionsError] = useState(null)
  const [compareSeed, setCompareSeed] = useState([])
  const [fundSort, setFundSort] = useState({ key: 'score', dir: 'desc' })
  const [fundSearch, setFundSearch] = useState('')
  const [backtest, setBacktest] = useState(null)
  const [backtestLoading, setBacktestLoading] = useState(false)
  const [backtestError, setBacktestError] = useState(null)
  const [overviewCache, setOverviewCache] = useState({})
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [overviewError, setOverviewError] = useState(null)
  // Strateji Takip + yeni-sinyal bildirimi için haftalık sinyal özeti (tüm marketler)
  const [weeklySignals, setWeeklySignals] = useState(null)
  const [weeklySignalsLoading, setWeeklySignalsLoading] = useState(false)
  const [todayTimeframe, setTodayTimeframe] = useState('daily')
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setThemeState] = useState(loadTheme)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [alerts, setAlerts] = useState(loadAlerts)
  const [notifyPerm, setNotifyPerm] = useState(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )
  const [enabledMarketKeys, setEnabledMarketKeys] = useState(null)
  // Manifest çözülene kadar market listesi bilinmez. Bunu beklemeden veri çekersek
  // kapalı marketlerin dosyalarını isteyip 404 alırız (ve sekmeleri kısa süre gösteririz).
  const [marketsResolved, setMarketsResolved] = useState(false)

  // Etkin marketler backend'den gelir (markets.json); manifest okunamazsa config
  // varsayılanıyla aynı liste kullanılır (etf kapalı).
  const activeMarkets = useMemo(
    () =>
      MARKETS.filter((m) =>
        (enabledMarketKeys || ['bist100', 'sp500', 'commodity']).includes(m.key),
      ),
    [enabledMarketKeys],
  )

  useEffect(() => {
    let cancelled = false
    fetchEnabledMarkets()
      .then((keys) => {
        if (!cancelled && Array.isArray(keys) && keys.length) setEnabledMarketKeys(keys)
      })
      .catch(() => {
        /* manifest yoksa tüm marketler gösterilir */
      })
      .finally(() => {
        // Başarı da hata da listeyi kesinleştirir: hata durumunda fallback geçerlidir
        if (!cancelled) setMarketsResolved(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Seçili market kapatıldıysa ilk etkin markete düş
  useEffect(() => {
    if (activeMarkets.length && !activeMarkets.some((m) => m.key === market)) {
      setMarket(activeMarkets[0].key)
    }
  }, [activeMarkets, market])

  // Tema seçimi <html> data-theme'ine yansır (data-theme yoksa sistem tercihi)
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  function changeTheme(next) {
    try {
      if (next === 'system') localStorage.removeItem('theme')
      else localStorage.setItem('theme', next)
    } catch {
      /* ignore */
    }
    setThemeState(next)
  }

  // ⌘K / Ctrl+K her yerden arama paletini aç/kapat; "?" kısayol yardımını açar
  // (bir inputta yazarken değil — soru işareti orada metindir).
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        const tag = e.target?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return
        e.preventDefault()
        setHelpOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Alarm değerlendirmesi için hisse/fon haritaları (yüklü günlük özet + fonlar)
  const stockMap = useMemo(() => {
    const m = new Map()
    for (const mk of activeMarkets) {
      for (const s of overviewCache.daily?.[mk.key]?.stocks || []) if (!m.has(s.symbol)) m.set(s.symbol, s)
    }
    return m
  }, [overviewCache.daily, activeMarkets])

  const fundMap = useMemo(() => {
    const m = new Map()
    for (const f of funds?.results || []) m.set(f.symbol, f)
    return m
  }, [funds])

  const alertEvals = useMemo(
    () =>
      alerts.map((a) => {
        const current = alertCurrentValue(a, stockMap, fundMap)
        return { ...a, current, triggered: alertIsTriggered(current, a) }
      }),
    [alerts, stockMap, fundMap],
  )
  const alertTriggeredCount = alertEvals.filter((a) => a.triggered).length

  function addAlert(alert) {
    setAlerts((prev) => {
      const next = [...prev, alert]
      saveAlerts(next)
      return next
    })
  }

  function removeAlert(id) {
    setAlerts((prev) => {
      const next = prev.filter((a) => a.id !== id)
      saveAlerts(next)
      return next
    })
  }

  function enableNotify() {
    if (typeof Notification === 'undefined') return
    Notification.requestPermission().then((p) => setNotifyPerm(p))
  }

  // Veri her güncellendiğinde tetiklenen alarmlar için tarayıcı bildirimi.
  // lastGen ile aynı tarama için tekrar bildirim atılmaz.
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !alerts.length) return
    const firstKey = activeMarkets.find((m) => overviewCache.daily?.[m.key])?.key
    const gen = `${overviewCache.daily?.[firstKey]?.generated_at || ''}|${funds?.generated_at || ''}`
    if (gen === '|') return
    let changed = false
    const next = alerts.map((a) => {
      const v = alertCurrentValue(a, stockMap, fundMap)
      if (alertIsTriggered(v, a) && a.lastGen !== gen) {
        try {
          new Notification(t(lang, 'alertNotifTitle', displaySymbol(a.symbol)), {
            body: t(lang, 'alertNotifBody', alertCondText(a, lang), formatAlertCurrent(v, a.kind)),
          })
        } catch {
          /* bildirim atılamadıysa sessiz geç */
        }
        changed = true
        return { ...a, lastGen: gen }
      }
      return a
    })
    if (changed) {
      setAlerts(next)
      saveAlerts(next)
    }
  }, [alerts, overviewCache.daily, funds, stockMap, fundMap, activeMarkets, lang])

  // Arama paleti açılınca arama dizini için fon + günlük özet verisi hazır olsun
  useEffect(() => {
    if (!paletteOpen || funds || fundsLoading) return
    loadFunds()
  }, [paletteOpen, funds, fundsLoading])

  useEffect(() => {
    if (!paletteOpen || !marketsResolved || overviewCache.daily) return
    let cancelled = false
    fetchDailyOverview(activeMarkets.map((m) => m.key), 'daily')
      .then((result) => {
        if (!cancelled) setOverviewCache((prev) => (prev.daily ? prev : { ...prev, daily: result }))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [paletteOpen, marketsResolved, overviewCache.daily, activeMarkets])

  function load(live = false) {
    setLoading(true)
    setError(null)
    return fetchScreener(market, { live, timeframe })
      .then((result) => {
        setData(result)
      })
      .catch((err) => {
        setError(err.message)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  function loadFunds() {
    setFundsLoading(true)
    setFundsError(null)
    return fetchFunds()
      .then((result) => {
        setFunds(result)
      })
      .catch((err) => {
        setFundsError(err.message)
      })
      .finally(() => {
        setFundsLoading(false)
      })
  }

  useEffect(() => {
    let cancelled = false
    setData(null)
    setLoading(true)
    setError(null)
    fetchScreener(market, { live: false, timeframe })
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [market, timeframe])

  useEffect(() => {
    if (
      view !== 'funds' &&
      view !== 'today' &&
      view !== 'fundCompare' &&
      view !== 'fundLeague' &&
      view !== 'watchlist' &&
      view !== 'portfolio' &&
      view !== 'alerts'
    )
      return
    if (funds) return
    let cancelled = false
    setFundsLoading(true)
    setFundsError(null)
    fetchFunds()
      .then((result) => {
        if (!cancelled) setFunds(result)
      })
      .catch((err) => {
        if (!cancelled) setFundsError(err.message)
      })
      .finally(() => {
        if (!cancelled) setFundsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [view, funds])

  useEffect(() => {
    // Fiyat serileri karşılaştırma/portföy sekmelerinde ve bir fon modalı
    // açılınca (fon detayındaki gerçek fiyat grafiği için) yüklenir.
    if (view !== 'fundCompare' && view !== 'portfolio' && !chartFund) return
    if (fundPricesReady) return
    let cancelled = false
    setFundPricesLoading(true)
    fetchFundPrices()
      .then((result) => {
        if (!cancelled) setFundPrices(result)
      })
      .catch(() => {
        // Fiyat dosyası yoksa metrik karşılaştırması yine çalışsın
        if (!cancelled) setFundPrices(null)
      })
      .finally(() => {
        if (!cancelled) {
          setFundPricesReady(true)
          setFundPricesLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [view, chartFund, fundPricesReady])

  // Hisse fiyat serileri: BIST grafiği açıldığında (modal) ya da tarama/portföy/
  // izlediklerim sekmelerinde (sparkline, hisse portföyü/karşılaştırma) bir kez yüklenir.
  useEffect(() => {
    const wantsPrices =
      chartSymbol?.endsWith('.IS') ||
      view === 'screener' ||
      view === 'watchlist' ||
      view === 'portfolio' ||
      view === 'stockCompare' ||
      view === 'strategy' // çeşitlilik paneli korelasyonu fiyat serilerinden hesaplar
    if (!wantsPrices || stockPricesReady) return
    let cancelled = false
    setStockPricesLoading(true)
    fetchStockPrices()
      .then((result) => {
        if (!cancelled) setStockPrices(result)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setStockPricesReady(true)
          setStockPricesLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [chartSymbol, view, stockPricesReady])

  // Sinyal karnesi arşivi: yalnızca Karne sekmesinde gerekir.
  useEffect(() => {
    if (view !== 'scorecard' || signalLogReady) return
    let cancelled = false
    setSignalLogLoading(true)
    fetchSignalLog()
      .then((result) => {
        if (!cancelled) setSignalLog(result)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setSignalLogReady(true)
          setSignalLogLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [view, signalLogReady])

  // Döviz/altın serileri: BIST grafiği açıldığında (para birimi anahtarı için) yüklenir.
  useEffect(() => {
    if (!chartSymbol?.endsWith('.IS') || fxReady) return
    let cancelled = false
    fetchFx()
      .then((result) => {
        if (!cancelled) setFx(result)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFxReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [chartSymbol, fxReady])

  // Fon akışı arşivi yalnızca Fonlar sekmesinde gerekir; dosya birikene kadar
  // 404 döner ve panel görünmez (fetch null döndürür).
  useEffect(() => {
    if (view !== 'funds' || fundFlowsReady) return
    let cancelled = false
    fetchFundFlows()
      .then((result) => {
        if (!cancelled) setFundFlows(result)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFundFlowsReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [view, fundFlowsReady])

  // Skor geçmişi: Bugün sayfasında (değişim raporu) ve bir hisse grafiği açılınca
  // (detaydaki skor geçmişi sparkline'ı) gerekir.
  useEffect(() => {
    if ((view !== 'today' && !chartSymbol) || scoreHistoryReady) return
    let cancelled = false
    fetchScoreHistory()
      .then((result) => {
        if (!cancelled) setScoreHistory(result)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setScoreHistoryReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [view, scoreHistoryReady, chartSymbol])

  useEffect(() => {
    // Karşılaştır sekmesi de KAP verisini kullanır (portföy örtüşme analizi);
    // bir BIST hisse grafiği açılınca da (detaydaki "taşıyan fonlar" bloğu).
    if (view !== 'stockPositions' && view !== 'fundCompare' && !chartSymbol?.endsWith('.IS')) return
    if (stockPositions) return
    let cancelled = false
    setStockPositionsLoading(true)
    setStockPositionsError(null)
    fetchStockPositions()
      .then((result) => {
        if (!cancelled) setStockPositions(result)
      })
      .catch((err) => {
        if (!cancelled) setStockPositionsError(err.message)
      })
      .finally(() => {
        if (!cancelled) setStockPositionsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [view, stockPositions, chartSymbol])

  // Backtest tek bir dosyada tüm market/timeframe'leri taşır: bir kez yüklenir,
  // market/zaman dilimi değişince yeniden istek atılmaz.
  useEffect(() => {
    if (view !== 'backtest') return
    if (backtest) return
    let cancelled = false
    setBacktestLoading(true)
    setBacktestError(null)
    fetchBacktest()
      .then((result) => {
        if (!cancelled) setBacktest(result)
      })
      .catch((err) => {
        if (!cancelled) setBacktestError(err.message)
      })
      .finally(() => {
        if (!cancelled) setBacktestLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [view, backtest])

  // "Bugün" özeti: nabız/öne çıkan sinyaller için günlük her zaman; market kartları
  // için seçilen dilim (günlük/haftalık/aylık). Cache'lenen dilimler tekrar çekilmez.
  useEffect(() => {
    // İzlediklerim, Hisse Karşılaştır, Harita, Alarmlar ve Portföy de günlük özetten beslenir.
    if (
      view !== 'today' &&
      view !== 'watchlist' &&
      view !== 'stockCompare' &&
      view !== 'map' &&
      view !== 'bubbles' &&
      view !== 'alerts' &&
      view !== 'portfolio' &&
      view !== 'scorecard' && // karne, güncel fiyatı stockMap'ten okur
      view !== 'rotation' &&
      view !== 'strategy' // çeşitlilik paneli sektörü stockMap'ten okur
    )
      return
    if (!marketsResolved) return
    // Rotasyon tablosu üç ufku birden karşılaştırır; diğer sekmelere günlük yeter.
    const wanted =
      view === 'rotation'
        ? ['daily', 'weekly', 'monthly']
        : view === 'today'
          ? ['daily', todayTimeframe]
          : ['daily']
    const needed = [...new Set(wanted)].filter((tf) => !overviewCache[tf])
    if (!needed.length) return

    let cancelled = false
    setOverviewLoading(true)
    setOverviewError(null)
    const keys = activeMarkets.map((m) => m.key)

    Promise.all(
      needed.map((tf) =>
        fetchDailyOverview(keys, tf).then((result) => ({ tf, result })),
      ),
    )
      .then((rows) => {
        if (cancelled) return
        setOverviewCache((prev) => {
          const next = { ...prev }
          for (const { tf, result } of rows) next[tf] = result
          return next
        })
      })
      .catch((err) => {
        if (!cancelled) setOverviewError(err.message)
      })
      .finally(() => {
        if (!cancelled) setOverviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [view, todayTimeframe, overviewCache, activeMarkets, marketsResolved])

  // Temettü takvimi: kendi sekmesinde ve hisse detayında (detaydaki temettü bloğu
  // için) gerekir. Tek dosya, tek istek — yüklendikten sonra tekrar çekilmez.
  useEffect(() => {
    if (view !== 'dividends' && !chartSymbol) return
    if (dividendsReady) return
    let cancelled = false
    setDividendsLoading(true)
    fetchDividends()
      .then((result) => {
        if (!cancelled) setDividends(result)
      })
      .catch(() => {
        if (!cancelled) setDividends(null) // dosya yoksa hata kutusu değil, boş durum
      })
      .finally(() => {
        if (cancelled) return
        setDividendsLoading(false)
        setDividendsReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [view, chartSymbol, dividendsReady])

  // Makro panel: yalnızca kendi sekmesinde.
  useEffect(() => {
    if (view !== 'macro' || macroReady) return
    let cancelled = false
    setMacroLoading(true)
    fetchMacro()
      .then((result) => {
        if (!cancelled) setMacro(result)
      })
      .catch(() => {
        if (!cancelled) setMacro(null)
      })
      .finally(() => {
        if (cancelled) return
        setMacroLoading(false)
        setMacroReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [view, macroReady])

  // Haberler tüm marketler için tek seferde yüklenir (akış BIST/Global olarak bölünür,
  // market sekmesine bağlı değil); sekme açılınca veya grafik modalı için lazily.
  useEffect(() => {
    if (view !== 'news' && view !== 'today' && !chartSymbol && !chartFund) return
    if (!marketsResolved) return // market listesi kesinleşmeden istek atma
    if (news) return
    let ignore = false
    setNewsLoading(true)
    setNewsError(null)
    fetchAllNews(activeMarkets.map((m) => m.key))
      .then((result) => {
        if (!ignore) setNews(result)
      })
      .catch((err) => {
        if (!ignore) setNewsError(err.message)
      })
      .finally(() => {
        if (!ignore) setNewsLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [view, chartSymbol, chartFund, news, activeMarkets, marketsResolved])

  // Haftalık sinyaller: Strateji sekmesi açıkken veya bildirim izni verilmişken
  // (arka planda yeni-sinyal bildirimi için) tek sefer yüklenir.
  useEffect(() => {
    if (!marketsResolved) return
    if (view !== 'strategy' && notifyPerm !== 'granted') return
    if (weeklySignals) return
    let cancelled = false
    setWeeklySignalsLoading(true)
    fetchDailyOverview(activeMarkets.map((m) => m.key), 'weekly')
      .then((result) => {
        if (!cancelled) setWeeklySignals(result)
      })
      .catch(() => {
        if (!cancelled) setWeeklySignals({})
      })
      .finally(() => {
        if (!cancelled) setWeeklySignalsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [view, notifyPerm, weeklySignals, activeMarkets, marketsResolved])

  // Tüm marketlerin haftalık taze sinyalleri tek listede (market etiketiyle)
  const freshWeeklySignals = useMemo(() => {
    if (!weeklySignals) return []
    const out = []
    for (const m of activeMarkets) {
      for (const s of weeklySignals[m.key]?.results || []) {
        if (s.is_new) out.push({ ...s, market: m.key })
      }
    }
    return out
  }, [weeklySignals, activeMarkets])

  // Yeni haftalık sinyal bildirimi: daha önce bildirilmemiş taze sinyaller için
  // tek bir tarayıcı bildirimi. Bildirilenler localStorage'da tutulur (tekrar atmaz).
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    if (!freshWeeklySignals.length) return
    let notified
    try {
      notified = new Set(JSON.parse(localStorage.getItem('strategy_notified') || '[]'))
    } catch {
      notified = new Set()
    }
    const fresh = freshWeeklySignals.filter((s) => !notified.has(s.symbol))
    if (!fresh.length) return
    try {
      const names = fresh.map((s) => displaySymbol(s.symbol))
      new Notification(t(lang, 'stratNotifTitle', fresh.length), {
        body: names.slice(0, 6).join(', ') + (names.length > 6 ? ` +${names.length - 6}` : ''),
      })
    } catch {
      /* bildirim atılamadıysa sessiz geç */
    }
    // Artık listede olmayan eski sembolleri de temizle: sinyal tekrar taze olursa yeniden bildirilsin
    const current = new Set(freshWeeklySignals.map((s) => s.symbol))
    const keep = [...notified].filter((sym) => current.has(sym))
    localStorage.setItem('strategy_notified', JSON.stringify([...keep, ...fresh.map((s) => s.symbol)]))
  }, [freshWeeklySignals, lang])

  const overview = overviewCache.daily || null
  const marketOverview = overviewCache[todayTimeframe] || null
  const activeTimeframe = TIMEFRAMES.find((t) => t.key === timeframe)
  // Paylaşım kartında marketin adı yazsın (sekme etiketiyle aynı, dile duyarlı).
  const activeMarket = activeMarkets.find((m) => m.key === market) || MARKETS.find((m) => m.key === market)
  const chartNews = useMemo(() => {
    if (!news) return null
    const sym = chartFund?.symbol || chartSymbol
    if (!sym) return null
    return news.items.filter((n) => n.symbol === sym)
  }, [chartSymbol, chartFund, news])

  // Açık grafik modalı için hisse kaydı, taşıyan fonlar ve skor geçmişi serisi
  const chartStock = useMemo(() => {
    if (!chartSymbol) return null
    for (const m of activeMarkets) {
      const found = (overviewCache.daily?.[m.key]?.stocks || []).find((s) => s.symbol === chartSymbol)
      if (found) return found
    }
    // Tarama sekmesi günlük özeti yüklemez (kendi payload'ı var): oradan açılan
    // detay penceresi gösterge bloklarını bu yedekten alır, yoksa boş kalırdı.
    return (data?.stocks || []).find((s) => s.symbol === chartSymbol) || null
  }, [chartSymbol, overviewCache.daily, activeMarkets, data])

  const chartPositions = useMemo(() => {
    if (!chartSymbol) return null
    return stockPositions?.stocks?.[chartSymbol.replace('.IS', '')] || null
  }, [chartSymbol, stockPositions])

  const chartScoreSeries = useMemo(() => {
    if (!chartSymbol || !scoreHistory?.history) return null
    const out = []
    for (const date of Object.keys(scoreHistory.history).sort()) {
      const s = scoreHistory.history[date]?.[chartSymbol]?.s
      if (s != null) out.push([date, s])
    }
    return out.length > 1 ? out : null
  }, [chartSymbol, scoreHistory])

  // Hisse detayındaki temettü bloğu: takvim tek dosya olduğundan sembolü orada arıyoruz
  // (temettü ödemeyen hisse takvimde hiç yok -> blok gösterilmez).
  const chartDividend = useMemo(() => {
    if (!chartSymbol) return null
    return (dividends?.items || []).find((i) => i.symbol === chartSymbol) || null
  }, [chartSymbol, dividends])
  const availableEmas = data?.ema_periods || (timeframe === 'monthly' ? [9, 21, 50] : [9, 21, 50, 200])

  const isCustom = useMemo(() => {
    if (
      filters.rsi !== DEFAULT_FILTERS.rsi ||
      filters.stochK !== DEFAULT_FILTERS.stochK ||
      filters.stochRsiK !== DEFAULT_FILTERS.stochRsiK ||
      filters.macdPositive !== DEFAULT_FILTERS.macdPositive ||
      filters.sectors?.length
    )
      return true
    return availableEmas.some((p) => !filters.emas[p])
  }, [filters, availableEmas])

  // Filtre panelindeki sektör seçimi için taramadaki mevcut sektörler
  const availableSectors = useMemo(() => {
    const set = new Set()
    for (const s of data?.stocks || []) if (s.sector) set.add(s.sector)
    return [...set].sort((a, b) => sectorLabel(a, lang).localeCompare(sectorLabel(b, lang), lang))
  }, [data, lang])

  const rows = useMemo(() => {
    if (!data) return []
    let list = data.stocks
      ? showAllStocks
        ? data.stocks
        : data.stocks.filter((s) => stockPassesFilters(s, filters, availableEmas))
      : data.results // eski veri formatı: yalnızca varsayılan filtre sonuçları
    // "Sadece yeniler": bu mumda filtreye YENİ giren hisseler. Sinyal listesi
    // günlerce aynı kalabildiğinden, gerçekten yeni olanı ayırmak strateji için şart.
    if (onlyNew) {
      const fresh = new Set((data.results || []).filter((r) => r.is_new).map((r) => r.symbol))
      list = list.filter((s) => fresh.has(s.symbol))
    }
    if (onlyWatchlist) list = list.filter((s) => watchlist.has(s.symbol))
    const q = search.trim().toUpperCase()
    if (q)
      list = list.filter(
        (s) =>
          s.symbol.toUpperCase().includes(q) || displaySymbol(s.symbol).toUpperCase().includes(q),
      )
    // Her satıra teknik puanı ekle (sıralama ve gösterim için)
    list = list.map((s) => ({ ...s, score: technicalScore(s, availableEmas) }))
    const { key, dir } = sort
    list.sort((a, b) => compareRows(a, b, key, dir))
    return list
  }, [data, filters, availableEmas, onlyWatchlist, watchlist, search, sort, showAllStocks, onlyNew])

  const fundRows = useMemo(() => {
    if (!funds?.results) return []
    let list = [...funds.results]
    if (onlyFundWatchlist) list = list.filter((f) => fundWatchlist.has(f.symbol))
    const q = fundSearch.trim().toUpperCase()
    if (q) {
      list = list.filter(
        (f) =>
          f.symbol.toUpperCase().includes(q) ||
          (f.name || '').toUpperCase().includes(q),
      )
    }
    const { key, dir } = fundSort
    list.sort((a, b) => compareRows(a, b, key, dir))
    return list
  }, [funds, fundSearch, fundSort, onlyFundWatchlist, fundWatchlist])

  function toggleSort(key) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'symbol' ? 'asc' : 'desc' },
    )
  }

  function toggleFundSort(key) {
    setFundSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'symbol' ? 'asc' : 'desc' },
    )
  }

  // Görünen (filtrelenmiş/sıralı) tabloların CSV karşılığı. Yüzdeler okunur olsun
  // diye 100 ile çarpılır; sembol arayüzdeki gösterim koduyla yazılır. Satırlar
  // tembel üretilir (fonksiyon): kullanıcı indirmedikçe hesaplanmaz.
  const screenerCsv = {
    header: ['Sembol', 'Puan', 'Kapanış', 'Değişim %', 'Piyasa Değeri', 'Göreli Güç %', 'RSI', 'MACD', 'Stoch %K', 'Stoch RSI %K'],
    rows: () => {
      const pct = (v) => (v != null ? (v * 100).toFixed(2) : '')
      return rows.map((r) => [
        displaySymbol(r.symbol), r.score ?? '', r.close ?? '', pct(r.change), r.market_cap ?? '',
        pct(r.relative_strength), r.rsi ?? '', r.macd_line ?? '', r.stoch_k ?? '', r.stoch_rsi_k ?? '',
      ])
    },
  }

  const fundsCsv = {
    header: ['Sembol', 'Ad', 'Puan', '1G %', 'Yatırımcı', '1A %', '3A %', '6A %', '1Y %', 'YtD %', 'Volatilite %', 'Sharpe', 'Max Düşüş %', 'Büyüklük'],
    rows: () => {
      const pct = (v) => (v != null ? (v * 100).toFixed(2) : '')
      return fundRows.map((f) => [
        f.symbol, f.name, f.score ?? '', pct(f.return_1d), f.investor_count ?? '',
        pct(f.return_1m), pct(f.return_3m), pct(f.return_6m), pct(f.return_1y), pct(f.return_ytd),
        pct(f.volatility), f.sharpe ?? '', pct(f.max_drawdown), f.portfolio_size ?? '',
      ])
    },
  }

  // Yeni sinyal bilgisi results üzerinde gelir; stocks listesinde göstermek için haritalanır
  const newSymbols = useMemo(
    () => new Set((data?.results || []).filter((r) => r.is_new).map((r) => r.symbol)),
    [data],
  )

  function toggleWatch(symbol) {
    setWatchlist((prev) => {
      const next = new Set(prev)
      if (next.has(symbol)) next.delete(symbol)
      else next.add(symbol)
      localStorage.setItem('watchlist', JSON.stringify([...next]))
      return next
    })
  }

  function toggleFundWatch(symbol) {
    setFundWatchlist((prev) => {
      const next = new Set(prev)
      if (next.has(symbol)) next.delete(symbol)
      else next.add(symbol)
      localStorage.setItem('watchlist_funds', JSON.stringify([...next]))
      return next
    })
  }

  // Paylaşılan favori listesi: bağlantıda `w` varsa kullanıcıya SORULUR.
  // Sessizce eklemek, birinin listesini bir bağlantıyla değiştirmek olurdu.
  const [watchImport, setWatchImport] = useState(() => {
    if (!initialUrl.watch) return null
    const parsed = decodeWatchParam(initialUrl.watch)
    return parsed.stocks.length || parsed.funds.length ? parsed : null
  })

  // Adres çubuğunu ekranla senkron tut: her ekran yer imine eklenebilir ve
  // paylaşılabilir olsun. Market/zaman dilimi yalnızca ONLARI kullanan
  // sekmelerde yazılır — "Bugün" sayfasının bağlantısında `m=bist100` durması
  // kullanıcıya orada bir market seçimi varmış izlenimi verirdi.
  useEffect(() => {
    const params = new URLSearchParams()
    if (view !== 'today') params.set(URL_KEYS.view, view)
    if (MARKET_AWARE_VIEWS.has(view)) params.set(URL_KEYS.market, market)
    if (TIMEFRAME_AWARE_VIEWS.has(view)) params.set(URL_KEYS.timeframe, timeframe)
    if (chartSymbol) params.set(URL_KEYS.symbol, chartSymbol)
    // Cevaplanmamış liste daveti adreste KALIR: ilk ziyarette service worker
    // güncellemesi sayfayı yeniden yüklüyor (main.jsx) ve parametre burada
    // silinseydi paylaşılan liste sessizce kaybolurdu — tam da bu akış bozuktu.
    if (watchImport && initialUrl.watch) params.set('w', initialUrl.watch)
    const query = params.toString()
    const url = `${window.location.pathname}${query ? `?${query}` : ''}`
    window.history.replaceState(null, '', url)
  }, [view, market, timeframe, chartSymbol, watchImport, initialUrl.watch])
  const [shareMsg, setShareMsg] = useState(null)

  async function copyLink(url, okKey = 'shareCopied') {
    try {
      await navigator.clipboard.writeText(url)
      setShareMsg(t(lang, okKey))
    } catch {
      setShareMsg(t(lang, 'shareFailed'))
    }
    window.setTimeout(() => setShareMsg(null), 2500)
  }

  function shareCurrentScreen() {
    copyLink(window.location.href)
  }

  /** Paylaşım şeridinden gelen bilgilendirmeler aynı toast'ı kullanır. */
  function flashShareMsg(message) {
    setShareMsg(message)
    window.setTimeout(() => setShareMsg(null), 3500)
  }

  function shareWatchlist() {
    // watchlist/fundWatchlist birer Set: uzunluk `size` ile okunur.
    if (!watchlist.size && !fundWatchlist.size) {
      setShareMsg(t(lang, 'shareWatchlistEmpty'))
      window.setTimeout(() => setShareMsg(null), 2500)
      return
    }
    const params = new URLSearchParams({ w: encodeWatchParam([...watchlist], [...fundWatchlist]) })
    params.set(URL_KEYS.view, 'watchlist')
    copyLink(`${window.location.origin}${window.location.pathname}?${params.toString()}`)
  }

  function acceptWatchImport() {
    // Mevcut favoriler korunur, yalnızca eksik olanlar eklenir.
    const added =
      watchImport.stocks.filter((s) => !watchlist.has(s)).length +
      watchImport.funds.filter((f) => !fundWatchlist.has(f)).length
    setWatchlist((prev) => {
      const next = new Set([...prev, ...watchImport.stocks])
      localStorage.setItem('watchlist', JSON.stringify([...next]))
      return next
    })
    setFundWatchlist((prev) => {
      const next = new Set([...prev, ...watchImport.funds])
      localStorage.setItem('watchlist_funds', JSON.stringify([...next]))
      return next
    })
    setWatchImport(null)
    setShareMsg(t(lang, 'watchImportDone', added))
    window.setTimeout(() => setShareMsg(null), 2500)
  }

  function selectView(next) {
    setView(next)
    setMenuOpen(false)
    // Aylık/çeyreklikte backtest yok; sekmeyi boş açmak yerine günlüğe düş
    if (next === 'backtest' && !BACKTEST_TIMEFRAMES.some((tf) => tf.key === timeframe)) {
      setTimeframe('daily')
    }
  }

  return (
    <div className="layout">
      {/* Ambient aurora arka plan: içeriğin arkasında yavaşça süzülen bulanık
          renk lekeleri (mesh gradient). Kartların gerisinde kalır, okunabilirliği
          bozmaz. */}
      <div className="aurora" aria-hidden="true" />
      {/* Mobilde menü açıkken arkaya tıklamak kapatır */}
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}

      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <Logo />
          <h1>{t(lang, 'brand')}</h1>
        </div>

        <nav className="nav" aria-label={t(lang, 'navLabel')}>
          {NAV_SECTIONS.map((section, si) => (
            <div key={section.titleKey || si} className="nav-section">
              {section.titleKey && (
                <div className="nav-section-title">{t(lang, section.titleKey)}</div>
              )}
              {section.items.map((item) => (
                <button
                  key={item.key}
                  className={`nav-item ${view === item.key ? 'active' : ''}`}
                  aria-current={view === item.key ? 'page' : undefined}
                  onClick={() => selectView(item.key)}
                >
                  <span className="nav-icon" aria-hidden="true">
                    <NavIcon name={item.key} />
                  </span>
                  {t(lang, item.i18nKey)}
                  {item.key === 'alerts' && alertTriggeredCount > 0 && (
                    <span className="nav-badge">{alertTriggeredCount}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="tabs theme-switch" role="group" aria-label={t(lang, 'themeLabel')}>
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`tab ${theme === opt.key ? 'active' : ''}`}
                title={t(lang, opt.i18nKey)}
                aria-pressed={theme === opt.key}
                onClick={() => changeTheme(opt.key)}
              >
                <span aria-hidden="true">{opt.icon}</span>
                <span className="theme-switch-label">{t(lang, opt.i18nKey)}</span>
              </button>
            ))}
          </div>
          <div className="tabs lang-switch" role="group" aria-label="Language">
            {['tr', 'en'].map((code) => (
              <button
                key={code}
                type="button"
                className={`tab ${lang === code ? 'active' : ''}`}
                onClick={() => {
                  if (lang !== code) {
                    persistLang(code)
                    setLangState(code)
                  }
                }}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="content">
        <header className="content-head">
          <button
            className="menu-btn"
            aria-label={t(lang, 'menuOpen')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            ☰
          </button>
          <p className="tagline">
            {t(lang, 'tagline')} · {lang === 'en' ? activeTimeframe.horizonEn : activeTimeframe.horizon}
          </p>
          <button
            className="cmdk-trigger"
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label={t(lang, 'cmdkTrigger')}
          >
            <span className="cmdk-trigger-icon" aria-hidden="true">🔍</span>
            <span className="cmdk-trigger-text">{t(lang, 'cmdkPlaceholder')}</span>
            <kbd className="cmdk-trigger-kbd">⌘K</kbd>
          </button>
          {/* Ekranı paylaş: adres çubuğu zaten güncel durumu taşıdığından
              bağlantıyı kopyalamak yeterli. */}
          <button className="share-btn" type="button" onClick={shareCurrentScreen} title={t(lang, 'shareScreen')}>
            🔗<span className="share-btn-text">{t(lang, 'shareScreen')}</span>
          </button>
          {/* Market/zaman dilimi menüde değil burada: bunlar navigasyon değil,
              görünümün filtresi — yalnızca ilgili sekmelerde anlamlılar. */}
          <div className="tab-groups">
            {(view === 'screener' ||
              view === 'backtest' ||
              view === 'map' ||
              view === 'bubbles' ||
              view === 'rotation') &&
              marketsResolved && (
              <div className="tabs">
                {activeMarkets.map((m) => (
                  <button
                    key={m.key}
                    className={`tab ${market === m.key ? 'active' : ''}`}
                    onClick={() => setMarket(m.key)}
                  >
                    {mLabel(m, lang)}
                  </button>
                ))}
              </div>
            )}
            {(view === 'screener' || view === 'backtest') && (
              <div className="tabs">
                {(view === 'backtest' ? BACKTEST_TIMEFRAMES : TIMEFRAMES).map((tf) => (
                  <button
                    key={tf.key}
                    className={`tab ${timeframe === tf.key ? 'active' : ''}`}
                    onClick={() => setTimeframe(tf.key)}
                  >
                    {tfLabel(tf, lang)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

      {view === 'today' && (
        <>
          <TodayView
            overview={overview}
            marketOverview={marketOverview}
            funds={funds}
            news={news}
            scores={scoreHistory}
            lang={lang}
            allMarkets={activeMarkets}
            loading={overviewLoading}
            error={overviewError}
            todayTimeframe={todayTimeframe}
            onTodayTimeframe={setTodayTimeframe}
            onOpenChart={setChartSymbol}
            onOpenFund={setChartFund}
            onNavigate={(nextView, nextMarket, nextTimeframe) => {
              if (nextMarket) setMarket(nextMarket)
              if (nextTimeframe) setTimeframe(nextTimeframe)
              selectView(nextView)
            }}
          />
        </>
      )}

      {view === 'watchlist' && (
        <>
          <WatchlistView
            watchlist={watchlist}
            fundWatchlist={fundWatchlist}
            overview={overviewCache.daily}
            funds={funds}
            stockPrices={stockPrices}
            lang={lang}
            loading={overviewLoading || fundsLoading}
            onOpenChart={setChartSymbol}
            onOpenFund={setChartFund}
            onToggleStock={toggleWatch}
            onToggleFund={toggleFundWatch}
            onCompareStocks={(symbols) => {
              setCompareSeed(symbols)
              selectView('stockCompare')
            }}
            onCompareFunds={(symbols) => {
              setCompareSeed(symbols)
              selectView('fundCompare')
            }}
            onShare={shareWatchlist}
          />
        </>
      )}

      {view === 'portfolio' && (
        <>
          <PortfolioView
            funds={funds}
            prices={fundPrices}
            stockPrices={stockPrices}
            stockMap={stockMap}
            lang={lang}
            loading={fundsLoading || fundPricesLoading}
            onOpenFund={setChartFund}
            onOpenStock={setChartSymbol}
          />
        </>
      )}

      {view === 'backtest' && (
        <BacktestView
          lang={lang}
          data={backtest}
          market={market}
          timeframe={timeframe}
          loading={backtestLoading}
          error={backtestError}
        />
      )}

      {view === 'funds' && (
        <>
          <div className="status-bar">
            <span>
              {funds
                ? t(
                    lang,
                    'fundsStatus',
                    funds.count,
                    funds.generated_at
                      ? new Date(funds.generated_at).toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR')
                      : '',
                  )
                : fundsLoading
                  ? t(lang, 'fundsLoading')
                  : ''}
            </span>
            <div className="actions">
              <button
                className={`btn ${onlyFundWatchlist ? 'primary' : ''}`}
                title={t(lang, 'watchOnlyFundsHint')}
                onClick={() => setOnlyFundWatchlist((v) => !v)}
              >
                ⭐ {t(lang, 'favorites')}
                {fundWatchlist.size ? ` (${fundWatchlist.size})` : ''}
              </button>
              {fundRows.length > 0 && (
                <ShareBar
                  lang={lang}
                  csv={{ filename: 'fonlar.csv', header: fundsCsv.header, rows: () => fundsCsv.rows() }}
                  card={{
                    title: t(lang, 'tabFunds'),
                    subtitle: t(lang, 'colScore'),
                    filename: `fonlar-${new Date().toISOString().slice(0, 10)}.png`,
                    rows: fundRows.slice(0, SHARE_CARD_ROWS).map((f) => ({
                      label: f.symbol,
                      value: f.score != null ? String(f.score) : '—',
                      note: f.return_1y == null ? undefined : formatPct(f.return_1y, 1),
                      tone: pctTone(f.return_1y),
                    })),
                  }}
                  shareText={t(lang, 'shareFundsText', fundRows.length)}
                  onMessage={flashShareMsg}
                />
              )}
              <button
                className="btn"
                disabled={fundsLoading}
                onClick={() => {
                  setFunds(null)
                  loadFunds()
                }}
              >
                {fundsLoading && <span className="spinner" />}
                {t(lang, 'refresh')}
              </button>
            </div>
          </div>

          <details className="info-panel">
            <summary>{t(lang, 'fundsHowTitle')}</summary>
            <div className="info-content">
              <p>{t(lang, 'fundsHowBody1')}</p>
              <p>
                <strong>{lang === 'en' ? 'Score (0-100):' : 'Puan (0-100):'}</strong>{' '}
                {t(lang, 'fundsHowBody2')}
              </p>
              <p>{t(lang, 'fundsHowBody3')}</p>
            </div>
          </details>

          <FundFlowsPanel flows={fundFlows} funds={funds} lang={lang} onOpenFund={setChartFund} />

          {!fundsError && funds && (
            <div className="search-row">
              <input
                className="search-input"
                type="search"
                placeholder={t(lang, 'searchFund')}
                value={fundSearch}
                onChange={(e) => setFundSearch(e.target.value)}
              />
            </div>
          )}

          {fundsError && <div className="error-box">{fundsError}</div>}

          {!fundsError && funds && fundRows.length === 0 && (
            <div className="empty-box">
              {fundSearch.trim()
                ? t(lang, 'fundsNoMatch', fundSearch.trim())
                : t(lang, 'fundsEmpty')}
            </div>
          )}

          {!fundsError && fundRows.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="star-cell"></th>
                    {FUND_COLUMNS.map((c) => (
                      <th
                        key={c.key}
                        className={`sortable ${c.align === 'left' ? 'left' : ''} ${fundSort.key === c.key ? 'sorted' : ''}`}
                        onClick={() => toggleFundSort(c.key)}
                      >
                        {c.i18nKey ? t(lang, c.i18nKey) : c.label}
                        <span className="sort-arrow">
                          {fundSort.key === c.key ? (fundSort.dir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fundRows.map((f) => (
                    <tr key={f.symbol}>
                      <td className="star-cell">
                        <button
                          className={`star-btn ${fundWatchlist.has(f.symbol) ? 'active' : ''}`}
                          title={t(lang, fundWatchlist.has(f.symbol) ? 'watchRemove' : 'watchAdd')}
                          onClick={() => toggleFundWatch(f.symbol)}
                        >
                          {fundWatchlist.has(f.symbol) ? '★' : '☆'}
                        </button>
                      </td>
                      <td className="symbol-cell">
                        <button
                          className="symbol-btn fund-link"
                          type="button"
                          title={f.name}
                          onClick={() => setChartFund(f)}
                        >
                          <TickerLogo symbol={f.symbol} />
                          <span className="fund-code-wrap">
                            <strong>{f.symbol}</strong>
                            <span className="fund-name">{f.name}</span>
                          </span>
                        </button>
                      </td>
                      <td>
                        <span className={`badge score-${scoreTone(f.score)}`}>{f.score}</span>
                      </td>
                      <td>
                        <span className={`pct ${pctTone(f.return_1d)}`}>{formatPct(f.return_1d, 2)}</span>
                      </td>
                      <td>{f.investor_count == null ? '—' : f.investor_count.toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR')}</td>
                      <td>
                        <span className={`pct ${pctTone(f.return_1m)}`}>{formatPct(f.return_1m)}</span>
                      </td>
                      <td>
                        <span className={`pct ${pctTone(f.return_3m)}`}>{formatPct(f.return_3m)}</span>
                      </td>
                      <td>
                        <span className={`pct ${pctTone(f.return_6m)}`}>{formatPct(f.return_6m)}</span>
                      </td>
                      <td>
                        <span className={`pct ${pctTone(f.return_1y)}`}>{formatPct(f.return_1y)}</span>
                      </td>
                      <td>
                        <span className={`pct ${pctTone(f.return_ytd)}`}>{formatPct(f.return_ytd)}</span>
                      </td>
                      <td>{f.volatility != null ? `${(f.volatility * 100).toFixed(1)}%` : '—'}</td>
                      <td>{f.sharpe != null ? f.sharpe.toFixed(2) : '—'}</td>
                      <td>
                        <span className={`pct ${pctTone(f.max_drawdown)}`}>
                          {formatPct(f.max_drawdown)}
                        </span>
                      </td>
                      <td>{formatMarketCap(f.portfolio_size)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="disclaimer">{t(lang, 'fundDisclaimer')}</p>
        </>
      )}

      {view === 'fundLeague' && (
        <FundLeague funds={funds} lang={lang} loading={fundsLoading} onOpenFund={setChartFund} />
      )}

      {view === 'fundCompare' && (
        <FundCompare
          key={compareSeed.join(',') || 'default'}
          funds={funds}
          prices={fundPrices}
          positions={stockPositions}
          lang={lang}
          loading={fundsLoading || fundPricesLoading}
          error={fundsError}
          seedSymbols={compareSeed}
        />
      )}

      {view === 'stockCompare' && (
        <StockCompare
          overview={overviewCache.daily}
          prices={stockPrices}
          lang={lang}
          loading={(overviewLoading && !overviewCache.daily) || stockPricesLoading}
          seedSymbols={compareSeed}
        />
      )}

      {view === 'dividends' && (
        <DividendsView
          data={dividends}
          loading={dividendsLoading}
          lang={lang}
          onOpenChart={setChartSymbol}
        />
      )}

      {view === 'macro' && <MacroView data={macro} loading={macroLoading} lang={lang} />}

      {view === 'stockPositions' && (
        <StockPositions
          data={stockPositions}
          loading={stockPositionsLoading}
          error={stockPositionsError}
          lang={lang}
        />
      )}

      {view === 'rotation' && (
        <SectorRotation
          overviews={overviewCache}
          market={market}
          lang={lang}
          loading={overviewLoading}
          onNavigate={(sector) => {
            // Sektöre tıkla → taramayı o sektöre filtrele (rotasyondan hisseye geçiş).
            // "Tüm hisseler" modu filtreleri atladığından kapatılır; aksi halde
            // sektör seçimi sessizce hiçbir şey yapmazdı.
            setFilters((f) => ({ ...f, sectors: [sector] }))
            setShowAllStocks(false)
            selectView('screener')
          }}
        />
      )}

      {view === 'scorecard' && (
        <SignalScorecard
          log={signalLog}
          stockMap={stockMap}
          lang={lang}
          loading={signalLogLoading || (overviewLoading && !overviewCache.daily)}
          onOpenChart={setChartSymbol}
        />
      )}

      {view === 'strategy' && (
        <StrategyTracker
          signals={freshWeeklySignals}
          signalsLoading={weeklySignalsLoading}
          lang={lang}
          notifyPerm={notifyPerm}
          stockPrices={stockPrices}
          stockMap={stockMap}
          onEnableNotify={enableNotify}
          onOpenChart={setChartSymbol}
        />
      )}

      {view === 'alerts' && (
        <AlertsView
          evals={alertEvals}
          stockMap={stockMap}
          fundMap={fundMap}
          funds={funds}
          lang={lang}
          notifyPerm={notifyPerm}
          onEnableNotify={enableNotify}
          onAdd={addAlert}
          onRemove={removeAlert}
          onOpenStock={setChartSymbol}
          onOpenFund={setChartFund}
        />
      )}

      {view === 'map' && (
        <>
          <div className="status-bar">
            <span>{t(lang, 'mapIntro')}</span>
          </div>
          {overviewLoading && !overviewCache.daily ? (
            <div className="empty-box">{t(lang, 'loading')}</div>
          ) : overviewError && !overviewCache.daily ? (
            <div className="error-box">{overviewError}</div>
          ) : (
            <MarketMap
              overview={overviewCache.daily}
              market={market}
              lang={lang}
              onOpenChart={setChartSymbol}
            />
          )}
        </>
      )}

      {view === 'bubbles' && (
        <>
          <div className="status-bar">
            <span>{t(lang, 'bubblesIntro')}</span>
          </div>
          {overviewLoading && !overviewCache.daily ? (
            <div className="empty-box">{t(lang, 'loading')}</div>
          ) : overviewError && !overviewCache.daily ? (
            <div className="error-box">{overviewError}</div>
          ) : (
            <MarketBubbles
              overview={overviewCache.daily}
              market={market}
              lang={lang}
              onOpenChart={setChartSymbol}
            />
          )}
        </>
      )}

      {view === 'news' && (
        <>
          <div className="status-bar">
            <span>
              {news
                ? t(
                    lang,
                    'newsStatus',
                    news.items.length,
                    new Date(news.generated_at).toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR'),
                  )
                : ''}
            </span>
          </div>
          <NewsFeed
            news={news}
            loading={newsLoading}
            error={newsError}
            lang={lang}
            onOpenChart={setChartSymbol}
          />
          <p className="disclaimer">{t(lang, 'newsDisclaimer')}</p>
        </>
      )}

      {view === 'screener' && (
        <>
      <div className="status-bar">
        <span>
          {data
            ? t(
                lang,
                'scanStatus',
                data.scanned ?? '?',
                rows.length,
                data.generated_at
                  ? new Date(data.generated_at).toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR')
                  : '',
              )
            : loading
              ? t(lang, 'loading')
              : ''}
        </span>
        <div className="actions">
          {data?.results && (
            <button
              className={`btn ${onlyNew ? 'primary' : ''}`}
              title={t(lang, 'onlyNewHint')}
              onClick={() => setOnlyNew((v) => !v)}
            >
              ✨ {t(lang, 'onlyNew', data.results.filter((r) => r.is_new).length)}
            </button>
          )}
          {data?.stocks && (
            <button
              className={`btn ${showAllStocks ? 'primary' : ''}`}
              title={t(lang, 'showAllStocksHint')}
              onClick={() => setShowAllStocks((v) => !v)}
            >
              📋 {t(lang, 'showAllStocks', data.stocks.length)}
            </button>
          )}
          <button
            className={`btn ${onlyWatchlist ? 'primary' : ''}`}
            title="Sadece favori hisseleri göster"
            onClick={() => setOnlyWatchlist((v) => !v)}
          >
            ⭐ {t(lang, 'favorites')}
            {watchlist.size ? ` (${watchlist.size})` : ''}
          </button>
          {rows.length > 0 && (
            <ShareBar
              lang={lang}
              csv={{ filename: `tarama-${market}-${timeframe}.csv`, header: screenerCsv.header, rows: () => screenerCsv.rows() }}
              card={{
                title: t(lang, 'shareScreenerTitle'),
                subtitle: `${mLabel(activeMarket, lang)} · ${tfLabel(activeTimeframe, lang)}`,
                filename: `tarama-${market}-${timeframe}-${new Date().toISOString().slice(0, 10)}.png`,
                rows: rows.slice(0, SHARE_CARD_ROWS).map((r) => ({
                  label: displaySymbol(r.symbol),
                  value: r.score != null ? String(r.score) : '—',
                  note: r.change == null ? undefined : formatPct(r.change, 2),
                  tone: pctTone(r.change),
                })),
              }}
              shareText={t(lang, 'shareScreenerText', rows.length, mLabel(activeMarket, lang))}
              onMessage={flashShareMsg}
            />
          )}
          {STATIC_MODE ? (
            <button className="btn" disabled={loading} onClick={() => load(false)}>
              {loading && <span className="spinner" />}
              {t(lang, 'refresh')}
            </button>
          ) : (
            <>
              <button className="btn" disabled={loading} onClick={() => load(false)}>
                {t(lang, 'refreshCache')}
              </button>
              <button className="btn primary" disabled={loading} onClick={() => load(true)}>
                {loading && <span className="spinner" />}
                {t(lang, 'liveScan')}
              </button>
            </>
          )}
        </div>
      </div>

      {data?.stocks && !showAllStocks && (
        <FilterPanel
          filters={filters}
          setFilters={setFilters}
          availableEmas={availableEmas}
          isCustom={isCustom}
          lang={lang}
          sectors={availableSectors}
        />
      )}

      <details className="info-panel">
        <summary>{t(lang, 'howTitle')}</summary>
        <div className="info-content">
          <p>
            <strong>{t(lang, 'howLead1')}</strong> {t(lang, 'howBody1')}
          </p>
          <ul>
            {t(lang, 'howCriteria').map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p>{t(lang, 'howBody2')}</p>
          <p>
            <strong>{t(lang, 'howLead3')}</strong> {t(lang, 'howBody3')}
          </p>
          <p>
            <strong>{t(lang, 'howLead4')}</strong> {t(lang, 'howBody4')}
          </p>
          <p>
            <strong>{t(lang, 'howLead5')}</strong> {t(lang, 'howBody5')}
          </p>
          <p>
            <strong>{t(lang, 'howLead6')}</strong> {t(lang, 'howBody6')}
          </p>
          <p>{t(lang, 'howBody7')}</p>
        </div>
      </details>

      <details className="info-panel">
        <summary>{t(lang, 'glossTitle')}</summary>
        <div className="info-content">
          {[
            ['glossChange', 'glossChangeBody'],
            ['glossEma', 'glossEmaBody'],
            ['glossRsi', 'glossRsiBody'],
            ['glossMacd', 'glossMacdBody'],
            ['glossStoch', 'glossStochBody'],
            ['glossScore', 'glossScoreBody'],
            ['glossRs', 'glossRsBody'],
            ['glossFundamentals', 'glossFundamentalsBody'],
          ].map(([lead, body]) => (
            <p key={lead}>
              <strong>{t(lang, lead)}</strong> {t(lang, body)}
            </p>
          ))}
          {/* Temel veri kalitesi uyarısı: rakamlar ham gösteriliyor, kırpılmıyor */}
          <p className="gloss-warning">{t(lang, 'glossFundamentalsWarning')}</p>
          <p className="muted">{t(lang, 'glossFooter')}</p>
        </div>
      </details>

      {!error && rows.length > 0 && <SectorBreakdown rows={rows} lang={lang} />}

      {!error && data && (
        <div className="search-row">
          <input
            className="search-input"
            type="search"
            placeholder={t(lang, 'searchStock')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {error && <div className="error-box">{error}</div>}

      {!error && data && rows.length === 0 && (
        <div className="empty-box">
          {search.trim()
            ? t(lang, 'emptySearch', search.trim().toUpperCase())
            : isCustom
              ? t(lang, 'emptyCustom')
              : STATIC_MODE
                ? t(lang, 'emptyStatic')
                : t(lang, 'emptyLive')}
        </div>
      )}

      {!error && data && rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="star-cell"></th>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className={`sortable ${c.align === 'left' ? 'left' : ''} ${sort.key === c.key ? 'sorted' : ''}`}
                    onClick={() => toggleSort(c.key)}
                    title={t(lang, 'sortHint')}
                  >
                    {c.key === 'change'
                      ? t(lang, 'changeColLabels')[timeframe]
                      : c.key === 'relative_strength'
                        ? t(lang, 'colRsDyn', t(lang, 'rsColPeriods')[timeframe])
                        : c.i18nKey
                          ? t(lang, c.i18nKey)
                          : c.label}
                    <span className="sort-arrow">
                      {sort.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </th>
                ))}
                <th className="spark-col">{t(lang, 'colTrend')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.symbol}>
                  <td className="star-cell">
                    <button
                      className={`star-btn ${watchlist.has(r.symbol) ? 'active' : ''}`}
                      title={t(lang, watchlist.has(r.symbol) ? 'watchRemove' : 'watchAdd')}
                      onClick={() => toggleWatch(r.symbol)}
                    >
                      {watchlist.has(r.symbol) ? '★' : '☆'}
                    </button>
                  </td>
                  <td className="symbol-cell">
                    <button className="symbol-btn" onClick={() => setChartSymbol(r.symbol)}>
                      <TickerLogo symbol={r.symbol} />
                      {displaySymbol(r.symbol)}
                    </button>
                    {newSymbols.has(r.symbol) && <span className="badge new-badge">YENİ</span>}
                  </td>
                  <td>
                    <span className={`badge score-${scoreTone(r.score)}`}>{r.score ?? '—'}</span>
                  </td>
                  <td>{formatNum(r.close, 2)}</td>
                  <td className={`pct ${pctTone(r.change)}`} title={t(lang, 'colChangeTitle')}>
                    {formatPct(r.change, 2)}
                  </td>
                  <td>{formatMarketCap(r.market_cap)}</td>
                  <td
                    className={`pct ${pctTone(r.relative_strength)}`}
                    title={t(lang, 'colRsTitle')}
                  >
                    {formatPct(r.relative_strength, 1)}
                  </td>
                  <td>{formatNum(r.pe, 1)}</td>
                  <td>{formatNum(r.pb, 2)}</td>
                  <td>{formatRate(r.dividend_yield, 1)}</td>
                  <td>
                    <span className={`badge rsi-${rsiTone(r.rsi ?? 0)}`}>
                      {r.rsi == null ? '—' : formatNum(r.rsi, 1)}
                    </span>
                  </td>
                  <td>{formatNum(r.macd_line, 2)}</td>
                  <td>{formatNum(r.stoch_k, 1)}</td>
                  <td>{formatNum(r.stoch_rsi_k, 1)}</td>
                  <td className="spark-col">
                    <Sparkline points={stockPrices?.series?.[r.symbol]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="disclaimer">{t(lang, 'disclaimer')}</p>
        </>
      )}

      {/* Grafik/fon modalları ve arama paleti tek yerde: hangi sekmede olursak
          olalım (arama paletinden dahil) açılabilsinler. */}
      {chartSymbol && (
        <ChartModal
          symbol={chartSymbol}
          news={chartNews}
          lang={lang}
          series={stockPrices?.series?.[chartSymbol]}
          seriesLoading={stockPricesLoading}
          stock={chartStock}
          positions={chartPositions}
          scoreSeries={chartScoreSeries}
          dividend={chartDividend}
          fx={fx}
          onCompare={(sym) => {
            setCompareSeed([sym])
            selectView('stockCompare')
          }}
          onClose={() => setChartSymbol(null)}
        />
      )}
      {chartFund && (
        <FundModal
          fund={chartFund}
          news={chartNews}
          lang={lang}
          funds={funds}
          prices={fundPrices}
          pricesLoading={fundPricesLoading}
          onClose={() => setChartFund(null)}
          onCompare={(symbol) => {
            setCompareSeed([symbol])
            selectView('fundCompare')
          }}
        />
      )}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        overview={overviewCache.daily}
        funds={funds}
        allMarkets={activeMarkets}
        navItems={NAV_ITEMS}
        lang={lang}
        onOpenStock={setChartSymbol}
        onOpenFund={setChartFund}
        onNavigate={selectView}
      />
      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} lang={lang} />

      {/* Paylaşılan favori listesi: eklemeden ÖNCE sorulur. */}
      {watchImport && (
        <div className="watch-import" role="dialog" aria-live="polite">
          <div className="watch-import-body">
            <strong>{t(lang, 'watchImportTitle', watchImport.stocks.length + watchImport.funds.length)}</strong>
            <p>{t(lang, 'watchImportBody')}</p>
            <div className="watch-import-list">
              {[...watchImport.stocks, ...watchImport.funds].slice(0, 12).map((code) => (
                <span key={code} className="chip">{displaySymbol(code)}</span>
              ))}
            </div>
          </div>
          <div className="watch-import-actions">
            <button className="btn primary" onClick={acceptWatchImport}>
              {t(lang, 'watchImportAccept')}
            </button>
            <button className="btn" onClick={() => setWatchImport(null)}>
              {t(lang, 'watchImportDismiss')}
            </button>
          </div>
        </div>
      )}

      {shareMsg && <div className="toast" role="status">{shareMsg}</div>}
      </main>
    </div>
  )
}

export default function Root() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
}
