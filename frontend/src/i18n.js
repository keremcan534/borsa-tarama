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
    tabBacktest: 'Strateji',
    btLoading: 'Backtest sonuçları yükleniyor...',
    btEmpty: "Bu market/zaman dilimi için backtest sonucu yok. Haftalık backtest workflow'u çalışınca burada görünecek.",
    btStatus: (signals, symbols, when) =>
      `${signals} geçmiş sinyal · ${symbols} sembol${when ? ` · Güncelleme: ${when}` : ''}`,
    btPeriod: (first, last) => `Test dönemi: ${first} – ${last}`,
    btHorizonTitle: (bars) => `Sinyalden ${bars} mum sonra`,
    btWinRate: 'Artıda kapanma',
    btAvgReturn: 'Strateji ort. getirisi',
    btMedianReturn: 'Strateji medyan getirisi',
    btBenchmark: 'Aynı dönemde endeks',
    btExcess: 'Endeks üstü fark',
    btBeatRate: 'Endeksi yenen sinyal',
    btSampleSize: (n) => `${n} sinyal üzerinden`,
    btAvgDrawdown: 'Pozisyon içi ort. en kötü nokta',
    btHowTitle: 'Bu rakamlar ne anlama geliyor?',
    btHowBody1:
      'Tarama filtresinin geçmişte kapalıdan açığa geçtiği her mum bir sinyal sayıldı. Giriş, sinyal mumunun ERTESİ mumunun açılış fiyatından varsayıldı — sinyal kapanışa baktığı için aynı mumdan almak, o an bilinmeyen bir fiyattan işlem yapmak olurdu.',
    btHowBody2:
      'İsabet oranı tek başına yanıltıcıdır: yükselen bir piyasada rastgele alım da yüksek isabet verir. Asıl soru, aynı dönemde endeksi al-tutmaktan iyi olup olmadığıdır — bu yüzden her rakamın yanında endeksin aynı penceredeki getirisi de var.',
    btCaveatsTitle: 'Sonuçları okurken dikkat',
    // JSON'daki `caveats` alanı yalnızca TR; arayüz iki dili de desteklesin diye
    // uyarılar burada tutulur.
    btCaveats: [
      'Sembol listeleri bugünün endeks üyeleridir; geçmişte endeksten çıkarılan şirketler veride yok (survivorship bias). Bu, sonuçları gerçekte olduğundan iyi gösterir.',
      'Komisyon, slipaj, temettü ve vergi hesaba katılmamıştır.',
      'Sinyaller birbirinden bağımsız değildir: aynı dönemde birçok hisse aynı anda sinyal verir, dolayısıyla örneklem sayısı göründüğü kadar güçlü bir kanıt sunmaz.',
      'Geçmiş performans gelecek getirinin garantisi değildir. Bu bir yatırım tavsiyesi değildir.',
    ],
    btTopTitle: 'Sinyalleri en iyi çalışan semboller',
    btTopNote: 'En az 3 sinyali olan semboller; en uzun ufuk üzerinden sıralı.',
    btColSignals: 'Sinyal',
    btColAvg: 'Ort. getiri',
    btColWin: 'Artıda kapanma',
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
    tabBacktest: 'Strategy',
    btLoading: 'Loading backtest results...',
    btEmpty: 'No backtest results for this market/timeframe. They appear after the weekly backtest workflow runs.',
    btStatus: (signals, symbols, when) =>
      `${signals} historical signals · ${symbols} symbols${when ? ` · Updated: ${when}` : ''}`,
    btPeriod: (first, last) => `Test period: ${first} – ${last}`,
    btHorizonTitle: (bars) => `${bars} bars after the signal`,
    btWinRate: 'Closed positive',
    btAvgReturn: 'Strategy avg return',
    btMedianReturn: 'Strategy median return',
    btBenchmark: 'Index over same window',
    btExcess: 'Excess over index',
    btBeatRate: 'Signals beating the index',
    btSampleSize: (n) => `across ${n} signals`,
    btAvgDrawdown: 'Avg worst point while held',
    btHowTitle: 'What do these numbers mean?',
    btHowBody1:
      'Every bar where the screener filter flipped from off to on counts as one signal. Entry is assumed at the OPEN of the bar AFTER the signal — the filter reads the close, so buying on the same bar would mean trading at a price not yet known.',
    btHowBody2:
      'Win rate alone is misleading: in a rising market, random buying also scores well. The real question is whether it beats buying and holding the index over the same window — which is why the index return for the same window sits next to every number.',
    btCaveatsTitle: 'Read these results with care',
    btCaveats: [
      "Symbol lists are today's index members; companies dropped from the index in the past are missing (survivorship bias). This makes results look better than reality.",
      'Commissions, slippage, dividends and taxes are not accounted for.',
      'Signals are not independent: many stocks signal at the same time in the same period, so the sample size is weaker evidence than it looks.',
      'Past performance does not guarantee future returns. This is not investment advice.',
    ],
    btTopTitle: 'Symbols whose signals worked best',
    btTopNote: 'Symbols with at least 3 signals, ranked over the longest horizon.',
    btColSignals: 'Signals',
    btColAvg: 'Avg return',
    btColWin: 'Closed positive',
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
