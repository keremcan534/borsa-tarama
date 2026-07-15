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

## TEFAS Fonları
`app/funds/` altında TEFAS YAT fonları için getiri/risk taraması var (RSI/MACD yok;
1a/3a/6a/1y/YTD getiri, volatilite, Sharpe, max düşüş, 0-100 puan). `scan_to_json.py`
her çalıştırmada `funds.json` üretir; arayüzde **Fonlar** sekmesi gösterir.
API: `GET /api/funds` (canlı tarama ~3 dk sürebilir; TEFAS rate-limit).

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
