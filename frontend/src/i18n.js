/** Basit TR/ENG sözlük. localStorage anahtarı: `lang`. */
const STRINGS = {
  tr: {
    brand: 'Borsa Tarama',
    tagline: 'Teknik görünümü güçlü hisseler',
    tabScreener: 'Tarama',
    tabFunds: 'Fonlar',
    tabNews: 'Haberler',
    favorites: 'Favoriler',
    refresh: 'Yenile',
    refreshCache: "Cache'ten Yenile",
    liveScan: 'Canlı Tara',
    loading: 'Yükleniyor...',
    searchStock: 'Hisse ara (örn. THYAO)',
    searchFund: 'Fon ara (kod veya ad)',
    disclaimer:
      'Bu uygulama yalnızca teknik göstergelere dayalı veri sunar; yatırım tavsiyesi değildir.',
    fundDisclaimer:
      "Fon verileri TEFAS'tan alınır; geçmiş performans gelecek getiriyi garanti etmez. Yatırım tavsiyesi değildir.",
    newsDisclaimer:
      'Haber başlıkları kaynaklarına aittir ve kaynağa yönlendirir. Yatırım tavsiyesi değildir.',
    fundsHowTitle: 'TEFAS fon listesi nasıl oluşuyor?',
    fundsHowBody1:
      "Veriler resmi TEFAS (Türkiye Elektronik Fon Alım Satım Platformu) API'sinden çekilir. Listede portföy büyüklüğü 100M TRY üzeri yatırım fonları (YAT) yer alır; getiri, volatilite, Sharpe ve maksimum düşüş hesaplanır.",
    fundsHowBody2:
      '1 yıllık getiri (45) + Sharpe oranı (40) + düşük max düşüş (15). Hisse tarayıcısındaki RSI/MACD burada kullanılmaz — fonlar için asıl anlamlı olan getiri/risk metrikleridir.',
    fundsHowBody3: 'Fon koduna tıklayınca TEFAS sayfası açılır. Bu liste yatırım tavsiyesi değildir.',
    fundsStatus: (count, when) =>
      `${count} likit TEFAS yatırım fonu · Getiri / risk sıralaması${when ? ` · Güncelleme: ${when}` : ''}`,
    fundsLoading: 'Fon verisi yükleniyor...',
    fundsEmpty: "Henüz fon verisi yok. Tarama workflow'u çalışınca burada görünecek.",
    fundsNoMatch: (q) => `"${q}" için fon bulunamadı.`,
    newsStatus: (n, when) =>
      `${n} başlık · Sinyal veren hisselerin haberleri · Güncelleme: ${when}`,
    scanStatus: (scanned, passed, when) =>
      `${scanned} enstrüman tarandı, ${passed} tanesi kriterleri geçti${when ? ` · Son tarama: ${when}` : ''}`,
    emptyCustom:
      'Bu filtre ayarlarıyla hiçbir enstrüman kriterleri geçmiyor. Eşikleri gevşetmeyi veya "Varsayılana dön"ü dene.',
    emptyStatic:
      'Son taramada filtreyi geçen enstrüman çıkmadı. Sonuçlar her gün piyasa kapanışlarından sonra güncellenir.',
    emptyLive: 'Şu an filtreyi geçen enstrüman yok. "Canlı Tara" ile tekrar dene ya da daha sonra kontrol et.',
    emptySearch: (q) => `"${q}" için sonuç yok.`,
    colSymbol: 'Sembol',
    colScore: 'Puan',
    colClose: 'Kapanış',
    colMcap: 'Piyasa Değeri',
    colFund: 'Fon',
    colSize: 'Büyüklük',
    langToggle: 'EN',
  },
  en: {
    brand: 'Borsa Tarama',
    tagline: 'Stocks with strong technicals',
    tabScreener: 'Screener',
    tabFunds: 'Funds',
    tabNews: 'News',
    favorites: 'Watchlist',
    refresh: 'Refresh',
    refreshCache: 'Refresh cache',
    liveScan: 'Live scan',
    loading: 'Loading...',
    searchStock: 'Search ticker (e.g. AAPL)',
    searchFund: 'Search fund (code or name)',
    disclaimer:
      'This app shows technical-indicator data only; it is not investment advice.',
    fundDisclaimer:
      'Fund data comes from TEFAS; past performance does not guarantee future returns. Not investment advice.',
    newsDisclaimer:
      'Headlines belong to their sources and link out. Not investment advice.',
    fundsHowTitle: 'How is the TEFAS fund list built?',
    fundsHowBody1:
      'Data is pulled from the official TEFAS API. The list includes investment funds (YAT) with portfolio size over 100M TRY; returns, volatility, Sharpe and max drawdown are computed.',
    fundsHowBody2:
      '1y return (45) + Sharpe (40) + low max drawdown (15). Stock RSI/MACD are not used — return/risk metrics matter for funds.',
    fundsHowBody3: 'Click a fund code to open its TEFAS page. This list is not investment advice.',
    fundsStatus: (count, when) =>
      `${count} liquid TEFAS funds · Return / risk ranking${when ? ` · Updated: ${when}` : ''}`,
    fundsLoading: 'Loading fund data...',
    fundsEmpty: 'No fund data yet. It will appear after the scan workflow runs.',
    fundsNoMatch: (q) => `No funds matching "${q}".`,
    newsStatus: (n, when) => `${n} headlines · News for signaled tickers · Updated: ${when}`,
    scanStatus: (scanned, passed, when) =>
      `${scanned} scanned, ${passed} passed the criteria${when ? ` · Last scan: ${when}` : ''}`,
    emptyCustom:
      'No instrument passes with these filter settings. Try loosening the thresholds or "Reset to default".',
    emptyStatic:
      'No instrument passed the filter in the last scan. Results update daily after market close.',
    emptyLive: 'No instrument passes the filter right now. Try "Live scan" again or check back later.',
    emptySearch: (q) => `No results for "${q}".`,
    colSymbol: 'Symbol',
    colScore: 'Score',
    colClose: 'Close',
    colMcap: 'Market cap',
    colFund: 'Fund',
    colSize: 'AUM',
    langToggle: 'TR',
  },
}

export function getLang() {
  try {
    const stored = localStorage.getItem('lang')
    if (stored === 'en' || stored === 'tr') return stored
  } catch {
    /* ignore */
  }
  return 'tr'
}

export function setLang(lang) {
  localStorage.setItem('lang', lang)
}

export function t(lang, key, ...args) {
  const dict = STRINGS[lang] || STRINGS.tr
  const val = dict[key] ?? STRINGS.tr[key] ?? key
  return typeof val === 'function' ? val(...args) : val
}

export { STRINGS }
