# Borsa Tarama Backend (İskelet)

## Kurulum
```bash
pip install -r requirements.txt
```

## Çalıştırma
```bash
uvicorn app.main:app --reload
```

## Endpoint
```
GET /api/screener/bist100      -> cache'ten okur (scheduler'ın son taraması)
GET /api/screener/sp500
GET /api/screener/bist100?live=true   -> anlık tarama yapar (yavaş)
```

## Tarama Stratejisi: "Teknik Görünümü Güçlü Hisseler"
BIST 100 ve S&P 500 endeksindeki, aşağıdaki şartların **hepsini birden** sağlayan hisseler
piyasa değerine göre büyükten küçüğe sıralı şekilde listelenir:
- Fiyat, 9/21/50/200 periyotluk EMA'ların hepsinin üstünde (güçlü, teyitli yükseliş trendi)
- MACD Line > 0
- RSI < 70 (henüz aşırı alım bölgesinde değil)
- Stokastik %K < 80
- Stokastik RSI %K < 80

Yani zaten yükselişte olan ama henüz aşırı ısınmamış hisseleri bulur (momentum/trend takibi).

### Zaman Dilimleri
Aynı kriterler üç zaman diliminin mumlarıyla ayrı ayrı hesaplanır
(`app/screener/timeframes.py`):

| Timeframe | Mum | Veri | EMA seti | Min. geçmiş | Sinyal ufku |
|-----------|-----|------|----------|-------------|-------------|
| `daily`   | günlük  | 1y  | 9/21/50/200 | 200 gün | günler–haftalar |
| `weekly`  | haftalık | 10y | 9/21/50/200 | 200 hafta (~4 yıl) | haftalar–aylar |
| `monthly` | aylık   | max | 9/21/50 | 60 ay (~5 yıl) | aylar ve ötesi |

Aylıkta EMA200 kullanılmaz çünkü 200 aylık (~17 yıl) veri çoğu hissede yok.
API: `GET /api/screener/bist100?timeframe=weekly`. Statik yayında dosyalar:
`data/{market}.json` (günlük), `data/{market}_weekly.json`, `data/{market}_monthly.json`.
Uzun zaman dilimlerinde kriterleri geçen hisse sayısı doğal olarak azalır
(örn. güçlü trenddeki hisselerin haftalık stokastiği çoğu zaman 80 üstündedir).

Ek kurallar:
- **Tamamlanmamış mum düşürülür** (`drop_in_progress_bar`): haftalık/aylık taramada
  içinde bulunulan haftanın/ayın henüz kapanmamış mumu hesaba katılmaz; sinyaller
  yalnızca kapanmış mumlara dayanır. Günlük tarama zaten seans kapanışından sonra çalışır.
- **Likidite tabanı** (`passes_liquidity_filter`, eşikler `app/core/config.py`
  `min_daily_turnover`): son 20 mumun ortalama günlük cirosu (hacim x kapanış)
  BIST'te 50M TRY, S&P'de 10M USD altındaysa hisse elenir. Haftalık/aylık mumlarda
  ciro gün sayısına bölünerek günlüğe çevrilir.

## Yapılacaklar (production'a geçmeden önce)
1. ~~`app/data/symbols/bist100.json` ve `sp500.json` içindeki listeler örnek/kısaltılmıştır.~~
   Tamamlandı: `bist100.json` Borsa İstanbul'un resmi endeks bileşen verisinden (100 sembol),
   `sp500.json` resmi S&P 500 constituents veri setinden (503 sembol) güncellendi (2026-07-11).
   Not: bu listeler periyodik endeks revizyonlarıyla değişir, düzenli olarak yeniden çekilmeli.
2. `YFinanceFetcher` prototipleme için uygundur; yfinance resmi bir API olmadığından
   rate-limit ve zaman zaman veri tutarsızlığı yaşanabilir. Üretimde `BaseFetcher`'ı
   implemente eden İş Yatırım / Finnhub / Alpha Vantage gibi bir kaynağa geçmen önerilir.
   Açık — bir sağlayıcıda hesabın/API key'in olduğunda devam edilebilir.
3. `_cache` şu an process-memory içinde; birden fazla worker/instance çalıştırırsan
   Redis gibi paylaşımlı bir cache'e taşınmalı. Açık — erişilebilir bir Redis olduğunda devam edilebilir.
4. ~~Testler `tests/` altında; yeni gösterge eklerken karşılık gelen testi de ekle.~~
   Tamamlandı (2026-07-11): `test_indicators.py`, `test_filters.py` (momentum filtresi),
   `test_engine.py` (screen_symbol/run_screener, sahte fetcher ile), `test_yfinance_fetcher.py`
   (yfinance mocklanarak — network'e bağımlı değil). Toplam 21 test, hepsi geçiyor.
   Kural olarak kalıcı: yeni gösterge/filtre eklerken karşılık gelen testi de ekle.

## Frontend
`frontend/` altında Vite + React ile yazılmış web arayüzü var (BIST100/S&P500 sekmeleri,
cache/canlı tarama, sonuç tablosu). Aynı zamanda PWA olarak yapılandırıldı
(`vite-plugin-pwa` — manifest + service worker), yani `npm run build` sonrası üretilen
`dist/` telefonda "ana ekrana ekle" ile uygulama gibi kurulabilir.

```bash
cd frontend
npm install
npm run dev        # geliştirme (http://localhost:5173)
npm run build      # production build + PWA dosyaları -> dist/
```

Backend adresini değiştirmek için (`localhost:8000` yerine deploy edilmiş adres)
`frontend/.env` içine `VITE_API_BASE_URL=https://senin-backend-adresin` ekle ve yeniden build et.

## Yayın Altyapısı (GitHub Actions + GitHub Pages, sunucusuz)
Canlı adres: **https://keremcan534.github.io/borsa-tarama/**

`.github/workflows/scan-and-deploy.yml` hafta içi günde iki kez (BIST kapanışı sonrası
~18:45 TR ve ABD kapanışı sonrası ~00:15 TR) çalışır:
1. `scripts/scan_to_json.py` her iki marketi tarar, sonuçları JSON'a yazar
2. Frontend `VITE_API_BASE_URL=static` ile build edilir — arayüz backend yerine
   build'e gömülü bu JSON dosyalarını okur ("Canlı Tara" butonu bu modda gizlenir,
   son tarama zamanı gösterilir)
3. Çıktı GitHub Pages'e deploy edilir

Yani ayrı bir backend sunucusu barındırmadan, tamamen ücretsiz çalışır. Elle tetiklemek
için: GitHub → Actions → "Tarama ve GitHub Pages yayını" → Run workflow
(veya `gh workflow run scan-and-deploy.yml`).

Not: yfinance, GitHub'ın datacenter IP'lerinden zaman zaman rate-limit yiyebilir;
workflow başarısız olursa bir önceki yayın yerinde kalır, sonraki zamanlanmış
çalıştırmada kendini toparlar.

## Bildirim Botları (Telegram + X/Twitter)
Her tarama sonrası sonuç özeti otomatik paylaşılabilir. Kod hazır
(`app/notify/format.py`, `scripts/notify_telegram.py`, `scripts/notify_twitter.py`);
workflow'daki adımlar ilgili secret'lar repoya eklenene kadar sessizce atlanır,
eklendiği anda devreye girer. Secret'lar GitHub → repo → Settings → Secrets and
variables → Actions → New repository secret'tan (veya `gh secret set AD` ile) eklenir:

