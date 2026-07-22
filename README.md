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

## Etkin Marketler (S&P 500 şu an KAPALI)
Hangi marketlerin taranacağı `app/core/config.py` → `enabled_markets` ile belirlenir.
Market tanımları tek kaynakta: **`app/data/markets.py`** (`MARKET_FILES`, `SYMBOLS_DIR`,
`load_symbols`, `enabled_markets`). Eskiden `MARKET_FILES` hem `scheduler.py` hem
`api/routes/screener.py` içinde ayrı ayrı duruyordu ve elle senkron tutuluyordu — artık
ikisi de buradan okuyor.

**S&P 500 neden kapalı:** ölçüldü — deploy'un tamamı ~23 dk sürüyordu ve bunun **22,6
dakikası tarama adımıydı** (frontend build yalnızca 0,1 dk). Sembol dağılımı:

| Market | Sembol | İstek (×4 zaman dilimi) | Durum |
|---|---|---|---|
| bist100 | 100 | 400 | etkin |
| **sp500** | **503** | **2012 (%76)** | **kapalı** |
| **etf** | **46** | **184** | **kapalı** |
| commodity | 10 | 40 | etkin |

Yani S&P tek başına tüm işin **%76'sı**. Kapatınca 2636 → 624 istek; tarama ~5 dk'ya
iner. ETF de kapalı: tarama/strateji vizyonu hisse + emtia/kripto + TEFAS fonlarına
odaklanıyor. Global haber akışını emtia/kripto sembolleri besler.

**Geri açmak tek satır:** `enabled_markets` listesine `"sp500"` veya `"etf"` eklemek.
Kod ve sembol listeleri silinmedi. Daha ucuza geri getirmenin yolu için aşağıdaki
"Bilinen darboğaz"a bak.

**S&P nabzı:** `^GSPC` eskiden ETF marketinin karşılaştırma endeksi üzerinden "Bugün"
sayfasında görünüyordu. ETF kapalıyken bu kart gelmez; geri açınca (`"etf"` veya
`"sp500"`) kart marketin değil endeksin adını gösterir (`BENCHMARK_NAMES`).

**Arayüz senkronu:** tarama her koşuda `data/markets.json` manifestini yazar, arayüz
market sekmelerini bundan üretir. Böylece kapalı bir marketin sekmesi gösterilip veri
dosyası bulunamaması (backend/frontend drift'i) mümkün değil. Manifest çözülene kadar
veri isteği atılmaz — yoksa kapalı marketlerin dosyaları istenip 404 alınırdı.

### Bilinen darboğaz: her sembol 4 kez çekiliyor
Tarama her sembolü zaman dilimi başına ayrı çekiyor (1y günlük, 10y haftalık, max aylık,
max çeyreklik) — yani sembol başına **4 istek**. Oysa `max` günlük veri **bir kez** çekilip
pandas ile haftalık/aylık/çeyrekliğe resample edilebilir: istek sayısı 4'e bölünür.
Bu yapılırsa S&P 500 çok daha ucuza geri açılabilir. Henüz yapılmadı.

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
1a/3a/6a/1y/YTD getiri, volatilite, Sharpe, max düşüş, 0-100 puan). `scan_to_json.py`
her çalıştırmada `funds.json` (liste) ve `fund_prices.json` (günlük fiyat serileri +
BIST100/USD/altın benchmark) üretir. Arayüzde **Fonlar** listesi ve **Karşılaştır**
sekmesi (normalize getiri eğrisi, dönem seçimi, metrik tablosu) bunları kullanır.
API: `GET /api/funds` (canlı tarama ~3 dk sürebilir; TEFAS rate-limit).

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

### Sektör Dağılımı
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
