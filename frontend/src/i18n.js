/** Basit TR/ENG sözlük. localStorage anahtarı: `lang`. */
const STRINGS = {
  tr: {
    brand: 'Borsa Tarama',
    tagline: 'Teknik görünümü güçlü hisseler',
    tabScreener: 'Tarama',
    tabFunds: 'Fonlar',
    tabFundCompare: 'Fon Karşılaştır',
    tabStockCompare: 'Hisse Karşılaştır',
    tabStockPositions: 'Hisse Pozisyonları',
    tabNews: 'Haberler',
    stockCompareIntro:
      'Seçtiğin BIST hisselerini aynı dönemde yan yana gör: normalize getiri eğrisi, USD bazı ve teknik metrikler.',
    stockComparePick: 'Hisse seç',
    stockCompareSearch: 'Hisse ara (kod)',
    stockCompareEmpty: 'Karşılaştırılacak hisse verisi yok. Önce tarama çalışmalı.',
    stockCompareNoPrices:
      'Fiyat serileri henüz üretilmedi. Sonraki tarama sonrası grafik burada görünecek; metrik tablosu yine çalışır.',
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
    fundsHowBody3:
      'Fon koduna tıklayınca sitede getiri grafiği ve haberler açılır; TEFAS sayfasına modal içinden geçebilirsin. Bu liste yatırım tavsiyesi değildir.',
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
    colTrend: 'Trend (3A)',
    emaHint: 'EMA 20/50/200 katmanlarını göster/gizle. Kısa vadeli çizgi uzun vadeliyi yukarı keserse trend güçlenir.',
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
    todayFundTodayLabel: 'bugün',
    todayFundReturnLabel: 'son 1 yıl',
    todayFundHolders: (n) => `${(n || 0).toLocaleString('tr-TR')} yatırımcı`,
    changeTitle: 'Değişim raporu — düne göre',
    changeRange: (from, to) => `${from} → ${to} arası skor ve sinyal hareketleri.`,
    changeRisers: 'Skoru en çok yükselen',
    changeFallers: 'Skoru en çok düşen',
    changePoint: 'puan',
    changeEntered: 'Sinyale yeni girenler',
    changeDropped: 'Sinyalden çıkanlar',
    sectorHeatTitle: 'Sektör ısı haritası',
    sectorHeatHint: 'Taranan hisselerin sektör bazında bugünkü ortalama değişimi. Koyu yeşil = güçlü sektör.',
    sectorHeatCount: (n, up, down) => `${n} hisse · ${up}↑ ${down}↓`,
    todayMarkets: 'Marketlere göre sinyaller',
    todayMarketLine: (passed, scanned) => `${scanned} tarandı · ${passed} sinyal`,
    fundChartLabel: 'Dönem getirileri',
    fundPriceTitle: 'Fiyat grafiği (pay değeri)',
    fundPriceChartLabel: 'Fon fiyat grafiği',
    fundModalNews: 'Son haberler',
    fundModalNewsEmpty: 'Bu fon için şu an haber yok.',
    fundCompareAction: 'Karşılaştır',
    fundCompareIntro:
      'Seçtiğin fonları aynı dönemde yan yana gör: normalize getiri eğrisi, benchmark ve risk metrikleri.',
    fundCompareLoading: 'Karşılaştırma verisi yükleniyor...',
    fundComparePick: 'Fon seç',
    fundComparePickHint: (n, max) => `${n}/${max} seçildi`,
    fundCompareChartTitle: 'Getiri eğrisi (dönem başı = 100)',
    fundCompareChartLabel: 'Fon karşılaştırma grafiği',
    fundCompareBench: 'Benchmark',
    fcUsdBase: 'USD bazında',
    fcUsdBaseHint:
      'Eğrileri günlük USD/TRY kuruna bölerek dolar cinsinden gösterir: nominal TL getirisi yerine reel performans.',
    fcOverlapTitle: 'Portföy örtüşmesi (KAP)',
    fcOverlapHint:
      'İki fonun son açıklanan portföylerinde aynı hisselere verdiği ortak ağırlık. Yüksek örtüşme, iki fonu birden almanın çeşitlendirme sağlamadığı anlamına gelir.',
    fcOverlapStock: 'Hisse',
    fcOverlapMissing: (codes) => `KAP portföy verisi bulunamayan fonlar: ${codes} (hisse dışı fon olabilir).`,
    fundCompareMetrics: 'Metrikler',
    fundCompareMetricCol: 'Metrik',
    fundCompareNoChart: 'Bu dönem için çizilecek yeterli veri yok.',
    fundCompareNoPrices:
      'Fiyat serileri henüz üretilmedi. Sonraki tarama sonrası grafik burada görünecek; metrik tablosu yine çalışır.',
    fundCompareNeedFunds: 'Grafik için en az bir fon seç.',
    stockPositionsIntro:
      'Bir BIST hissesini hangi fonların taşıdığını, fon içi ağırlığını ve aylık değişimini incele.',
    stockPositionsLoading: 'Hisse pozisyonları yükleniyor...',
    stockPositionsUpdated: (when) => `Güncelleme: ${when}`,
    stockPositionsPick: 'Hisse seç',
    stockPositionsSearch: 'Hisse kodu veya şirket adı ara (örn. THYAO)',
    stockPositionsNoDataTitle: 'Hisse pozisyon verisi henüz yok.',
    stockPositionsNoData:
      'KAP portföy raporları işlendikten sonra taşıyan fonlar ve aylık pozisyonlar burada görünecek.',
    stockPositionsWeight: 'Fon içi ağırlık',
    stockPositionsShares: 'Pay adedi',
    stockPositionsCarrying: 'Taşıyan fon',
    stockPositionsAverage: 'Ortalama ağırlık',
    stockPositionsIncreasing: 'Pozisyon artıran',
    stockPositionsDecreasing: 'Pozisyon azaltan',
    stockPositionsNet: 'Net fon eğilimi',
    stockPositionsMatrix: 'Aylık pozisyon matrisi',
    stockPositionsNewestFirst: 'Yeni → Eski',
    stockPositionsOldestFirst: 'Eski → Yeni',
    stockPositionsLatest: 'Son değer',
    stockPositionsTrend: 'Eğilim',
    stockPositionsDisclaimer:
      'Veriler fonların aylık KAP portföy dağılım raporlarından işlenir. Güncel ayda eksik bildirimler olabilir; yatırım tavsiyesi değildir.',
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
      "Seçtiğin kategorideki tüm enstrümanlar (BIST 100'de 100 hisse, S&P 500'de ~503 hisse, emtia/kripto) her iş günü piyasa kapanışından sonra otomatik taranır. Aşağıdaki kriterlerin hepsini birden sağlayanlar listeye girer, kalanlar elenir:",
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
    howLead6: 'Bugün ve Endeks Farkı (3a):',
    howBody6:
      '"Bugün" kolonu son kapanışın bir öncekine göre değişimidir. "Endeks Farkı (3a)" ise hissenin son 3 ayda endeksten ne kadar iyi gittiğini söyler: hisse %30, BIST 100 %20 kazandırdıysa fark +%10\'dur. Yükselen bir piyasada zaten her şey yükseldiğinden, asıl soru hissenin piyasayı geçip geçmediğidir. Eksi değer hissenin düştüğü anlamına gelmez — yükselmiş ama endeksten az yükselmiş olabilir.',
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
    glossChange: 'Bugün:',
    glossChangeBody:
      'Son kapanışın bir önceki kapanışa göre yüzde değişimi — yani günün getirisi. Haftalık/aylık görünümde o mumun değişimini gösterir.',
    glossRs: 'Endeks Farkı (3a):',
    glossRsBody:
      'Hisse son 3 ayda endeksten ne kadar iyi gitti? Örnek: hisse %30, BIST 100 %20 kazandırdıysa fark +%10 olur. Neden önemli: yükselen bir piyasada zaten her şey yükselir, asıl soru hissenin piyasayı geçip geçmediğidir. Momentum filtresini geçen bir hisse bile endeksin gerisinde kalabilir — bu kolon onu görünür kılar. Eksi değer hissenin düştüğü anlamına GELMEZ; yükselmiş ama endeksten az yükselmiş olabilir.',
    glossFooter:
      'Bu göstergeler geçmiş fiyat hareketine dayanır; geleceği garanti etmez. Teknik analiz olasılık üzerine kuruludur, kesinlik üzerine değil.',
    filterTitle: 'Filtre Ayarları',
    filterCustom: 'özel',
    filterOverbought: 'Aşırı alım eşikleri',
    filterTrend: 'Trend şartları',
    filterReset: 'Varsayılana dön',
    presetsLabel: 'Hazır şablonlar:',
    presetStrong: 'Güçlü trend',
    presetStrongHint: 'Fiyat tüm EMA’ların üstünde ve MACD pozitif; aşırı alım sınırı gevşek.',
    presetMomentum: 'Yeni momentum',
    presetMomentumHint: 'Kısa vadeli EMA’ların üstünde, MACD pozitif, henüz aşırı alımda değil.',
    presetOversold: 'Aşırı satım',
    presetOversoldHint: 'Düşük RSI ve stokastik: tepki adayı hisseler (trend şartı yok).',
    filterStochK: 'Stokastik %K',
    filterStochRsiK: 'Stokastik RSI %K',
    filterPriceAbove: (p) => `Fiyat > EMA${p}`,
    sortHint: 'Sıralamak için tıkla',
    watchAdd: 'Favorilere ekle',
    watchRemove: 'Favorilerden çıkar',
    tabWatchlist: 'İzlediklerim',
    watchlistIntro:
      'Yıldızladığın hisse ve fonlar tek sayfada. Eklemek için Tarama ve Fonlar sekmelerindeki ☆ işaretini kullan.',
    watchlistEmpty:
      'Henüz favorin yok. Tarama sekmesinde bir hissenin, Fonlar sekmesinde bir fonun yanındaki ☆ yıldıza tıklayarak buraya ekleyebilirsin.',
    watchlistStocks: 'Hisseler',
    watchlistFunds: 'Fonlar',
    watchlistNotInScan: 'bugünkü taramada yok',
    watchOnlyFundsHint: 'Sadece favori fonları göster',
    tabPortfolio: 'Portföyüm',
    pfIntro:
      'Fon ve BIST hissesi alımlarını gir, güncel fiyatla kâr/zararını takip et. Veriler yalnızca bu tarayıcıda saklanır.',
    pfFund: 'Fon',
    pfFundPh: 'Fon kodu (ör. TTE)',
    pfSymbol: 'Fon / Hisse',
    pfSymbolPh: 'Kod (ör. TTE veya THYAO)',
    pfDate: 'Alış tarihi',
    pfPrice: 'Alış fiyatı (₺)',
    pfQty: 'Adet',
    pfAdd: 'Ekle',
    pfEmpty: 'Henüz pozisyon yok. Yukarıdan ilk fon alımını ekle.',
    pfCost: 'Maliyet',
    pfCurrent: 'Güncel',
    pfValue: 'Değer',
    pfTotal: 'Toplam',
    pfRemove: 'Pozisyonu sil',
    pfMissing: (n) => ` (${n} pozisyonun güncel fiyatı yok, toplama katılmadı)`,
    pfErrSymbol: 'Fon kodu gir.',
    pfErrUnknown: (s) => `${s} taranan fon/hisseler arasında yok; kodu kontrol et.`,
    pfErrPrice: 'Geçerli bir alış fiyatı gir (boş bırakırsan o günkü fiyat önerilir).',
    pfErrQty: 'Geçerli bir adet gir.',
    pfDisclaimer:
      'Portföy verileri yalnızca bu cihazın tarayıcısında saklanır; sunucuya gönderilmez. Yatırım tavsiyesi değildir.',
    pfChartTitle: 'Portföy gelişimi',
    pfChartLabel: 'Portföy değer grafiği',
    pfLineValue: 'Portföy',
    pfLineCost: 'Maliyet',
    pfLineBench: (label) => `${label} alsaydın`,
    pfBenchHint: (label) =>
      `Aynı tutarları aynı tarihlerde ${label} almak için kullansaydın portföyün bugün ne ederdi?`,
    bkTitle: 'Yedekleme',
    bkHint:
      'Favoriler ve portföy yalnızca bu tarayıcıda durur. Başka cihaza taşımak için dışa aktarıp orada içe aktar; içe aktarma mevcut verinin üzerine yazmaz, birleştirir.',
    bkExport: 'Dışa aktar (JSON)',
    bkImport: 'İçe aktar',
    bkExported: 'Yedek dosyası indirildi.',
    bkImportErr: 'Dosya okunamadı: geçerli bir Borsa Tarama yedeği değil.',
    flowTitle: 'Fon akışı — yatırımcı sayısı değişimi',
    flowGainers: 'En çok yatırımcı kazanan',
    flowLosers: 'En çok yatırımcı kaybeden',
    flowRange: (from, to) => `${from} → ${to} arası değişim. Yatırımcı sayısı paranın yönü için yaklaşık bir göstergedir.`,
    stockChartPending:
      'Fiyat grafiği bir sonraki taramayla birlikte burada görünecek. Şimdilik TradingView bağlantısını kullanabilirsin.',
    colChange: 'Bugün',
    colInvestors: 'Yatırımcı',
    colChangeTitle: 'Son kapanışın bir önceki kapanışa göre değişimi.',
    // Değişim kolonu her zaman diliminde SON KAPANMIŞ mumun değişimidir; günlükte
    // bu "bugün"dür ama haftalıkta son tamamlanan haftadır — "Bugün" yazamayız.
    changeColLabels: { daily: 'Bugün', weekly: 'Son Hafta', monthly: 'Son Ay', quarterly: 'Son Çeyrek' },
    // Endeks farkı penceresi rs_bars'a bağlı: günlük 60 mum ≈ 3 ay, haftalık 26 ≈ 6 ay,
    // aylık 12 = 1 yıl, çeyreklik 4 = 1 yıl (app/screener/timeframes.py ile senkron).
    rsColPeriods: { daily: '3a', weekly: '6a', monthly: '1y', quarterly: '1y' },
    colRsDyn: (p) => `Endeks Farkı (${p})`,
    // Kolon adı dönemi taşımalı: çıplak bir "+%30", fiyatın yanında bugünün
    // getirisi sanılıyordu. Açıklama da somut sayıyla — soyut tanım anlaşılmıyordu.
    colRs: 'Endeks Farkı (3a)',
    colRsTitle:
      'Son 3 ayda hisse, endeksten ne kadar iyi? Örnek: hisse %30 kazandırdı, BIST 100 aynı dönemde %20 kazandırdıysa fark +%10 olur. Artı = hisse piyasayı geçmiş, eksi = yükselse bile piyasanın gerisinde kalmış.',
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
    // Global arama paleti (⌘K)
    cmdkTrigger: 'Ara',
    cmdkPlaceholder: 'Hisse veya fon ara…',
    cmdkStocks: 'Hisseler',
    cmdkFunds: 'Fonlar',
    cmdkEmpty: (q) => `"${q}" için sonuç yok`,
    cmdkHintType: 'Aramak için yazmaya başla — hisse kodu veya fon adı',
    cmdkNav: 'gez',
    cmdkSelect: 'aç',
    cmdkClose: 'kapat',
    cmdkLoading: 'Arama verisi yükleniyor…',
    // Tema geçişi
    themeLabel: 'Tema',
    themeLight: 'Açık',
    themeDark: 'Koyu',
    themeSystem: 'Sistem',
    // Piyasa hareketlileri
    moversTitle: 'Piyasa hareketlileri',
    moversHint: 'Son taramada bugün en çok yükselen ve düşen hisseler.',
    moversGainers: 'Yükselenler',
    moversLosers: 'Düşenler',
    // Piyasa ısı haritası (treemap)
    tabMap: 'Harita',
    mapIntro:
      'Piyasa değeri ağırlıklı ısı haritası: kutu alanı piyasa değerini, renk bugünkü değişimi gösterir. Sektöre göre gruplu — bir kutuya tıkla, grafiği açılsın.',
    mapEmpty: 'Harita için yeterli veri yok. Önce tarama çalışmalı.',
    mapLegendDown: 'Düşüş',
    mapLegendUp: 'Yükseliş',
    mapSizeNote: 'Kutu alanı ∝ piyasa değeri',
  },
  en: {
    brand: 'Borsa Tarama',
    tagline: 'Stocks with strong technicals',
    tabScreener: 'Screener',
    tabFunds: 'Funds',
    tabFundCompare: 'Compare Funds',
    tabStockCompare: 'Compare Stocks',
    stockCompareIntro:
      'Compare BIST stocks side by side over the same period: normalized return curve, USD basis and technical metrics.',
    stockComparePick: 'Pick stocks',
    stockCompareSearch: 'Search stock (code)',
    stockCompareEmpty: 'No stock data to compare. Run a scan first.',
    stockCompareNoPrices:
      'Price series not generated yet. The chart will appear after the next scan; the metric table still works.',
    tabStockPositions: 'Stock Positions',
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
    fundsHowBody3:
      'Click a fund code to open its return chart and news on this site; TEFAS is available from the modal. This list is not investment advice.',
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
    colTrend: 'Trend (3M)',
    emaHint: 'Toggle EMA 20/50/200 overlays. When the short line crosses above the long one, the trend strengthens.',
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
    todayFundTodayLabel: 'today',
    todayFundReturnLabel: 'last 1 year',
    todayFundHolders: (n) => `${(n || 0).toLocaleString('en-US')} investors`,
    changeTitle: 'Change report — vs yesterday',
    changeRange: (from, to) => `Score and signal moves between ${from} → ${to}.`,
    changeRisers: 'Biggest score gainers',
    changeFallers: 'Biggest score losers',
    changePoint: 'pts',
    changeEntered: 'Newly entered signals',
    changeDropped: 'Dropped from signals',
    sectorHeatTitle: 'Sector heatmap',
    sectorHeatHint: 'Average daily change of scanned stocks by sector. Deeper green = stronger sector.',
    sectorHeatCount: (n, up, down) => `${n} stocks · ${up}↑ ${down}↓`,
    todayMarkets: 'Signals by market',
    todayMarketLine: (passed, scanned) => `${scanned} scanned · ${passed} signals`,
    fundChartLabel: 'Period returns',
    fundPriceTitle: 'Price chart (NAV)',
    fundPriceChartLabel: 'Fund price chart',
    fundModalNews: 'Latest news',
    fundModalNewsEmpty: 'No news for this fund right now.',
    fundCompareAction: 'Compare',
    fundCompareIntro:
      'Compare selected funds over the same window: normalized return curves, benchmarks and risk metrics.',
    fundCompareLoading: 'Loading comparison data...',
    fundComparePick: 'Pick funds',
    fundComparePickHint: (n, max) => `${n}/${max} selected`,
    fundCompareChartTitle: 'Return curve (period start = 100)',
    fundCompareChartLabel: 'Fund comparison chart',
    fundCompareBench: 'Benchmarks',
    fcUsdBase: 'In USD',
    fcUsdBaseHint:
      'Divides the curves by the daily USD/TRY rate to show dollar-based (real) performance instead of nominal TL returns.',
    fcOverlapTitle: 'Portfolio overlap (KAP)',
    fcOverlapHint:
      'Shared weight the funds give to the same stocks in their latest disclosed portfolios. High overlap means holding both funds adds little diversification.',
    fcOverlapStock: 'Stock',
    fcOverlapMissing: (codes) => `No KAP portfolio data for: ${codes} (may not be equity funds).`,
    fundCompareMetrics: 'Metrics',
    fundCompareMetricCol: 'Metric',
    fundCompareNoChart: 'Not enough data to chart this period.',
    fundCompareNoPrices:
      'Price series are not built yet. Charts appear after the next scan; the metrics table still works.',
    fundCompareNeedFunds: 'Select at least one fund for the chart.',
    stockPositionsIntro:
      'See which funds hold a BIST stock, its weight inside each fund and monthly changes.',
    stockPositionsLoading: 'Loading stock positions...',
    stockPositionsUpdated: (when) => `Updated: ${when}`,
    stockPositionsPick: 'Pick a stock',
    stockPositionsSearch: 'Search ticker or company (e.g. THYAO)',
    stockPositionsNoDataTitle: 'No stock-position data yet.',
    stockPositionsNoData:
      'Holding funds and monthly positions will appear after KAP portfolio reports are processed.',
    stockPositionsWeight: 'Weight in fund',
    stockPositionsShares: 'Share count',
    stockPositionsCarrying: 'Holding funds',
    stockPositionsAverage: 'Average weight',
    stockPositionsIncreasing: 'Increasing',
    stockPositionsDecreasing: 'Decreasing',
    stockPositionsNet: 'Net fund trend',
    stockPositionsMatrix: 'Monthly position matrix',
    stockPositionsNewestFirst: 'Newest → Oldest',
    stockPositionsOldestFirst: 'Oldest → Newest',
    stockPositionsLatest: 'Latest',
    stockPositionsTrend: 'Trend',
    stockPositionsDisclaimer:
      'Data is processed from monthly KAP portfolio-allocation reports. The latest month may be incomplete; not investment advice.',
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
      'Every instrument in the selected category (100 stocks in BIST 100, ~503 in the S&P 500, commodities/crypto) is scanned automatically after each trading day closes. Only instruments meeting all of the criteria below make the list:',
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
    howLead6: 'Today and vs Index (3m):',
    howBody6:
      'The "Today" column is the last close versus the previous one. "vs Index (3m)" tells you how much better the stock did than the index over the last 3 months: if the stock gained 30% and the BIST 100 gained 20%, the difference is +10%. Since everything rises in a rising market, the real question is whether the stock beat the market. A negative value does not mean the stock fell — it may have risen, just less than the index.',
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
    glossChange: 'Today:',
    glossChangeBody:
      "The last close's percentage change versus the previous close — the day's return. On weekly/monthly views it shows that candle's change.",
    glossRs: 'vs Index (3m):',
    glossRsBody:
      'How much better than the index over the last 3 months? Example: the stock gained 30% while the BIST 100 gained 20% → +10%. Why it matters: in a rising market everything rises; the real question is whether the stock beat the market. Even a stock passing the momentum filter can lag the index — this column makes that visible. A negative value does NOT mean the stock fell; it may have risen, just less than the index.',
    glossFooter:
      'These indicators are based on past price action and guarantee nothing about the future. Technical analysis is built on probability, not certainty.',
    filterTitle: 'Filter settings',
    filterCustom: 'custom',
    filterOverbought: 'Overbought thresholds',
    filterTrend: 'Trend conditions',
    filterReset: 'Reset to default',
    presetsLabel: 'Presets:',
    presetStrong: 'Strong trend',
    presetStrongHint: 'Price above all EMAs and MACD positive; loose overbought cap.',
    presetMomentum: 'New momentum',
    presetMomentumHint: 'Above short-term EMAs, MACD positive, not yet overbought.',
    presetOversold: 'Oversold',
    presetOversoldHint: 'Low RSI and stochastic: bounce candidates (no trend requirement).',
    filterStochK: 'Stochastic %K',
    filterStochRsiK: 'Stochastic RSI %K',
    filterPriceAbove: (p) => `Price > EMA${p}`,
    sortHint: 'Click to sort',
    watchAdd: 'Add to watchlist',
    watchRemove: 'Remove from watchlist',
    tabWatchlist: 'Watchlist',
    watchlistIntro:
      'Your starred stocks and funds in one place. Use the ☆ icon in the Screener and Funds tabs to add more.',
    watchlistEmpty:
      'No favorites yet. Click the ☆ star next to a stock in the Screener tab or a fund in the Funds tab to add it here.',
    watchlistStocks: 'Stocks',
    watchlistFunds: 'Funds',
    watchlistNotInScan: 'not in today’s scan',
    watchOnlyFundsHint: 'Show only starred funds',
    tabPortfolio: 'Portfolio',
    pfIntro:
      'Enter your fund and BIST stock purchases and track profit/loss against the latest price. Data is stored only in this browser.',
    pfFund: 'Fund',
    pfFundPh: 'Fund code (e.g. TTE)',
    pfSymbol: 'Fund / Stock',
    pfSymbolPh: 'Code (e.g. TTE or THYAO)',
    pfDate: 'Purchase date',
    pfPrice: 'Purchase price (₺)',
    pfQty: 'Units',
    pfAdd: 'Add',
    pfEmpty: 'No positions yet. Add your first fund purchase above.',
    pfCost: 'Cost',
    pfCurrent: 'Current',
    pfValue: 'Value',
    pfTotal: 'Total',
    pfRemove: 'Remove position',
    pfMissing: (n) => ` (${n} position(s) missing a current price, excluded from totals)`,
    pfErrSymbol: 'Enter a fund code.',
    pfErrUnknown: (s) => `${s} is not among the scanned funds/stocks; check the code.`,
    pfErrPrice: 'Enter a valid purchase price (leave empty to use that day’s price).',
    pfErrQty: 'Enter a valid unit count.',
    pfDisclaimer:
      'Portfolio data is stored only in this device’s browser; nothing is sent to a server. Not investment advice.',
    pfChartTitle: 'Portfolio growth',
    pfChartLabel: 'Portfolio value chart',
    pfLineValue: 'Portfolio',
    pfLineCost: 'Cost basis',
    pfLineBench: (label) => `If you'd bought ${label}`,
    pfBenchHint: (label) =>
      `What would your portfolio be worth today if the same amounts had bought ${label} on the same dates?`,
    bkTitle: 'Backup',
    bkHint:
      'Watchlist and portfolio live only in this browser. Export a file and import it on another device to move them; importing merges with existing data, it does not overwrite.',
    bkExport: 'Export (JSON)',
    bkImport: 'Import',
    bkExported: 'Backup file downloaded.',
    bkImportErr: 'Could not read the file: not a valid Borsa Tarama backup.',
    flowTitle: 'Fund flows — investor count change',
    flowGainers: 'Most investors gained',
    flowLosers: 'Most investors lost',
    flowRange: (from, to) => `Change between ${from} → ${to}. Investor count is a rough proxy for where money is flowing.`,
    stockChartPending:
      'The price chart will appear here after the next scan. Use the TradingView link in the meantime.',
    colChange: 'Today',
    colInvestors: 'Investors',
    colChangeTitle: 'Change of the last close versus the previous close.',
    changeColLabels: { daily: 'Today', weekly: 'Last Week', monthly: 'Last Month', quarterly: 'Last Quarter' },
    rsColPeriods: { daily: '3m', weekly: '6m', monthly: '1y', quarterly: '1y' },
    colRsDyn: (p) => `vs Index (${p})`,
    colRs: 'vs Index (3m)',
    colRsTitle:
      'Over the last 3 months, how much better than the index? Example: the stock gained 30% while the BIST 100 gained 20% → +10%. Positive = it beat the market; negative = it lagged, even if it rose.',
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
    // Global search palette (⌘K)
    cmdkTrigger: 'Search',
    cmdkPlaceholder: 'Search stock or fund…',
    cmdkStocks: 'Stocks',
    cmdkFunds: 'Funds',
    cmdkEmpty: (q) => `No results for "${q}"`,
    cmdkHintType: 'Start typing to search — a stock code or fund name',
    cmdkNav: 'navigate',
    cmdkSelect: 'open',
    cmdkClose: 'close',
    cmdkLoading: 'Loading search data…',
    // Theme switch
    themeLabel: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
    // Market movers
    moversTitle: 'Market movers',
    moversHint: "Today's biggest gainers and losers from the last scan.",
    moversGainers: 'Gainers',
    moversLosers: 'Losers',
    // Market heatmap (treemap)
    tabMap: 'Map',
    mapIntro:
      'Market-cap weighted heatmap: box area shows market cap, colour shows today’s change. Grouped by sector — click a box to open its chart.',
    mapEmpty: 'Not enough data for the map. Run a scan first.',
    mapLegendDown: 'Down',
    mapLegendUp: 'Up',
    mapSizeNote: 'Box area ∝ market cap',
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