- **Telegram**: `TELEGRAM_BOT_TOKEN` (@BotFather'dan /newbot ile al),
  `TELEGRAM_CHAT_ID` (kanal kullanıcı adı `@kanaladi` veya sayısal id; botu kanala
  yönetici olarak eklemeyi unutma)
- **X/Twitter**: `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`,
  `TWITTER_ACCESS_SECRET` (developer.x.com'da app oluşturup "Read and write" izniyle)

Elle denemek için (secret'ları ortam değişkeni olarak verip):
`python scripts/notify_telegram.py frontend/public/data`

## Etkin Marketler ve Kapsam
Hangi marketlerin taranacağı `app/core/config.py` → `enabled_markets` ile belirlenir.
Market tanımları tek kaynakta: **`app/data/markets.py`** (`MARKET_FILES`, `SYMBOLS_DIR`,
`load_symbols`, `enabled_markets`). Eskiden `MARKET_FILES` hem `scheduler.py` hem
`api/routes/screener.py` içinde ayrı ayrı duruyordu ve elle senkron tutuluyordu — artık
ikisi de buradan okuyor.

Etkin: **`bist` + `sp500` + `commodity`**. ETF kapalı (kod + sembol listesi duruyor;
açmak için listeye `"etf"` eklemek yeterli) — tarama/strateji vizyonu hisse +
emtia/kripto + TEFAS fonlarına odaklanıyor.

### `bist`: borsanın tamamı (610 hisse)
Uzun süre yalnızca `bist100` taranıyordu, yani borsanın **~%14'ü**. Kullanıcı
ilgilendiği hisseyi arayıp bulamıyorsa site onun için yok demektir; bu, listedeki
tüm diğer eksiklerden sert bir terk sebebiydi.

Liste `scripts/build_bist_symbols.py` ile üretilir: KAP'ın BIST Şirketleri sayfasından
hisse kodları çıkarılır (802 aday), her biri Yahoo'ya sorulur ve **gerçekten veri
dönen 610'u** listeye girer. Kalan 192 Yahoo'da yok ya da 60 mumdan az geçmişi var —
bir kez elemek, her taramada başarısız istek atmaktan ucuz. Şirket adları
`bist_all_names.json` içinde ayrı durur (sembol dosyasının düz liste biçimi bozulmasın).

`bist100` listesi **silinmedi**: endeks üyeliği hâlâ bir bilgi. Her hisse
`in_bist100` bayrağı taşır (`app/data/indices.py`, statik liste, ek istek yok) ve
arayüzdeki "Yalnızca BIST 100" filtresi bundan üretilir. `bist100` marketi tanımlı
ama taranmıyor: `bist` onu zaten kapsıyor, ikisini birden taramak aynı 100 hisseyi
iki kez çekerdi.

**Likidite eşiği bilinçli olarak değiştirilmedi.** Ölçüldü (2026-08, 606 hissenin
son 20 günlük ortalama cirosu): medyan 63M TRY. 50M eşiği 610 hissenin 345'ini
geçiriyor ve BIST 100'ün en düşük cirolusu 70M olduğundan endeksin tamamı içeride
kalıyor. Düşürmek (25M → 452 hisse) listeye ince hisse sokar; bu bir ürün kararıdır
ve `min_daily_turnover` ile tek satırda değiştirilebilir.

### Sembol başına 4 istek yerine 1 (resample)
Tarama eskiden her sembolü zaman dilimi başına ayrı çekiyordu — günlük, haftalık,
aylık, çeyreklik için **4 istek**. Artık fetcher sembol başına tek `max` günlük istek
atıyor, uzun periyotlar `app/data/resample.py` ile ondan üretiliyor. Kapsamın
100'den 610 hisseye çıkabilmesinin tek sebebi bu.

Üretilen mumlar Yahoo'nunkiyle karşılaştırılarak doğrulandı (THYAO/AKBNK/AAPL, 10 yıl):
haftalık ve aylıkta **522 mumun 522'si aynı tarihe** oturuyor, AAPL'da dört alan da
birebir. BIST'te 7-8 mumda açılış/en düşük sapıyor ve sapanların hepsi tatil ya da
işlem durması haftası — o haftalarda Yahoo açılışı ilk işlem gününden almıyor, bizim
değerimiz doğrudan günlük mumdan geliyor.

**Çeyreklikte bilinçli olarak Yahoo'dan ayrılıyoruz:** Yahoo'nun `3mo` mumunun çapası
istenen aralığa göre kayıyor (aynı sembol `range=5y` ile başka, `range=10y` ile başka
aya oturuyor), yani semboller arası karşılaştırılamaz. Takvim çeyreği kullanılıyor.

Bellek: fetcher artık sembol başına tüm günlük geçmişi tutuyor (~150 KB); tarama her
marketi bitirdiğinde `clear_price_cache()` ile boşaltıyor.

**S&P nabzı:** `^GSPC` "Bugün" sayfasındaki nabız kartında marketin değil endeksin
adını gösterir (`BENCHMARK_NAMES`).

**Arayüz senkronu:** tarama her koşuda `data/markets.json` manifestini yazar, arayüz
market sekmelerini bundan üretir. Böylece kapalı bir marketin sekmesi gösterilip veri
dosyası bulunamaması (backend/frontend drift'i) mümkün değil. Manifest çözülene kadar
veri isteği atılmaz — yoksa kapalı marketlerin dosyaları istenip 404 alınırdı.
Yayındaki eski `?m=bist100` bağlantıları arayüzde `MARKET_ALIASES` ile `bist`e
yönlendirilir; yoksa sessizce "Bugün" sayfasına düşerlerdi.

## KAP Bildirimleri (birincil kaynak)
Haber akışı Google News/Yahoo üzerinden çalışıyordu — yani **ikincil** kaynak. Bir
şirketin bilançosu, pay alım-satımı ya da özel durum açıklaması önce KAP'ta yayımlanır;
haber siteleri onu saatler sonra ve yorumlayarak aktarır.

`app/data/kap.py` bildirimleri doğrudan KAP'tan çeker
(`POST /tr/api/disclosure/members/byCriteria`). `Referer` başlığı **zorunlu** — onsuz
istek cevapsız asılı kalıyor (60 sn'de 0 bayt ölçüldü). Hisseye bağlanamayan
(`stockCodes` boş) bildirimler elenir, çok kodlu bildirim her kod için ayrı satır
üretir. KAP erişilemezse boş liste döner ve tarama durmaz.

Ölçüm (2026-08): 3 günlük pencere 546 ham bildirim getiriyor, taranan 610 sembol için
219 satır kalıyor. Yanıt 2000 kayıtla sınırlı olduğundan pencere gün ölçeğinde tutulur.

Arayüzde **ayrı bir sekme** (`frontend/src/Kap.jsx`), Haberler'in içinde değil: haber
ikincil kaynak, KAP şirketin kendi resmi açıklaması. Tek listede karışsalar kullanıcı
"bunu şirket mi dedi, gazete mi?" ayrımını kaybederdi.

## Reel Getiri (TÜFE)
Sitedeki her getiri nominal TL'ydi. Türkiye'de bu tek başına yanıltıcıdır: yıllık %40
nominal getiri, enflasyon %45'se **kayıptır**.

`app/data/inflation.py` TÜFE serisini `EVDS_API_KEY` varsa TCMB EVDS'ten, yoksa
OECD'den (anahtarsız) çeker. Gecikme gizlenmez: `as_of` alanı serinin son ayını taşır
ve **kapsanmayan dönem için reel getiri hesaplanmaz**. Ölçüldü (2026-08): OECD serisi
2025-12'ye kadar geliyor, yani ~8 ay geride; EVDS anahtarı eklenirse güncel olur.
FRED'in Türkiye serisi (TURCPIALLMINMEI) denendi ve elendi — 2025-04'te durmuş.

Hesap **bölme** ile yapılır, "nominalden enflasyonu çıkar" kestirmesiyle değil:
yüksek enflasyonda ikisi belirgin biçimde ayrışır (nominal %80, enflasyon %50 iken
çıkarma %30 der, doğrusu %20). Aynı hesabın arayüz karşılığı
`frontend/src/inflation.js` (19 birim testi, `npm test`).

Portföy kartında pozisyonlar **ayrı ayrı** arındırılır (farklı tarihlerde alındıkları
için tek bir portföy reel getirisi tanımlı değil) ve kaç pozisyonun kapsandığı yazılır.

## Finansallar (çeyreklik)
`app/data/financials.py` + `scripts/build_financials.py`: satış, brüt/faaliyet kârı,
net kâr ve marjlar, son 4 çeyrek. Bilanço çeyrekte bir değişir, tarama günde iki kez
çalışır — bu yüzden sektör haritasıyla aynı desen: script üretir, repoya commit'lenir,
tarama yalnızca okur ve hiç ek istek atmaz.

**Kapsam sınırı dürüstçe not edilmeli:** 652 sembolde veri geldi ama dağılım eşit değil
— S&P 500'de 484/503, **BIST'te yalnızca 168/610**. Yahoo'nun BIST küçük/orta ölçekli
şirketler için gelir tablosu verisi çoğu zaman yok.

Yahoo raporlamadığı kalemi bazen `0` döndürüyor (THYAO'da 327 milyar TL satışa karşılık
brüt kâr 0). Bunu saklamak arayüzde "brüt marj %0" yazdırırdı — veri yokluğunu ölçülmüş
gerçek gibi gösterirdi. Brüt kâr/faaliyet kârı/FAVÖK için tam sıfır **eksik sayılır**;
satış ve net kârda sıfır korunur, orada gerçek bir sonuç olabilir.

## Ekonomik Takvim
Makro panel fiyat **seviyelerini** gösteriyordu; o seviyeleri hareket ettiren
**olaylar** yoktu. `app/data/calendars.py` + `calendar_events.json`: TCMB PPK faiz
kararları, TCMB Enflasyon Raporu ve Fed FOMC tarihleri.

Tarihler kazınmıyor, statik dosyada duruyor: TCMB ve TÜİK'in takvim sayfaları bu
ortamdan çekilemiyor (SPA/404) ve kazımaya dayanan bir çözüm kaynak sayfa değiştiği
gün sessizce boş takvim gösterirdi. PPK tarihleri TCMB'nin kendi 2026 sayfasından,
FOMC tarihleri federalreserve.gov'dan **doğrulanarak** alındı; kaynak URL'leri hem
dosyada hem payload'da taşınır.

**TÜİK enflasyon açıklama tarihleri bilinçli olarak yok:** "ayın 3'ü" konvansiyonunu
resmî bir takvimden doğrulayamadım ve doğrulanmamış tarih kullanıcıyı yanlış güne
hazırlardı. Halka arz takvimi için de programatik ve güvenilir bir kaynak bulunamadı.

Takvim ayrı bir sekme değil, makro panelin başında: ikisi aynı soruyu farklı yönden
cevaplıyor, ayırmak kullanıcıyı iki yere bakmaya zorlardı.

## Hisse Sayfaları (SEO)
Sitenin arama motoru altyapısı vardı (sitemap, robots, statik günlük raporlar) ama
**içerik ekseni yoktu**: haritadaki 30 URL'in 28'i tarih damgalı rapordu, oysa aramalar
sembol adıyla yapılıyor ("THYAO teknik analiz"). Bu sorgular için hedef sayfa
olmadığından organik trafik kanalı fiilen kapalıydı.

`app/reports/symbol_pages.py` her taranan hisse için `/hisse/KOD.html` üretir: teknik
görünüm, temel oranlar, analist konsensüsü, son çeyrek finansallar, son KAP bildirimleri
ve uygulamaya dönüş bağlantısı. Sayfa **tek başına ayakta durur** — JavaScript yok,
veri gömülü; uygulamanın kendisi SPA olduğundan `?v=…&s=…` derin bağlantısı
indekslenebilir içerik üretmiyor ve bu sayfaların var olma sebebi tam olarak bu.

Verisi olmayan blok **hiç basılmaz**: boş bir "F/K: —" tablosu hem arama motoruna hem
kullanıcıya içerik varmış izlenimi verirdi. Yatırım tavsiyesi uyarısı her sayfada,
çünkü sayfa uygulamadan bağımsız dolaşıyor.

Sayfalar taramada üretilir (veri orada), site haritasına `build_site_meta` manifestten
ekler — iki script birbirinin veri yapısını bilmek zorunda değil.

## Sunucu Tarafı Alarmlar
Arayüzdeki alarmlar `new Notification` ile tarayıcıda çalışıyor, yani **yalnızca site
açıkken**; üstelik veri günde iki kez güncellendiğinden pratikte gün sonu alarmıdır.
Arayüz artık bu sınırı açıkça yazıyor.

`app/notify/alerts.py` + `scripts/notify_alerts.py`: repodaki `alerts.json` kuralları
her taramadan sonra değerlendirilip Telegram'a düşer (örnek: `alerts.json.example`).
İki kural tipi var — sayısal eşik (herhangi bir tarama alanı) ve "taramaya yeni girdi".

Kapsam açıkça sınırlı: bu **site sahibinin** alarmları, ziyaretçininki değil. Ziyaretçi
alarmları yalnızca kendi tarayıcısında durur ve bu bilinçli bir gizlilik kararıdır;
onları sunucuya taşımak hesap + sunucu gerektirir, yani mimarinin tamamını değiştirir.

## Fon Para Akışı (TL)
Fon akışı paneli **yatırımcı sayısı** üzerinden çalışıyordu; "fona 500 kişi katıldı"
ile "fona 12 milyar TL girdi" aynı şey değil — tek kurumsal giriş, kişi sayısını hiç
değiştirmeden fonun boyutunu ikiye katlayabilir.

`app/funds/flows.py`: akış, fon büyüklüğündeki değişimin **fiyat hareketiyle
açıklanamayan** kısmıdır.

    akış_t = büyüklük_t − büyüklük_(t−1) × (fiyat_t / fiyat_(t−1))

Fiyat çarpanı olmadan, fonu %5 yükselten bir piyasa günü %5'lik sahte "para girişi"
gibi görünürdü. Toplam yüzdesi **dönem başındaki** büyüklüğe oranlanır; günlük yüzdeler
farklı tabanlara göre hesaplandığından toplanmaları matematiksel olarak yanlıştır.
Sıralama TL toplamına göredir, yüzdeye göre değil: yüzde sıralaması küçük fonları
tepeye taşır ve "bugün para nereye gitti?" sorusunu cevaplamaz.

Arşiv kayıt biçimi düz sayıdan sözlüğe geçti (yatırımcı + büyüklük + fiyat); mevcut
yatırımcı paneli iki biçimi de okur, yoksa arşivin eski kısmı sessizce kaybolurdu.
Akış ancak arşivde ardışık iki gün varsa hesaplanabilir — geriye dönük üretilemez.

## "Bugün" Sayfası
Uygulamanın açılış sekmesi (`view === 'today'`). Kullanıcıyı doğrudan ham tabloya
düşürmek yerine günün özetini verir; her blok detay sekmesine kapı açar:

- **Piyasa nabzı** — endekslerin son kapanışı + günlük değişimi. Veri `payload.benchmark`
  (`app/data/benchmarks.py::benchmark_summary`); endeksi tarama zaten çektiğinden ek
  maliyeti yok. S&P ve ETF aynı endeksi paylaştığından kartlar sembole göre tekilleştirilir,
  emtiada endeks olmadığından kart çıkmaz.
- **Bugünün yeni sinyalleri** — tüm marketlerden `is_new` işaretliler (`app/screener/diff.py`).
- **Marketlere göre sinyaller**, **öne çıkan fonlar**, **öne çıkan haberler** (4 BIST + 3 global).

`fetchDailyOverview` dört marketin günlük JSON'unu `Promise.allSettled` ile çeker: bir
market eksikse sayfa yine açılır.

## Haberler: BIST / Global
Haberler market sekmesiyle değil, **tek akışta iki bölüm** olarak gösterilir. Sebep:
dört marketin üçü (S&P, ETF, emtia) ABD olduğundan market sekmesi kullanıcıyı kolayca
ABD akışında bırakıyordu. `fetchAllNews` tüm `news_*.json` dosyalarını birleştirir
(link'e göre tekilleştirip tarihe göre sıralar), arayüz sembolün `.IS` ekine bakarak
**BIST Haberleri** / **Global Haberler** diye böler (bölüm başına 50).

Grafik modalı da artık tüm haberler arasından sembole göre filtreler; market state'ine
bağımlılık kalktı.

## TEFAS Fonları
`app/funds/` altında TEFAS YAT fonları için getiri/risk taraması var (RSI/MACD yok;
1a/3a/6a/1y/YTD getiri, volatilite, Sharpe, Sortino, Calmar, max düşüş, BIST 100'e
göre beta / Jensen alfası, 0-100 puan). `scan_to_json.py`
her çalıştırmada `funds.json` (liste) ve `fund_prices.json` (günlük fiyat serileri +
BIST100/USD/altın benchmark) üretir. Arayüzde **Fonlar** listesi ve **Karşılaştır**
sekmesi (normalize getiri eğrisi, dönem seçimi, metrik tablosu) bunları kullanır.
API: `GET /api/funds` (canlı tarama ~3 dk sürebilir; TEFAS rate-limit).

### Kapsam: 120 kapağı kaldırıldı (674 fon)

Liste puana göre ilk **120** fonda kesiliyordu. Ölçüldü (2026-08, TEFAS YAT):
2041 fonun 1546'sı ÖZEL değil, bunların **689'u** büyüklük (≥100M TL) ve
yatırımcı (≥500) eşiklerini geçiyor — yani kapak **569 fonu görünmez kılıyordu**.
Kaçırılanlar niş de değildi: **13 gümüş fonunun 13'ü** (GTZ 13,2 milyar TL /
62 bin yatırımcı, YZG 11,5 milyar, IOG 14 milyar), 163 serbest fonun 144'ü,
111 para piyasası fonunun 86'sı listede yoktu. Kullanıcı aradığı fonu
bulamıyorsa site onun için yok demektir; eşikler zaten savunulabilir bir evren
tanımlıyor, üstüne bir de sayı kapağı koymak keyfiydi (`MAX_FUNDS = None`).

**Fiyat serileri fon başına ayrı dosyada** (`data/fund-prices/KOD.json`): 674
fonun serisi tek dosyada ~4,2 MB ederdi ve kullanıcı tek bir fonun grafiğini
açmak için tamamını indirirdi — hisse serilerinde çözülen sorunun aynısı
(`app/data/price_files.py`). `fund_prices.json` benchmark'ları ve en çok
bakılan 120 fonun serisini satır içi taşımayı sürdürür; arayüz eksik kalanı
açıldığında tek tek ister (`ensureFundSeries`).

### Fon Kategorileri ve Kategori Sayfaları
Kategori kuralı tek kaynakta: **`app/funds/categories.py`**. Tarama sonuca
`category` alanını yazar; Fon Ligi, kategori sayfaları ve arayüz filtresi aynı
sınıflandırmayı görür (eskiden kural hem arayüzde hem `screen.py`'de ayrı
duruyordu ve ayrışabilirlerdi).

**Gümüş, altından ayrı bir kategori.** Kural eskiden `KIYMETLİ MADEN|ALTIN|GÜMÜŞ`
tek ligdi; oysa TEFAS'ta 13 halka açık gümüş fonu var ve "gümüş fonu" ayrı bir
arama niyeti. Sıra anlamlıdır: "GÜMÜŞ FON SEPETİ" hem gümüş hem sepettir, doğru
cevap gümüştür — madenler sepet/serbest'ten önce gelir. Ad ASCII'ye katlanarak
eşleştirilir (`LİKİT`/`LIKIT`, `DEĞİŞKEN`/`DEGISKEN` aynı sonucu verir).

`app/reports/fund_category_pages.py` her kategori için `/fon-kategori/<slug>.html`
üretir (gümüş, altın, hisse senedi, para piyasası, serbest, katılım, endeks,
borçlanma, fon sepeti, yabancı/eurobond, karma/değişken). Hisse sayfalarıyla
(`symbol_pages.py`) aynı gerekçe: uygulama SPA olduğundan `?v=funds`
indekslenebilir içerik üretmiyor ve "gümüş fonu hangisi", "en iyi hisse senedi
fonu" gibi aramaların ineceği hedef sayfa yoktu. Sayfa tek başına ayakta durur
(JavaScript yok, veri gömülü), **fonu olmayan kategori hiç basılmaz**, site
haritasına `build_site_meta` manifestten ekler.

### Risk-Ayarlı Metrikler (Sortino / Calmar / Jensen alfası)
Sharpe tek başına iki soruyu cevaplamıyordu: "bu oynaklığın hangi tarafı canımı
yaktı?" ve "getirinin ne kadarı zaten piyasadan geliyordu?". `app/funds/metrics.py`
üçünü birden ekliyor:

- **Sortino** — Sharpe'ın paydasında tüm oynaklık yerine yalnızca hedefin (risksiz
  getiri) altındaki günler var. Sert yükselen bir fon artık "riskli" diye
  cezalandırılmıyor. Hiç düşüş günü yoksa oran tanımsızdır → `None`.
- **Calmar** — yıllık bileşik getiri / max düşüş. Volatilitenin kaçırdığı tek
  seferlik çöküşleri yakalar. En az 180 günlük geçmiş ister (kısa pencerede CAGR
  şişer); düşüş yaşamamış seride tanımsızdır.
- **Beta + Jensen alfası** — fon getirileri BIST 100'e (`XU100.IS`) karşı regresyona
  sokulur; alfa yıllıklandırılmış fazla getiri olarak döner. Endeks çekilemezse
  ikisi de `None` kalır, tarama durmaz. TEFAS tarihleri tz'siz, yfinance endeksi
  tz'li geldiği için seriler gün bazına normalize edilip kesiştirilir.

#### TEFAS bir iş günü gecikmelidir (beta'yı çökerten tuzak)
D tarihli birim pay değeri, D-1 kapanışıyla hesaplanan portföy değeridir. Fon
getirisi endeksin AYNI günkü getirisiyle eşleştirilirse beta sıfıra çöker; ilk
yayında tam olarak bu oldu. Ölçüm (11.08.2026 yayını, 120 fon):

| Hizalama | BIST teknoloji endeks fonları (TTE / YHZ) | 120 fonun medyan \|beta\| |
|---|---|---|
| Aynı gün | beta -0,05 / -0,05 · korelasyon -0,06 | 0,015 |
| **Bir gün gecikmeli** | **beta 0,76 / 0,79 · korelasyon 0,71 / 0,72** | **0,204** |

Bu yüzden `alpha_beta`, fon getirisini bir ÖNCEKİ işlem gününün endeks
getirisiyle eşleştirir (`BENCHMARK_LAG_DAYS = 1`). Kaydırma takvim günü değil
ORTAK işlem günü üzerinden yapılır — tatil delikleri hizalamayı bozmasın diye.

#### Risksiz getiri neden ölçülüyor da sabit yazılmıyor?
Sortino ve alfa "risksiz getirinin ÜSTÜNDE ne kazandırdı"yı ölçer. TL'de bu oran
sıfır değil: %40 faiz varken risk almadan da %40 kazanılıyor. Sıfır kabul edilseydi
bir para piyasası fonu — neredeyse hiç oynaklığı olmadığı için — devasa Sortino ve
"yılda %40 alfa" ile listenin tepesine çıkardı; oysa ürettiği şey beceri değil,
sadece faiz.

Sabit bir oran yazmak da (örn. `0.40`) çözüm değil: TR'de faiz sık değişiyor,
tarama her gün kendi başına koşuyor ve birkaç ay sonra sessizce yanlış bir sayıyla
çalışmaya devam ederdi. Bu yüzden oran **veriden ölçülüyor**: taramanın zaten
indirdiği TEFAS verisinde para piyasası fonlarının (`PARA PİYASASI|LİKİT`) yıllık
bileşik getirilerinin **medyanı** vekil olarak alınıyor. Medyan, tek bir bozuk
fiyat serisinin oranı kaydırmasını engelliyor; %5–150 aralığı dışındaki değerler
ve 3'ten az fon bulunması durumu elenip 0'a düşülüyor.

Bu vekil, politika faizinden de dürüst bir ölçü: fon ücretlerinden SONRAKİ getiriyi
verir, yani bir fon yatırımcısının gerçek alternatifidir. `RISK_FREE_RATE=0.40`
ortam değişkeni verilirse ölçüm devre dışı kalır ve o oran kullanılır.

Yeni metrikler **0-100 puana girmiyor**: puan formülü (1y getiri + Sharpe + düşük
max düşüş) sabit tutuldu ki sıralamanın anlamı sürüm sürüm değişmesin. Kolon
olarak gösterilir, sıralanabilir ve CSV'ye çıkar.

### Fon Hisse Pozisyonları
Arayüzdeki **Hisse Pozisyonları** sayfası `fund_stock_positions.json` dosyasını
okur ve seçilen BIST hissesini taşıyan fonları 12 aylık ağırlık/pay adedi
matrisinde gösterir. Normalize KAP rapor satırlarını JSON'a çevirmek için:

```bash
python scripts/fund_positions_to_json.py positions.csv \
  frontend/public/data/fund_stock_positions.json
```

CSV alanları: `fund_code`, `fund_name`, `symbol`, `month`, `weight`, `shares`.
`weight` fon içindeki yüzde değerdir (ör. `%4,75` için `4.75`).

Üretim workflow'u ayın 15'inde `scripts/kap_fund_positions.py` komutunu
çalıştırır. Komut resmi KAP Portföy Dağılım Raporu PDF'lerini indirir, yayındaki
geçmişle birleştirir ve son 12 ayı korur. Workflow elle tetiklendiğinde de bu
adım çalışır; böylece ilk veri beklemeden üretilebilir.

KAP tarafında fon OID'leri `fundOid` alanından batch halinde sorgulanır (byCriteria
2000 satır tavanı); düzeltme bildirimleri (`DUZELTILMIS`) orijinal rapora tercih
edilir. PDF indirmelerinde Java sarmalayıcısı otomatik soyulur.

## Fon Karşılaştırma
`frontend/src/FundCompare.jsx`. Metrik tablosu "ne kadar kazandırdı"yı söylüyordu ama
üç soruyu cevaplamıyordu; her biri için bir panel eklendi:

- **Risk – getiri dağılımı**: x volatilite, y 1 yıllık getiri. Tüm fon evreni soluk
  noktalarla, seçilenler vurgulu çizilir — amaç seçimin evrende NEREDE durduğunu
  göstermek. Sol üst "az riskle çok kazandıran", sağ alt "çok riskle kaybettiren".
- **Korelasyon matrisi**: seçili fonların ortak günlerdeki **günlük getiri**
  korelasyonu (fiyat seviyesi değil — iki yükselen seri seviyede her zaman ~1 verir,
  bu sahte ilişkidir; makro panelindeki kuralın aynısı). Alttaki örtüşme tablosu
  "aynı HİSSELERİ mi taşıyorlar" sorusunu KAP verisinden cevaplar; korelasyon ise
  "farklı hisse taşısalar bile birlikte mi hareket ediyorlar" sorusunu fiyattan
  cevaplar — ikisi ayrı bilgidir ve yan yana durmaları bilinçlidir.
- **Ay ay getiri ısı haritası**: son 12 ay. Getiri istikrarlı mı, yoksa tek bir
  patlama ayından mı geliyor? `MIN_MONTH_DAYS = 10`: yarım aylar (verinin başladığı
  ilk günler gibi) tam ay gibi gösterilirse harita yanlış okunur, boş bırakılır.

Rakamlar tarayıcıda bağımsız bir uygulamayla karşılaştırılarak doğrulandı
(TMV/PBR korelasyonu 0,1801 ve TMV Temmuz 2026 getirisi %14,2 — ekrandakiyle birebir).

Sayfada ayrıca `ShareBar` var: metrik tablosunun CSV'si ve seçili fonların dönem
getirilerini taşıyan paylaşım kartı.

## Strateji Backtest'i
`app/backtest/` stratejinin geçmiş verideki performansını ölçer; arayüzde **Strateji**
sekmesi gösterir. Backtest, canlı taramanın **aynı** `compute_indicators` + `passes_filters`
kodunu kullanır — böylece ölçülen şey ile sitede gösterilen sinyal tanım olarak aynıdır.

- **Sinyal**: filtrenin kapalıdan açığa geçtiği mum (arka arkaya açık kalan mumlar aynı
  sinyalin devamıdır, tekrar sayılmaz).
- **Giriş**: sinyal mumunun ERTESİ mumunun açılışı. Filtre kapanışa baktığından aynı
  mumdan almak look-ahead olurdu.
- **Ölçüm**: `HORIZONS`'taki her ufuk için getiri + **aynı penceredeki endeks getirisi**
  (`BENCHMARKS`: BIST→XU100.IS, S&P/ETF→^GSPC; emtiada endeks yok).

```bash
python scripts/backtest_to_json.py data --markets bist100 --timeframes daily
```

Taramadan ayrı, **haftalık** bir workflow'da çalışır (`.github/workflows/backtest.yml`):
sembol başına 5-10 yıllık veri pahalıdır ve strateji performansı günden güne değişmez.
Çıktı `data/backtest.json` repoya commit'lenir; `build_site_meta.py` her yayında onu
`frontend/public/data/`'ya kopyalar.

### İlk sonuçlar (BIST 100, günlük, 2022-05 – 2026-07) — dürüst okuma
| Ufuk | İsabet | Strateji ort. | Endeks ort. | Endeksi yenen |
|------|--------|---------------|-------------|---------------|
| +5 mum  | %54 | +%1,30  | +%0,69  | %49 |
| +20 mum | %59 | +%5,77  | +%3,55  | %50 |
| +60 mum | %62 | +%18,84 | +%11,72 | %50 |

**"İsabet %62" tek başına yanıltıcıdır** — yükselen bir piyasada rastgele alım da
benzer oran verir. Sinyallerin yalnızca **%50'si endeksi yeniyor** (yazı-tura) ve medyan
getiri (+%9,24) endeks ortalamasının **altında**: ortalamayı yukarı çeken şey birkaç büyük
kazanan. Yani bu strateji "endeksi döven bir sistem" değil, endeksi takip eden ve getirisi
sağ kuyruğa bağlı bir filtredir. Üstelik survivorship bias bu farkı bile iyimser gösterir.
Arayüzde endeks getirisi bilerek her rakamın yanında durur.

### Portföy Simülasyonu: "1.000 TL ile takip etseydin?"
`app/backtest/portfolio.py` sinyalleri takip eden sanal bir portföy kurar: en fazla 10
eşit ağırlıklı pozisyon, her biri 20 mum tutulur, kapasite doluysa sinyal **atlanır**
(gerçek bir yatırımcının parası sınırsız değildir). Sonuç Strateji sekmesinde getiri
eğrisiyle gösterilir.

**Tek rakam değil, aralık.** Sinyallerin ~%90'ı kapasite dolu olduğu için atlanıyor,
dolayısıyla sonuç hangi sinyalin seçildiğine çok duyarlı: tek koşular **7.285 ile 24.927**
arasında değişti. Bu yüzden `simulate_many` 25 farklı rastgele seçimle koşar ve medyan +
aralık raporlanır. BIST 100 günlük (2022-05 → 2026-07):

| | Sonuç |
|---|---|
| Strateji portföyü (medyan) | **15.158 TL** (p10–p90: 10.778 – 20.811) |
| Endeksi al-tut | **5.737 TL** |
| Endeksi yenen koşu | **25/25** |

Yani sinyal başına endeksi yenme oranı yazı-tura olsa da, ortalama fark pozitif olduğu
için bileşiklendiğinde portföy endeksi geçiyor — getiri birkaç büyük kazanana bağlı.
**Güvenilir olan yön, büyüklük değil**: aralık üç kattan fazla. Survivorship bias burada
da geçerli.

### Günlük Değişim ve Endeks Farkı
**"Bugün" (`change`)** — `app/screener/engine.py::last_bar_change`: son kapanmış mumun bir
öncekine göre değişimi. Günlük taramada bugünün getirisi, haftalıkta haftanınki. Fonlarda
karşılığı `return_1d` (`app/funds/metrics.py::daily_return`). Bir finans sayfasında ilk
beklenen rakam budur; "Bugün" sayfasındaki sinyal kartları ve fon kartları bunu gösterir.

**"Endeks Farkı (3a)" (`relative_strength`)** — `app/screener/relative_strength.py`:
hissenin son `rs_bars` mumdaki getirisinden endeksin aynı dönemdeki getirisi çıkarılır
(`TIMEFRAMES[tf]["rs_bars"]`; günlük 60 mum ≈ 3 ay). Neden gerekli: momentum filtresi
"yükselen hisse" bulur, ama yükselen bir piyasada zaten her şey yükselir. Örnek: TRMET
filtreyi geçiyor ama endeksin **%11 gerisinde** — bu kolon olmadan görünmezdi.

> **Dönem etiketi kuralı.** Kullanıcı testinde iki kez aynı hataya düşüldü: çıplak bir
> yüzde, bulunduğu bağlamın dönemi sanılıyor. Fon kartındaki `+%226` (1 yıllık) "Bugün"
> sayfasında bugünün getirisi sanıldı; `Göreli Güç` kolonundaki `+%30` (3 aylık) fiyatın
> yanında günlük değişim sanıldı. **Her yüzde, dönemini yanında taşımalı** — kolon adı
> `Endeks Farkı (3a)`, fon kartı `bugün` / `son 1 yıl` etiketli. Açıklamalar da soyut tanım
> yerine somut sayıyla yazılır ("hisse %30, endeks %20 → fark +%10"): ilk hali kimseye
> bir şey anlatmıyordu.

Endeks tanımları `app/data/benchmarks.py`'de; backtest ve tarama aynı endeksi kullanır ki
iki yer farklı şeyi ölçmesin.

### Hakkında / Güven Sayfası
`AboutView` -> sol menüde **Hakkında**. Ölçülen eksik: sitede veri kaynağının ve
**gecikmenin** yazılı olduğu hiçbir yer yoktu. Bir profesyonel siteye bakınca dört
sey sorar - kim yapti, veri nereden, ne kadar gecikmeli, gecmis performans ne?
Son soruya Strateji sekmesi zaten durustce cevap veriyordu; bu sayfa ilk ucunu kapatir.

Icerik: ne oldugu - **gecikme uyarisi** (vurgulu kutuda: "canli sandim" en pahali
yanlis anlama) - veri kaynaklari (yfinance / TEFAS / KAP / haber akislari / logolar) -
yontem ve durustluk - bilinen sinirlar - gizlilik - sorumluluk reddi - kaynak kod.

**Buradaki her gizlilik iddiasi koddan dogrulanarak yazildi**, tahminle degil:
izleme kodu yok (gtag/analytics/piksel sifir eslesme), `document.cookie` hic
kullanilmiyor, kisisel veri yalnizca 11 localStorage anahtarinda duruyor, calisma
aninda ucuncu tarafa istek atilmiyor. Dogrulanmamis bir gizlilik cumlesi yazmak
hic yazmamaktan kotudur. Play Store da gizlilik politikasini zorunlu kiliyor.

Sayfa metni elle guncellenirse `ABOUT_UPDATED` tarihi de guncellenmeli.

## Şirket Logoları
`scripts/build_logos.py` -> `frontend/public/logos/*.png` + `index.json` manifesti ->
arayüzde `TickerLogo`. Kullanıcı "isimlerin yanındaki monogramlar yapay duruyor, gerçek
logo çekmenin yolu yok mu" dedi; var.

Yöntem `build_sectors.py` ile aynı felsefe: logo, şirketin alan adından türetilir ve
**build zamanında BİR KEZ** indirilip repoya konur. Çalışma anında sıfır harici istek
olur — hem hız, hem gizlilik (kimse hangi hisseye baktığını üçüncü bir sunucuya
sızdırmaz). Logo neredeyse hiç değişmez, her taramada yeniden çekmek anlamsız;
sektör haritası gibi statiktir.

### Alan adı: KAP (yfinance değil)
İlk sürüm alan adını yfinance `.info`'nun `website` alanından okuyordu ve BIST'te
tıkanıyordu: Yahoo bu alanı BIST şirketlerinin çoğunda doldurmuyor, üstelik sembol
başına ~1 sn + rate-limit riski var. Sonuç **610 sembolde yalnızca 83 logo (%14)**
idi — kullanıcının "BIST'te çoğu şirketin logosu yok" dediği tablo buydu.

Artık birincil kaynak KAP: her şirketin "Genel Bilgiler" sayfasındaki **İnternet
Adresi** alanı borsaya bildirilen resmî adres. `scripts/build_company_domains.py`
bunu bir kez toplayıp `app/data/company_domains.json`'a yazar (610 sembolün
**588'i**); `build_logos.py` önce oradan okur, yalnızca eksikte yfinance'e düşer.

### Logo: iki kaynak
1. Google favicon servisi (`s2/favicons?domain=...&sz=128`). **Gerçek ayraç HTTP
   durum kodudur** (bilinmeyen alan adı 404, bilinen 200 + görsel), byte boyutu
   DEĞİL: ilk sürümde bir byte eşiği vardı ve Tüpraş gibi yalnızca 16x16 faviconu
   olan gerçek şirketleri eliyordu.
2. Google'ın tanımadığı alan adları için şirketin **kendi ana sayfasındaki**
   `<link rel="icon">` / `apple-touch-icon`. Google Koç Holding'i bile tanımıyor;
   bu ikinci geçiş kalan 110 şirketin ~%40'ını kurtarıyor. En büyük boyutlu ikon
   seçilir (tabloda 26 pikselde net görünsün diye).

- BIST: **~500/610** sembolde gerçek logo (%14'ten yükseldi). Kalanların ya web
  sitesi KAP'ta yok ya da sitesi ikon vermiyor -> nötr harf rozetine düşer.
- Logosu olmayan sembol manifestte YOKtur; ETF/emtia/kripto ve TEFAS fonları da
  (şirket sitesi olmadığından) monogram gösterir.
- `TickerLogo` gerçek logoyu bir `<img>` olarak çizer; yüklenemezse `onError` ile
  monograma düşer (kırık resim ikonu göstermektense harf yeğdir). Bilinçli olarak
  `loading="lazy"` DEĞİL: lazy yalnızca tarayıcı kareyi boyadığında tetiklenir ve
  bu doğrulama ortamında hiç çalışmıyordu — logolar minik olduğundan (~2 KB, kalıcı
  cache) eager yüklemenin maliyeti önemsiz, doğrulanabilirliği net.
- Manifest tüm ağaca React Context ile dağıtılır (TickerLogo 23 yerde prop'suz çağrılıyor).
- Yeniden çalıştır: önce `python scripts/build_company_domains.py` (yalnızca yeni
  şirket geldiyse), sonra `python scripts/build_logos.py` — ikisi de eksikleri
  tamamlar, baştan indirmez. S&P 500 için de çalıştırılabilir ama şimdilik yalnızca
  BIST indirildi (ana pazar; 500 ABD logosu repoyu ~1 MB büyütür).
- Logolar service worker precache'ine GİRMEZ (`globIgnores`): 500 minik dosyayı
  ilk açılışta indirmenin anlamı yok, satır render olunca tek tek geliyorlar.

## Marka: Nazar Logosu ve Yıldızlı Zemin
Kaynak görseller `assets/brand/` altında sürüm kontrolünde durur — ikisini de site
sahibi verdi (elle çizilmiş nazar boncuğu + Samanyolu fotoğrafı); kullanım hakkı
onun sorumluluğunda, repoda başka bir yerden alınmış görsel yok.
`scripts/build_brand_assets.py` onlardan `frontend/public/` içindeki türevleri
üretir. Türevler de repoya konur — CI'da Pillow gerekmez, çalışma anında hiçbir
görsel işlenmez. (Eski `frontend/generate_icons.py` mor sütun-grafik ikonunu
çiziyordu; yerini bu script aldı.)

### Logo
Çizim tek renk mürekkep + saydam zemin. Arayüzde bir `<img>` DEĞİL, **CSS maskesi**
olarak kullanılıyor (`.logo`, `mask-image` + `background-color: var(--brand-ink)`):
lacivert mürekkep koyu temada neredeyse görünmez olurdu, maske sayesinde renk temaya
bağlanıyor ve tek dosya yetiyor. Maskenin adresi `BASE_URL`'e bağlı olduğundan
(`/borsa-tarama/`) CSS'e gömülemiyor, JSX satır içi `--brand-mark` değişkeniyle
geçiyor. `mask-image` desteklenmeyen tarayıcıda `@supports` ile düz görsele düşer.

Aynı çizim PWA ikonlarına (192/512/maskable), favicon'a ve paylaşım kartına
(`og-image.png`) gece mavisi zemin üzerinde açık mavi olarak basılır. Maskable
ikonda çizim tuvalin %60'ında kalır (işletim sistemi köşeleri kırpıyor).
`og-image.png` adı DEĞİŞMEMELİ: arşivdeki yüzlerce rapor sayfası bu adrese bağlı.

### Zemin
Yıldızlı gökyüzü sabit, tam ekran, en arkada (`z-index: -2`; aurora lekeleri onun
üstünde). Fare gezdikçe Escape from Tarkov menüsündeki gibi ağır ağır kayar.

- **Bulanıklık görsele PİŞİRİLMİŞ gelir**, CSS `filter: blur()` ile verilmez: filtre
  her karede tüm ekranı yeniden bulanıklaştırırdı ve zemin fareyle sürekli kayıyor.
  Bulanık görsel çok iyi sıkıştığından dosya da küçülüyor (1,1 MB -> 48 KB webp).
- Bulanıklık miktarı ölçülerek seçildi: 16 piksel yıldızları tamamen eritip zemini
  renkli bir lekeye çeviriyordu; 6 piksel "bulanık ama hâlâ yıldızlı gökyüzü"
  dengesini tutuyor.
- Parallax React state TUTMAZ: fare saniyede ~120 olay üretir, her biri için render
  tetiklemek tüm tabloyu yeniden çizerdi. `NightSky` yalnızca iki CSS değişkeni
  (`--sky-x/--sky-y`) yazar, kaydırmayı compositor yapar. Fare durunca rAF döngüsü
  kendini durdurur (pil).
- Kapalı olduğu durumlar: `prefers-reduced-motion` (hareket rahatsızlık verebilir)
  ve dokunmatik cihaz (`pointer: coarse` — imleç yok, dinleyici de olmasın).
- Okunabilirlik `--sky-veil`/`--sky-veil-edge` perdesiyle korunur: açık temada
  neredeyse örtücü (koyu metin), koyu temada ince (yıldızlar görünsün). Kartlar
  zaten opak `--surface` taşıdığından tablo/metin zeminden etkilenmez.

## Fon Logoları
`scripts/build_fund_logos.py` -> `frontend/public/fund-logos/*.png` + manifest ->
arayüzde aynı `TickerLogo`. Hisse logolarıyla aynı felsefe, farklı anahtar: bir
fonun kendi logosu yoktur, onu YÖNETEN portföy şirketinin logosu vardır. "PUSULA
PORTFÖY BİRİNCİ DEĞİŞKEN FON" ve "PUSULA PORTFÖY HİSSE FONU" ikisi de Pusula
Portföy'ün logosunu gösterir — bir bankanın tüm fonlarının banka logosunu
göstermesi gibi. Böylece 120 fon için yalnızca ~41 logo iner.

- Manifest FON KODU değil ŞİRKET SLUG'ı ile anahtarlanır (`{ "pusulaportfoy":
  "pusulaportfoy.png" }`). Arayüz fon ADINDAN şirketi çıkarıp (`fundCompanySlug`,
  backend'deki `company_slug` ile aynı) slug'a çevirir. Fon kodu -> slug haritası
  fon listesi yüklenince kurulur ve `LogoContext`'e konur; böylece `TickerLogo`
  bir fon kodu görünce (adı elinde olmadan) doğru logoya ulaşır, çağrı yerleri
  değişmez.
- Domain tahmini: TEFAS şirketleri neredeyse istisnasız `{slug}.com.tr` ya da
  `{slug}.com`. Uymayanlar `DOMAIN_OVERRIDES` ile (ör. Garanti Portföy ->
  garantibbvaportfoy.com.tr — marka değişimi). **37/41 şirkette** logo bulundu
  (~90 KB); kalan 4 (Astra/Deniz/Nurol/Piramit) faviconu bulunamadığından o
  şirketin fonları monograma düşer.

## Sektör Dağılımı
Tarama tablosunun üstünde sinyallerin sektör dağılımı chip'lerle gösterilir (filtreye
göre canlı güncellenir). Amacı süs değil: sinyaller tek sektörde yoğunlaşmışsa liste
göründüğü kadar çeşitli değildir, hepsi birlikte düşebilir.

Sektör verisi **statik**: `app/data/sectors.json` (`scripts/build_sectors.py` ile üretilir,
repoya commit'lenir), `app/data/sectors.py` okur. Neden statik: sektör yalnızca yfinance'in
`.info` çağrısından geliyor (~0,5 sn/sembol → 600 sembolde ~5 dk + rate-limit riski), oysa
bir şirketin sektörü neredeyse hiç değişmez. Tarama haritayı okur, **hiç ek istek atmaz**.
Kapsam: BIST 100 100/100, S&P 500 502/503; ETF ve emtiada sektör kavramı olmadığından
o marketlerde dağılım hiç gösterilmez. Sembol listeleri endeks revizyonuyla değişince
`build_sectors.py` yeniden çalıştırılmalı.

## Temettü Takvimi
`app/data/dividends.py` → `data/dividends.json` → arayüzde **Temettü** sekmesi.
Site bugüne kadar saf teknikti; oysa BIST yatırımcısının en çok baktığı rakamlardan
biri temettü verimidir.

**Ek veri maliyeti yok.** Ödemeler günlük fiyat isteğiyle aynı yanıtta geliyor
(`YFinanceFetcher.fetch_ohlcv` `dividends` kolonunu yakalayıp cache'liyor — yalnızca
`1d` mumlarda, çünkü haftalık/aylık mumda ödeme tarihi periyoda yuvarlanır), yaklaşan
ex-tarih ise temel oranlar için zaten yapılan `.info` çağrısından düşüyor
(`fetch_dividend_info`). Bu modül yalnızca hesap yapar.

**Verim yeniden hesaplanır, kaynağın `dividendYield` alanı kullanılmaz:** o alan
bazen bayat, bazen yıllıklandırılmış tahmindir. Burada tanım tek ve doğrulanabilir —
*son 12 ayda gerçekten ödenen toplam ÷ güncel fiyat* — ve ödemelerin listesi satır
açılınca yanında durur.

Kurallar:
- 12 ay içinde ödeme yoksa `ttm` **0 değil `None`**: tabloda "0,00" görmek sıfır lira
  ödendiği anlamına gelirdi, oysa gerçek durum "bu dönemde ödeme yok".
- Yaklaşan ex-tarih penceresi 90 gün; `.info`'daki tarih GEÇMİŞ de olabildiğinden
  yalnızca ileri tarihli olan "yaklaşan" sayılır.
- Temettü ödemeyen ve yaklaşan tarihi de olmayan hisse listeye hiç girmez.
- Verim/dağıtım oranı arayüzde `formatRatioPct` ile basılır (artı işaretsiz):
  `formatPct`'in `+`'sı bir DEĞİŞİMİ ima eder, oysa bunlar seviyedir.

## Tahvil Durasyonu Hesaplayıcısı
`frontend/src/bonds.js` + `BondDuration.jsx` → arayüzde **Tahvil Durasyonu** sekmesi.
Sitedeki diğer sayfaların aksine burada piyasa verisi yok: nominal, kupon oranı,
vade, YTM ve kupon sıklığı kullanıcıdan gelir. Bu yüzden hesap bilerek tarayıcıda
yapılır — statik yayında (backend yokken) da çalışır ve her tuşta anında sonuç verir.

Üretilenler: temiz fiyat, **Macaulay durasyon** (nakit akışlarının bugünkü değere
göre ağırlıklı ortalama vadesi), **değiştirilmiş durasyon** (Macaulay / (1 + dönemsel
getiri)), DV01 ve dönem dönem nakit akışı tablosu (bugünkü değer + ağırlık).

±100bp senaryo tablosu, durasyonun doğrusal tahmini ile gerçek yeniden fiyatlamayı
yan yana koyar: aradaki fark dışbükeyliktir (convexity) ve durasyonun neden yalnızca
küçük hareketlerde iyi bir yaklaşım olduğunu tek bakışta gösterir.

Formüller `node --test` ile test edilir (`cd frontend && npm test`); değerler ders
kitabı örnekleriyle doğrulanmıştır (kuponsuz tahvilde durasyon = vade, YTM = kupon
iken fiyat = nominal, ağırlıklar toplamı 1).

## Makro Panel
`app/data/macro.py` → `data/macro.json` → arayüzde **Makro** sekmesi. BIST'in yönü
çoğu zaman hissede değil kurda, faizde ya da petroldedir: USDTRY, EURTRY, dolar
endeksi, gram altın, BIST 100, S&P 500, VIX, ABD 10Y faiz, ons altın, Brent ve
Bitcoin tek ekranda (~11 istek — 600 sembollük taramanın yanında ihmal edilebilir).

- Her kart 1g / 1h / 1a / 3a / YBB / 1y değişimi taşır; **hangi dönemin gösterildiği
  kartın üstündeki anahtardan seçilir ve yüzdenin yanında yazar** (dönem etiketi kuralı).
- Veri `2y` çekilir ama grafik son 1 yılı gösterir: "1 yıllık değişim" 252 işlem günü
  geriye baktığından tam 1 yıl çekilince o alan sınırda kalıp çoğu enstrümanda boş dönüyordu.
- **Gram altın türetilmiştir** (ons × kur ÷ 31,1035), ayrı istek atılmaz; iki seri
  farklı tatil takvimlerinde olabildiğinden yalnızca ortak tarihlerde hesaplanır
  (eksik günü doldurmak olmayan bir hareket uydururdu).
- **İstekler taramanın EN BAŞINDA atılır.** İlk sürümde sonda duruyordu ve canlıda
  şu görüldü: 600+ sembol tarandıktan sonra yfinance rate-limit'e geçiyor ve 11
  isteğin **hepsi** "Too Many Requests" alıyor — panel bomboş yayınlandı. Makro veri
  taramanın çıktısına bağlı olmadığından başta durmasının maliyeti yok.
- **İkinci savunma:** eksik kalan gösterge, yayındaki son `macro.json`'dan
  `merge_with_previous_macro` ile tamamlanır ve arayüzde **"eski veri"** rozeti +
  tarihi ile gösterilir. Kartın tamamen kaybolması, bir gün eski veriyi tarihiyle
  göstermekten kötüdür; ama etiketsiz göstermek de bugünün rakamı sanılmasına yol
  açardı. `tests/test_scan_macro_merge.py` bunu kilitler (üst üste iki başarısız
  koşuda tarihin "kaymaması" dahil).
- **BIST korelasyonu GÜNLÜK GETİRİ üzerinden** hesaplanır (90 gün), fiyat seviyesi
  üzerinden değil: iki yükselen seri seviyede neredeyse her zaman yüksek korelasyon
  verir ve bu sahte bir ilişkidir. `tests/test_macro.py` bunu bir testle kilitler.

## Görsel Dil: Rozetler ve İkonlar
`TickerLogo` gerçek şirket logosu değil, sembol kodundan türetilen iki harftir.
Eskiden her sembole isminden türetilen **rastgele doygun bir renk** atanıyordu;
ekranda yan yana onlarca farklı renk arayüze "hazır klip art" havası veriyordu.
Artık tek nötr yüzey kullanılıyor: rozet dekor değil, satırı taramayı kolaylaştıran
tipografik bir işarettir. (Gerçek logolar hâlâ yok — BIST için güvenilir ve ücretsiz
tek bir kaynak yok, elle toplanıp repoya konması gerekir.)

Sol menü ikonları da emoji değil, `NAV_ICON_PATHS` içindeki ince çizgi SVG'lerdir.
Emoji her işletim sisteminde farklı çizilir, boyutu satır yüksekliğine göre zıplar
ve tema rengini almaz; SVG'ler `currentColor` kullandığından menüyle birlikte
renk değiştirir. Harici ikon kütüphanesi bağımlılığı yoktur.

## Derin Bağlantı ve Paylaşım
Uygulamanın hiç URL durumu yoktu: paylaşılan her bağlantı karşı tarafı "Bugün"
sayfasına düşürüyordu ve hiçbir ekran yer imine eklenemiyordu. Artık görünüm, market,
zaman dilimi ve açık hisse adres çubuğuna yazılır (`?v=…&m=…&tf=…&s=…`), başlıktaki
🔗 düğmesi bağlantıyı kopyalar.

- `replaceState` kullanılır, `pushState` değil: her sekme değişimi geri tuşuna bir adım
  eklerse tarayıcıdan çıkmak imkânsızlaşırdı.
- Market/zaman dilimi yalnızca ONLARI gösteren sekmelerde yazılır; "Bugün"ün
  bağlantısında `m=bist100` durması orada bir market seçimi varmış izlenimi verirdi.
- **Favori listesi paylaşımı** (`?w=HISSE1,HISSE2|FON1,FON2`): karşı tarafa SORULUR,
  onaylarsa kendi listesine EKLENİR (mevcut favorileri silinmez).
### Paylaş / İndir Şeridi (`ShareBar`)
Tarama, Fonlar, Temettü ve Makro sayfalarında aynı şerit durur: **CSV indir**,
**kart indir (PNG)**, **X'te paylaş** ve destekleyen cihazlarda **yerel paylaş menüsü**.

- Kart, DOM'un ekran görüntüsü DEĞİL, canvas'a çizilen amaca özel bir görseldir
  (`drawListCard`). Böylece html2canvas gibi bir bağımlılık gerekmez, her temada
  aynı görünür ve **yatırım tavsiyesi uyarısı görselden koparılamaz**.
- Etiketler `ellipsize` ile kutuya sığdırılır: veri kaynaklı uzun bir isim
  (fon adı gibi) geldiğinde etiket ile değer çakışıp kartı okunmaz hale getirirdi.
  100 karakterlik yapay bir etiketle test edildi — 46px temiz boşluk kalıyor.
- **X penceresi senkron açılır, karttan ÖNCE.** `await`ten sonra çağrılan
  `window.open` kullanıcı hareketi bağlamını kaybeder ve açılır pencere
  engelleyicisine takılır: kullanıcı butona basar, kart iner, X hiç açılmazdı.
  Kart arka planda üretilir.
- **X, web intent ile görsel eklemez.** Bu yüzden akış "önce kartı indir, sonra
  X'i hazır metinle aç" biçiminde kurgulandı ve buton ipucu bunu açıkça söylüyor.
  Paylaşılan bağlantı o anki derin bağlantıdır: karşı taraf tam olarak aynı ekranı açar.
- Yerel paylaş menüsü (`navigator.share`) destekliyorsa görseli dosya olarak da ekler.

- Cevaplanmamış liste daveti adreste kalır. Sebebi ölçülen bir hata: ilk ziyarette
  service worker güncellemesi sayfayı yeniden yüklüyor (`main.jsx`) ve parametre
  senkron sırasında silinince paylaşılan liste sessizce kayboluyordu.

## Fiyat Serileri: Sembol Başına Dosya
Grafik verisi eskiden TEK bir `stock_prices.json` dosyasındaydı: **8,4 MB ham /
2,6 MB sıkıştırılmış** (611 sembol x 270 mum). Kullanıcı tek bir hisseye
tıkladığında bu dosyanın TAMAMI iniyordu — yani en yüksek niyetli an (grafiği
açmak) sitenin en yavaş anıydı. Canlıda ölçüldü: 604 ms hızlı bağlantıda, mobil
4G'de 4-10 saniye.

Artık her sembol kendi dosyasında: `data/prices/{SEMBOL}.json` (~13 KB ham /
~3,3 KB sıkıştırılmış). Ölçülen sonuç:

| Senaryo | Önce | Sonra |
|---|---|---|
| Bir hissenin grafiğini açmak | 2.615 KB | **3 KB** |
| Tarama (sinyal listesi, 5 satır) | 2.615 KB | **16 KB** |
| Tarama ("tüm hisseler", 99 satır) | 2.615 KB | **197 KB** |

- Dosya adı eşlemesi iki yerde: `app/data/price_files.py::price_file_name` ve
  `frontend/src/api.js::priceFileName` — **biri değişirse diğeri de değişmeli.**
  `assert_unique_file_names` iki sembolün aynı dosyaya düşmesini taramayı
  durdurarak engeller: sessizce üzerine yazmak, bir hissenin grafiğinde BAŞKA bir
  hissenin fiyatını göstermek olurdu.
- Arayüzdeki veri şekli (`{ series: { SEMBOL: [...] } }`) bilerek korundu; değişen
  yalnızca ne zaman ne kadarının indiği, bu yüzden tüm tüketiciler dokunulmadan çalışıyor.
- Eş zamanlı istek sayısı 6 ile sınırlı: 60 isteği aynı anda açmak tarayıcı
  kuyruğunu kilitler ve kullanıcının tıkladığı hisse arkada kalırdı.
- Mini grafikler iki katmanlı yükleniyor: ilk `SPARKLINE_LIMIT` (60) satır peşin,
  gerisi kaydırıldıkça `IntersectionObserver` ile. İkinci katman tek başına
  bırakılmadı çünkü **bu geliştirme ortamında doğrulanamıyor** (tarayıcı paneli
  kare derlemediğinden gözlemci geri çağrıları hiç tetiklenmiyor); ona bel bağlayan
  bir tasarım "çalıştığını sandığım" bir tasarım olurdu.

## Veri Kalitesi: Bölünme (Split) Onarımı
`app/data/repair.py`, Yahoo'nun uygulamadığı bölünmeleri düzeltir. Gerçek örnek:
CCOLA.IS'in 11:1 bölünmesi Yahoo'da **2024-08-13** kayıtlı ama fiyat serisi **2024-08-01**'de
düşüyor → seride tek günde **-%91** duruyordu (BIST'te günlük limit ±%10, yani imkânsız).
Bu artefakt taramayı da bozar: yapay sıçrama fiyatı tüm EMA'ların altına/üstüne atıp sahte
sinyal üretebilir.

Onarım **yalnızca** üçü birden sağlanınca yapılır: (1) tek mumda büyük sıçrama,
(2) oranı kayıtlı bir bölünmeyle eşleşiyor, (3) o bölünmenin tarihi sıçramaya yakın.
Bu şart bilerek dardır — sadece eşiğe bakan bir onarım, ABD hisselerindeki gerçek sert
düşüşleri ve örneğin BIST'in **6 Şubat 2023 depremi sonrası kapanıp açılışındaki %21,7'lik
gerçek hareketi** silerdi. Bölünme bilgisi fetch ile aynı istekte geldiğinden ek maliyeti yok.

Not: yfinance hacmi `int64` döndürür; float ölçekle bölmek numpy'da "same_kind" cast
hatası verir ve bu hata sembolün sessizce atlanmasına yol açıyordu (BIST 100'de 98/100).
Bu yüzden onarım önce eşleşmeleri toplar, yalnızca gerçekten onarım varsa kolonları
float'a çevirir. `tests/test_repair.py` bu durumu int64 hacimle kilitler.

## Büyüme / Ürünleşme Fikirleri (öncelik sırası netleşecek)
- **Rakip taraması ve eksik listesi: [`docs/eksikler.md`](docs/eksikler.md)** —
  Türkçe borsa platformlarıyla karşılaştırma, önceliklendirilmiş eksikler ve
  önerilen sıra (2026-08-24).
- Google Play yayını (aşağıdaki yol haritası; Play hesabı mevcut)
- Telegram/X botları (yukarıda — sadece token bekliyor)
- Gelir modeli seçenekleri: web'de AdSense, sponsorluk, premium filtreler/uyarılar
- Kişisel uyarılar (belirli hisse filtreye girince bildirim) — Telegram botu üzerinden

## Google Play'e Yayınlama Yol Haritası
Mevcut strateji: native uygulama yazmak yerine web arayüzünü PWA→TWA (Trusted Web Activity)
ile Android paketine sarmalamak — mevcut React kodu değişmeden kullanılır.

1. ~~Uygulamayı internete aç.~~ Tamamlandı: yukarıdaki GitHub Pages altyapısı ile yayında.
   (İleride anlık tarama/canlı veri istenirse `Procfile` ile Railway/Render'a backend
   deploy edilebilir; şimdilik gerek yok.)
2. **PWA doğrulaması.** Yayındaki adreste Chrome DevTools → Lighthouse → PWA denetimini çalıştır,
   manifest/service worker/ikonlar eksiksiz mi kontrol et.
3. **TWA paketleme.** [Bubblewrap CLI](https://github.com/GoogleChromeLabs/bubblewrap) ile
   yayındaki PWA adresinden bir Android App Bundle (`.aab`) üret; `assetlinks.json` dosyasını
   sitenin `.well-known/` klasörüne koyup domain sahipliğini doğrula.
4. **Google Play Developer hesabı.** play.google.com/console üzerinden hesap aç (tek seferlik
   25$ ücret + kimlik doğrulama) — bu adımı kendin yapman gerekiyor.
5. **Gizlilik politikası.** Play Store zorunlu kılıyor; basit bir statik sayfa yeterli
   (hangi veri toplanıyor/toplanmıyor — bu uygulama kullanıcı verisi toplamıyor, bunu belirt).
6. **İçerik/finans politikası dikkat.** Google Play, finansal içerikli uygulamalar için ek
   inceleme yapabiliyor. Uygulamanın "yatırım tavsiyesi değildir" ifadesini arayüzde ve
   store açıklamasında belirtmek incelemeyi kolaylaştırır.
7. **Store listing + yükleme.** Ekran görüntüleri, açıklama, içerik derecelendirme anketini
   doldur, `.aab`'yi yükle, önce "Internal testing" ile dene, sonra production'a aç.
