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
   Tamamlandı (2026-07-11): `test_indicators.py`, `test_filters.py` (yeni ucuz hisse/dip filtresi),
   `test_engine.py` (screen_symbol/run_screener, sahte fetcher ile), `test_yfinance_fetcher.py`
   (yfinance mocklanarak — network'e bağımlı değil). Toplam 25 test, hepsi geçiyor.
   Kural olarak kalıcı: yeni gösterge/filtre eklerken karşılık gelen testi de ekle.
