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
- Fiyat, 9/21/50/200 günlük EMA'ların hepsinin üstünde (güçlü, teyitli yükseliş trendi)
- MACD Line > 0
- RSI < 70 (henüz aşırı alım bölgesinde değil)
- Stokastik %K < 80
- Stokastik RSI %K < 80

Yani zaten yükselişte olan ama henüz aşırı ısınmamış hisseleri bulur (momentum/trend takibi).

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
