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
    navLabel: 'Ana menü',
    menuOpen: 'Menüyü aç/kapat',
    tabToday: 'Bugün',
    todayLoading: 'Günün özeti hazırlanıyor...',
    todayIndexes: 'Piyasa nabzı',
    todaySignals: 'Öne çıkan sinyaller',
    todaySignalsEmpty: 'Son taramada hiçbir enstrüman kriterleri geçmedi.',
    todayNewCount: (n) => `${n} yeni sinyal · en güçlü teknik görünüme göre sıralı`,
    todayNoNew:
      'Bugün yeni sinyal yok — aşağıdakiler önceki taramadan beri kriterleri sağlamaya devam ediyor.',
    todayFundsNote: 'Yatırımcı sayısına göre en çok tercih edilen fonlar.',
    todayFundReturnLabel: 'son 1 yıl',
    todayFundHolders: (n) => `${(n || 0).toLocaleString('tr-TR')} yatırımcı`,
    todayMarkets: 'Marketlere göre sinyaller',
    todayMarketLine: (passed, scanned) => `${scanned} tarandı · ${passed} sinyal`,
    todayFunds: 'Öne çıkan TEFAS fonları',
    todayNews: 'Öne çıkan haberler',
    todaySeeAll: 'Tümünü gör →',
    todayNewBadge: 'YENİ',
    todayLastScan: (when) => `Son tarama: ${when}`,
    todayIntro:
      'Günün özeti: endeksler, yeni sinyaller ve öne çıkanlar. Detay için ilgili sekmeye geç.',
    newsBist: 'BIST Haberleri',
    newsGlobal: 'Global Haberler',
    newsLoading: 'Haberler yükleniyor...',
    newsEmpty: 'Şu an gösterilecek haber yok. Haberler her taramayla birlikte yenilenir.',
    agoMinutes: (n) => `${n} dk önce`,
    agoHours: (n) => `${n} sa önce`,
    agoDays: (n) => `${n} gün önce`,
    sectorTitle: 'Sinyallerin sektör dağılımı',
    sectorHint:
      'Sinyaller tek bir sektörde yoğunlaşıyorsa liste göründüğü kadar çeşitli değildir; hepsi aynı anda düşebilir.',
    sectorUnknown: 'Diğer',
    // yfinance sektör adlarını İngilizce döner; TR arayüz için karşılıkları
    sectorLabels: {
      Industrials: 'Sanayi',
      Technology: 'Teknoloji',
      'Financial Services': 'Finans',
      'Consumer Cyclical': 'Tüketim (Döngüsel)',
      Healthcare: 'Sağlık',
      'Consumer Defensive': 'Tüketim (Temel)',
      Utilities: 'Enerji/Altyapı',
      'Basic Materials': 'Temel Malzeme',
      'Real Estate': 'Gayrimenkul',
      'Communication Services': 'İletişim',
      Energy: 'Enerji',
    },
    howTitle: 'Bu liste nasıl oluşuyor? Ne kadar süre geçerli?',
    howLead1: 'Nasıl oluşuyor?',
    howBody1:
      "Seçtiğin kategorideki tüm enstrümanlar (BIST 100'de 100 hisse, S&P 500'de ~503 hisse, ETF'ler, emtia/kripto) her iş günü piyasa kapanışından sonra otomatik taranır. Aşağıdaki kriterlerin hepsini birden sağlayanlar listeye girer, kalanlar elenir:",
    howCriteria: [
      'Fiyat 9, 21, 50 ve 200 periyotluk üstel ortalamaların (EMA) üzerinde → güçlü yükseliş trendi',
      'MACD > 0 → momentum pozitif',
      'RSI < 70, Stokastik %K < 80, Stokastik RSI < 80 → henüz aşırı alım bölgesinde değil',
      'Ortalama günlük işlem hacmi (ciro) yeterli → düşük likiditeli hisseler elenir',
    ],
    howBody2:
      'Eşikleri "Filtre Ayarları" panelinden kendine göre değiştirebilirsin — liste anında güncellenir, varsayılanlara tek tıkla dönebilirsin.',
    howLead3: 'Zaman dilimleri:',
    howBody3:
      'Aynı kriterler seçtiğin zaman diliminin mumlarıyla hesaplanır. Günlük sinyaller günler–haftalar, Haftalık sinyaller haftalar–aylar, Aylık sinyaller aylar ve ötesi ölçeğinde anlamlıdır. Uzun zaman dilimlerinde kriterleri geçen hisse sayısı doğal olarak azalır. Aylık görünümde EMA200 yerine 9/21/50 kullanılır (çoğu hissede 17 yıllık veri bulunmadığından). Haftalık ve aylık sinyaller yalnızca kapanmış mumlara dayanır: içinde bulunulan haftanın/ayın tamamlanmamış mumu hesaba katılmaz.',
    howLead4: 'Ne kadar geçerli?',
    howBody4:
      'Bunlar kapanış verisine dayalı momentum sinyalleridir; kalıcı bir "al ve unut" analizi değildir. Liste her iş günü iki kez (BIST ve ABD kapanışları sonrası) otomatik yenilenir — güncel listeyi takip etmek en sağlıklısıdır.',
    howLead5: 'Puan (0-100):',
    howBody5:
      "Tüm göstergeleri harmanlayan teknik güç puanı — trend hizası (fiyatın EMA'lara göre konumu, 40 puan), MACD momentumu (25), RSI sağlığı (20) ve stokastik alanı (15). Yüksek puan daha güçlü teknik görünüm demektir; kesinlik değil, göreli bir karşılaştırma aracıdır. Sütun başlıklarına tıklayarak sıralayabilir, arama kutusuyla hisse bulabilirsin.",
    howLead6: 'Göreli Güç:',
    howBody6:
      'Hissenin son dönem getirisinden endeksin aynı dönemdeki getirisi çıkarılır. Artı değer hissenin endeksi geçtiğini, eksi değer yükselse bile piyasanın gerisinde kaldığını gösterir — yükselen bir piyasada her şey yükseldiği için bu ayrım önemlidir.',
    howBody7: 'Hisse koduna tıklayarak grafiği sayfadan ayrılmadan açabilirsin.',
    glossTitle: '📖 Göstergeler ne anlama geliyor?',
    glossEma: 'EMA (Üstel Hareketli Ortalama):',
    glossEmaBody:
      "Fiyatın belirli bir süredeki ortalaması; son günlere daha çok ağırlık verir. Kısa periyot (9, 21) yakın trendi, uzun periyot (50, 200) ana trendi gösterir. Fiyatın EMA'ların üstünde olması \"yukarı trend\" işaretidir.",
    glossRsi: 'RSI (Göreceli Güç Endeksi, 0-100):',
    glossRsiBody:
      'Fiyatın son 14 periyotta ne kadar hızlı yükselip düştüğünü ölçer. 70 üstü genelde "aşırı alım" (fazla ısınmış, düzeltme gelebilir), 30 altı "aşırı satım" olarak yorumlanır. Biz 70 altını arıyoruz — yükselen ama henüz aşırı ısınmamış.',
    glossMacd: 'MACD:',
    glossMacdBody:
      "İki hareketli ortalamanın farkı; momentumun yönünü ve gücünü gösterir. MACD'nin sıfırın üstünde olması kısa vadeli momentumun pozitif (yukarı) olduğunu söyler.",
    glossStoch: 'Stokastik %K ve Stokastik RSI:',
    glossStochBody:
      "Fiyatın (veya RSI'ın) son dönemdeki en yüksek–en düşük aralığında nerede durduğunu 0-100 arası ölçer. 80 üstü aşırı alım bölgesidir. İkisini de 80 altında tutarak \"yükselişte ama tepe yapmamış\" enstrümanları seçiyoruz.",
    glossScore: 'Puan (0-100):',
    glossScoreBody:
      'Yukarıdaki göstergelerin hepsini tek sayıya indiren özet; ne kadar yüksekse teknik görünüm o kadar güçlü. Karşılaştırma kolaylığı içindir, kesin bir tahmin değildir.',
    glossRs: 'Göreli Güç:',
    glossRsBody:
      'Hisse endeksten ne kadar iyi/kötü? Getiriden endeks getirisi çıkarılır. Momentum filtresini geçen bir hisse bile endeksin gerisinde olabilir; bu kolon onu görünür kılar.',
    glossFooter:
      'Bu göstergeler geçmiş fiyat hareketine dayanır; geleceği garanti etmez. Teknik analiz olasılık üzerine kuruludur, kesinlik üzerine değil.',
    filterTitle: 'Filtre Ayarları',
    filterCustom: 'özel',
    filterOverbought: 'Aşırı alım eşikleri',
    filterTrend: 'Trend şartları',
    filterReset: 'Varsayılana dön',
    filterStochK: 'Stokastik %K',
    filterStochRsiK: 'Stokastik RSI %K',
    filterPriceAbove: (p) => `Fiyat > EMA${p}`,
    sortHint: 'Sıralamak için tıkla',
    watchAdd: 'Favorilere ekle',
    watchRemove: 'Favorilerden çıkar',
    colRs: 'Göreli Güç',
    colRsTitle:
      'Hissenin son dönemdeki getirisi eksi endeksin aynı dönemdeki getirisi. Artı: hisse endeksi geçiyor. Eksi: yükseliyor ama piyasanın gerisinde.',
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
    btPfTitle: (capital, cur) => `${capital} ${cur} ile bu sinyalleri takip etseydin?`,
    btPfStrategy: 'Strateji portföyü (medyan)',
    btPfBenchmark: 'Endeksi al ve tut',
    btPfRange: (lo, hi) => `Şansa bağlı aralık: ${lo} – ${hi}`,
    // "X'i/ı/si/ü" eki sayının OKUNUŞUNA göre değişir (0'ı, 2'si, 3'ü, 25'i);
    // şablonla doğrusunu üretmek mümkün değil, bu yüzden ek gerektirmeyen kalıp.
    btPfBeat: (won, total) => `${won}/${total} koşu endeksi yendi`,
    btPfRules: (positions, bars, taken, skipped) =>
      `Kurallar: en fazla ${positions} eşit ağırlıklı pozisyon, her biri ${bars} mum tutuluyor. ${taken} işlem açıldı, ${skipped} sinyal kapasite dolu olduğu için atlandı.`,
    btPfDrawdown: 'Portföyün tepeden en büyük düşüşü',
    btPfWhyRange:
      'Neden tek bir rakam değil de aralık? Kapasite dolduğunda sinyallerin çoğu atlanır, yani sonuç hangi sinyali seçtiğine bağlıdır. Aynı strateji 25 kez farklı rastgele seçimlerle koşturuldu; tek bir rakam bu şansı gizlerdi. Güvenilir olan yön: koşuların tamamına yakını endeksi yeniyor — büyüklük ise şansa bağlı.',
    btPfNote: 'Komisyon, slipaj ve vergi yok. Geçmiş veriyle yapılmış varsayımsal bir simülasyondur; yatırım tavsiyesi değildir.',
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
    navLabel: 'Main menu',
    menuOpen: 'Toggle menu',
    tabToday: 'Today',
    todayLoading: "Building today's summary...",
    todayIndexes: 'Market pulse',
    todaySignals: 'Standout signals',
    todaySignalsEmpty: 'No instrument passed the criteria in the last scan.',
    todayNewCount: (n) => `${n} new signals · ranked by strongest technical picture`,
    todayNoNew:
      'No new signals today — the names below have kept meeting the criteria since the previous scan.',
    todayFundsNote: 'The most widely held funds, by number of investors.',
    todayFundReturnLabel: 'last 1 year',
    todayFundHolders: (n) => `${(n || 0).toLocaleString('en-US')} investors`,
    todayMarkets: 'Signals by market',
    todayMarketLine: (passed, scanned) => `${scanned} scanned · ${passed} signals`,
    todayFunds: 'Standout TEFAS funds',
    todayNews: 'Top headlines',
    todaySeeAll: 'See all →',
    todayNewBadge: 'NEW',
    todayLastScan: (when) => `Last scan: ${when}`,
    todayIntro:
      "Today at a glance: indices, new signals and standouts. Switch to a tab for the detail.",
    newsBist: 'BIST news',
    newsGlobal: 'Global news',
    newsLoading: 'Loading news...',
    newsEmpty: 'No news to show right now. News refreshes with every scan.',
    agoMinutes: (n) => `${n}m ago`,
    agoHours: (n) => `${n}h ago`,
    agoDays: (n) => `${n}d ago`,
    sectorTitle: 'Sector mix of the signals',
    sectorHint:
      'If the signals cluster in one sector, the list is less diversified than it looks — they can all fall together.',
    sectorUnknown: 'Other',
    sectorLabels: {}, // yfinance zaten İngilizce döner
    howTitle: 'How is this list built? How long is it valid?',
    howLead1: 'How is it built?',
    howBody1:
      'Every instrument in the selected category (100 stocks in BIST 100, ~503 in the S&P 500, ETFs, commodities/crypto) is scanned automatically after each trading day closes. Only instruments meeting all of the criteria below make the list:',
    howCriteria: [
      'Price above the 9, 21, 50 and 200 period exponential moving averages (EMA) → strong uptrend',
      'MACD > 0 → positive momentum',
      'RSI < 70, Stochastic %K < 80, Stochastic RSI < 80 → not overbought yet',
      'Sufficient average daily turnover → illiquid stocks are filtered out',
    ],
    howBody2:
      'You can change the thresholds in the "Filter settings" panel — the list updates instantly, and one click restores the defaults.',
    howLead3: 'Timeframes:',
    howBody3:
      'The same criteria are computed on the candles of the selected timeframe. Daily signals matter on a days–weeks scale, Weekly on weeks–months, Monthly on months and beyond. Naturally fewer stocks pass on longer timeframes. The monthly view uses 9/21/50 instead of EMA200 (most stocks lack 17 years of data). Weekly and monthly signals rely only on closed candles: the current unfinished week/month is excluded.',
    howLead4: 'How long is it valid?',
    howBody4:
      'These are momentum signals based on closing data, not a lasting "buy and forget" analysis. The list refreshes automatically twice each business day (after the BIST and US closes) — following the current list is the sensible approach.',
    howLead5: 'Score (0-100):',
    howBody5:
      'A technical strength score blending every indicator — trend alignment (price versus the EMAs, 40 points), MACD momentum (25), RSI health (20) and stochastic room (15). A higher score means a stronger technical picture; it is a relative comparison tool, not a certainty. Click column headers to sort, or use the search box to find a ticker.',
    howLead6: 'Relative strength:',
    howBody6:
      "The index return over the same window is subtracted from the stock's return. A positive value means the stock is beating the index; a negative one means it is rising but lagging the market — an important distinction, since in a rising market everything goes up.",
    howBody7: 'Click a ticker to open its chart without leaving the page.',
    glossTitle: '📖 What do the indicators mean?',
    glossEma: 'EMA (Exponential Moving Average):',
    glossEmaBody:
      'The average price over a period, weighting recent days more heavily. Short periods (9, 21) show the near-term trend, long ones (50, 200) the main trend. Price above the EMAs signals an uptrend.',
    glossRsi: 'RSI (Relative Strength Index, 0-100):',
    glossRsiBody:
      'Measures how fast price has risen or fallen over the last 14 periods. Above 70 is usually read as "overbought" (overheated, a pullback may follow), below 30 as "oversold". We look for below 70 — rising but not yet overheated.',
    glossMacd: 'MACD:',
    glossMacdBody:
      'The difference between two moving averages; it shows the direction and strength of momentum. MACD above zero means short-term momentum is positive.',
    glossStoch: 'Stochastic %K and Stochastic RSI:',
    glossStochBody:
      'Measures where price (or RSI) sits within its recent high–low range, on a 0-100 scale. Above 80 is the overbought zone. Keeping both below 80 selects instruments that are rising but have not topped out.',
    glossScore: 'Score (0-100):',
    glossScoreBody:
      'A summary reducing all the indicators above to a single number; the higher it is, the stronger the technical picture. It exists for easy comparison, not as a precise forecast.',
    glossRs: 'Relative strength:',
    glossRsBody:
      "How much better or worse than the index? The index return is subtracted from the stock's. Even a stock passing the momentum filter can lag the index; this column makes that visible.",
    glossFooter:
      'These indicators are based on past price action and guarantee nothing about the future. Technical analysis is built on probability, not certainty.',
    filterTitle: 'Filter settings',
    filterCustom: 'custom',
    filterOverbought: 'Overbought thresholds',
    filterTrend: 'Trend conditions',
    filterReset: 'Reset to default',
    filterStochK: 'Stochastic %K',
    filterStochRsiK: 'Stochastic RSI %K',
    filterPriceAbove: (p) => `Price > EMA${p}`,
    sortHint: 'Click to sort',
    watchAdd: 'Add to watchlist',
    watchRemove: 'Remove from watchlist',
    colRs: 'Rel. strength',
    colRsTitle:
      "The stock's recent return minus the index return over the same window. Positive: it is beating the index. Negative: rising, but lagging the market.",
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
    btPfTitle: (capital, cur) => `What if you had followed these signals with ${capital} ${cur}?`,
    btPfStrategy: 'Strategy portfolio (median)',
    btPfBenchmark: 'Buy and hold the index',
    btPfRange: (lo, hi) => `Luck-dependent range: ${lo} – ${hi}`,
    btPfBeat: (won, total) => `${won}/${total} runs beat the index`,
    btPfRules: (positions, bars, taken, skipped) =>
      `Rules: at most ${positions} equally weighted positions, each held ${bars} bars. ${taken} trades opened, ${skipped} signals skipped because capacity was full.`,
    btPfDrawdown: 'Portfolio max drawdown from peak',
    btPfWhyRange:
      'Why a range instead of one number? When capacity is full most signals are skipped, so the result depends on which ones you pick. The same strategy was run 25 times with different random picks; a single number would hide that luck. What is reliable is the direction: nearly all runs beat the index — the magnitude is luck.',
    btPfNote: 'No commissions, slippage or taxes. A hypothetical simulation on historical data; not investment advice.',
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
