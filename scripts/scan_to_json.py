"""Her iki marketi tarar ve sonuçları statik JSON dosyalarına yazar.

GitHub Actions'ta zamanlanmış olarak çalışır; çıktılar frontend build'ine
gömülüp GitHub Pages'te yayınlanır. Ayrıca günlük SEO rapor sayfasını
reports/ klasörüne yazar (workflow bunu repoya commit'ler). Kullanım:

    python scripts/scan_to_json.py frontend/public/data [reports]
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.data.benchmarks import BENCHMARKS, benchmark_summary, fetch_benchmark
from app.data.dividends import build_dividend_payload
from app.data.fetchers.yfinance_fetcher import YFinanceFetcher
from app.data.fx import fetch_fx_series
from app.data.macro import CORRELATION_BARS, build_macro_payload
from app.data.markets import enabled_markets, load_symbols
from app.funds.screen import run_fund_screener
from app.news.collect import build_news_payload
from app.reports.generate import SITE_URL, build_report_html
from app.screener.engine import run_analysis
from app.screener.filters import passes_filters
from app.screener.score import technical_score
from app.screener.timeframes import TIMEFRAMES

# Arayüzdeki filtre panelinin varsayılan eşikleri (client-side filtreleme için)
DEFAULT_THRESHOLDS = {"rsi": 70, "stoch_k": 80, "stoch_rsi_k": 80, "macd_positive": True}


# Fon akışı arşivi bu kadar günü aşınca en eski günler düşer
FLOW_HISTORY_DAYS = 90


def fetch_previous_flows() -> dict:
    """Yayındaki fund_flows.json'dan birikmiş yatırımcı sayısı arşivini çeker.

    data/ klasörü repoya commit'lenmediği için önceki koşunun çıktısı yalnızca
    yayındaki dosyadan alınabilir (fetch_previous_symbols ile aynı desen).
    Erişilemezse boş arşivle başlanır.
    """
    try:
        resp = requests.get(f"{SITE_URL}data/fund_flows.json", timeout=15)
        resp.raise_for_status()
        history = resp.json().get("history")
        return history if isinstance(history, dict) else {}
    except Exception as e:
        print(f"[FON] önceki akış arşivi alınamadı ({e}); yeni arşiv başlatılıyor")
        return {}


# Skor/sinyal geçmişi (değişim raporu) için gün sayısı tavanı. Bu arşiv TÜM
# sembollerin skorunu taşır (gün başına ~600 kayıt), o yüzden kısa tutulur.
SCORE_HISTORY_DAYS = 30

# Sinyal karnesi arşivi: yalnızca TAZE sinyaller kaydedilir (gün başına ~60 kayıt),
# bu yüzden çok daha uzun saklanabilir. Karnenin değeri ileriye dönük ve
# uydurulamaz olmasında: her tarama o günün sinyallerini fiyatıyla mühürler.
SIGNAL_LOG_DAYS = 400


def fetch_previous_signal_log() -> dict:
    """Yayındaki signal_log.json'dan birikmiş sinyal karnesi arşivini çeker."""
    try:
        resp = requests.get(f"{SITE_URL}data/signal_log.json", timeout=15)
        resp.raise_for_status()
        history = resp.json().get("history")
        return history if isinstance(history, dict) else {}
    except Exception as e:
        print(f"[KARNE] önceki sinyal arşivi alınamadı ({e}); yeni arşiv başlatılıyor")
        return {}


def fetch_previous_scores() -> dict:
    """Yayındaki score_history.json'dan birikmiş günlük skor/sinyal arşivi."""
    try:
        resp = requests.get(f"{SITE_URL}data/score_history.json", timeout=15)
        resp.raise_for_status()
        history = resp.json().get("history")
        return history if isinstance(history, dict) else {}
    except Exception as e:
        print(f"[SCAN] önceki skor arşivi alınamadı ({e}); yeni arşiv başlatılıyor")
        return {}


def fetch_previous_macro() -> dict:
    """Yayındaki macro.json: rate-limit'te eksik kalan kartları tamamlamak için."""
    try:
        resp = requests.get(f"{SITE_URL}data/macro.json", timeout=15)
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, dict) else {}
    except Exception as e:
        print(f"[MAKRO] önceki panel alınamadı ({e}); yalnızca taze veri yayınlanacak")
        return {}


def merge_with_previous_macro(fresh: dict, previous: dict) -> dict:
    """Taze veride olmayan göstergeleri öncekinden `stale` işaretiyle tamamlar.

    Sıra öncekinin değil TAZE payload'ın sırasını izler; eksikler kendi grup
    sırasına göre sona eklenir (arayüz zaten gruplayarak gösteriyor).
    """
    prev_items = {i.get("key"): i for i in previous.get("items", []) if i.get("key")}
    if not prev_items:
        return fresh

    fresh_keys = {i.get("key") for i in fresh.get("items", [])}
    filled = list(fresh.get("items", []))
    prev_date = previous.get("generated_at")

    for key, item in prev_items.items():
        if key in fresh_keys:
            continue
        # `stale` bayrağı arayüzde etiketle görünür: kullanıcı rakamın bugüne ait
        # olmadığını bilmeli, sessizce eski veri göstermek yanıltıcı olurdu.
        filled.append({**item, "stale": True, "as_of": item.get("as_of") or prev_date})

    fresh["items"] = filled
    fresh["count"] = len(filled)
    fresh.setdefault("correlation_bars", previous.get("correlation_bars", CORRELATION_BARS))
    return fresh


def main() -> None:
    out_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
    reports_dir = Path(sys.argv[2] if len(sys.argv) > 2 else "reports")
    out_dir.mkdir(parents=True, exist_ok=True)
    reports_dir.mkdir(parents=True, exist_ok=True)

    fetcher = YFinanceFetcher()
    all_market_payloads: dict[str, dict[str, dict]] = {}
    markets = enabled_markets()

    # Makro panel EN BAŞTA çekilir. Ölçülen sebep: ilk sürümde taramanın sonunda
    # duruyordu ve 600+ sembolden sonra yfinance'in rate-limit'i devreye girip
    # 11 isteğin HEPSİ "Too Many Requests" aldı — panel canlıda boş yayınlandı.
    # Sıranın başında bütçe daha taze; ayrıca makro veri taramanın çıktısına
    # bağlı olmadığından burada durmasının bir maliyeti yok.
    try:
        macro_payload = build_macro_payload(fetcher)
    except Exception as e:
        print(f"[MAKRO] panel üretilemedi ({e})")
        macro_payload = {"count": 0, "correlation_bars": CORRELATION_BARS, "items": []}
    # Eksik kalan göstergeler yayındaki son veriden tamamlanır: rate-limit yüzünden
    # kartın tamamen KAYBOLMASI, bir gün eski veriyi tarihiyle göstermekten kötüdür.
    macro_payload = merge_with_previous_macro(macro_payload, fetch_previous_macro())
    macro_payload["generated_at"] = datetime.now(timezone.utc).isoformat()
    macro_path = out_dir / "macro.json"
    macro_path.write_text(json.dumps(macro_payload, ensure_ascii=False), encoding="utf-8")
    stale = sum(1 for i in macro_payload["items"] if i.get("stale"))
    print(f"[MAKRO] {macro_payload['count']} gösterge ({stale} tanesi eski veriden) -> {macro_path}")

    # Arayüz market listesini bu manifestten okur: kapalı bir marketin sekmesi
    # gösterilip veri dosyası bulunamaması (backend/frontend drift'i) böyle önlenir.
    manifest_path = out_dir / "markets.json"
    manifest_path.write_text(json.dumps(markets), encoding="utf-8")
    print(f"[MARKET] etkin marketler: {', '.join(markets)} -> {manifest_path}")

    # Hisse fiyat serileri: BIST verisi TradingView'in anonim embed widget'ından
    # kaldırıldığı için grafik artık kendi verimizden çizilir. Seriler günlük
    # taramada zaten çekilen veriden toplanır (ek istek yok).
    stock_series: dict[str, list] = {}

    # Değişim raporu için günlük skor + sinyal durumu: {SYM: {"s": skor, "g": 0/1}}
    score_today: dict[str, dict] = {}

    # Temettü takvimi girdisi: günlük taramadaki her hisse (sembol + fiyat + market).
    # Ödemeler ve ex-tarih fetcher cache'inde zaten var, ek istek atılmaz.
    dividend_rows: list[dict] = []

    # Sinyal karnesi: bu taramada TAZE sinyal veren hisseler, fiyatıyla mühürlenir
    signal_log_today: list[dict] = []
    # Karnede giriş fiyatı olarak GÜNLÜK kapanış kullanılır. Haftalık/aylık sinyalin
    # kendi mumu 5 güne (aya) kadar eski olabilir; kullanıcının sinyali gördüğü gün
    # karşısına çıkan fiyat ise güncel piyasa fiyatıdır. Karne "site bu sinyali verdiği
    # gün fiyat X'ti, bugün Y" demek istediğinden ölçü noktası o gün olmalı.
    daily_close: dict[str, float] = {}

    for market in markets:
        symbols = load_symbols(market)
        min_turnover = settings.min_daily_turnover.get(market)
        signal_symbols: list[str] = []  # haberler için: günlük öncelikli sinyal birleşimi
        market_payloads: dict[str, dict] = {}

        for timeframe in TIMEFRAMES:
            config = TIMEFRAMES[timeframe]
            ema_periods = config["ema_periods"]
            # Göreli güç için endeks: market/timeframe başına tek istek, tüm sembollerde paylaşılır
            benchmark_df = fetch_benchmark(market, fetcher, config["period"], config["interval"])
            benchmark_close = benchmark_df["close"] if benchmark_df is not None else None

            stocks = run_analysis(
                symbols,
                fetcher,
                timeframe,
                min_turnover,
                benchmark_close,
                series_sink=stock_series if timeframe == "daily" else None,
            )
            results = [s for s in stocks if passes_filters(s, ema_periods)]

            # Günlük skor arşivi (yalnızca daily): tüm taranan hisselerin puanı +
            # sinyal (filtreden geçti mi) durumu. Değişim raporu bundan üretilir.
            if timeframe == "daily":
                # Karne giriş fiyatları için güncel piyasa fiyatı (TIMEFRAMES sırası
                # daily ile başladığından sonraki dilimler bu haritayı hazır bulur).
                for s in stocks:
                    daily_close[s["symbol"]] = s["close"]
                    dividend_rows.append(
                        {
                            "symbol": s["symbol"],
                            "market": market,
                            "close": s["close"],
                            "sector": s.get("sector"),
                        }
                    )

                # Endeksin kendi serisi de kaydedilir: "BIST 100 dolar bazında" gibi
                # endeks grafiklerini hisselerle aynı yoldan çizebilmek için (df zaten elde).
                bench_symbol = BENCHMARKS.get(market)
                if bench_symbol and benchmark_df is not None and bench_symbol not in stock_series:
                    bars = benchmark_df[["open", "high", "low", "close"]].dropna(subset=["close"]).tail(270)
                    stock_series[bench_symbol] = [
                        [
                            ts.strftime("%Y-%m-%d"),
                            round(float(row.close), 4),
                            round(float(row.open), 4),
                            round(float(row.high), 4),
                            round(float(row.low), 4),
                        ]
                        for ts, row in bars.iterrows()
                    ]

                signal_syms = {s["symbol"] for s in results}
                for s in stocks:
                    score_today[s["symbol"]] = {
                        "s": technical_score(s, ema_periods),
                        "g": 1 if s["symbol"] in signal_syms else 0,
                    }

            # "Yeni sinyal": filtre son kapanmış mumda açıldı mı (signal_fresh,
            # analyze_symbol'de hesaplanır). Önceki taramayla kıyaslayan eski yöntem
            # haftalık/aylık sinyali yalnızca tek koşu boyu "yeni" gösteriyordu; bu
            # tanım tüm periyot boyunca doğru kalır ve backtest'in giriş kuralıyla aynıdır.
            new_count = 0
            for s in results:
                s["is_new"] = bool(s.get("signal_fresh"))
                if s["is_new"]:
                    new_count += 1
                    # Karne kaydı: sinyali O GÜNKÜ piyasa fiyatıyla mühürle. Fiyatı
                    # burada saklamak karneyi fiyat serisi arşivinin ömründen bağımsız
                    # kılar. Günlük kapanış yoksa (ör. o sembol günlük taramaya girmemiş)
                    # kendi diliminin kapanışına düşülür.
                    signal_log_today.append(
                        {
                            "s": s["symbol"],
                            "m": market,
                            "tf": timeframe,
                            "p": daily_close.get(s["symbol"], s["close"]),
                        }
                    )

            for s in results:
                if s["symbol"] not in signal_symbols:
                    signal_symbols.append(s["symbol"])

            payload = {
                "market": market.upper(),
                "timeframe": timeframe,
                "count": len(results),
                "new_count": new_count,
                "scanned": len(symbols),
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "results": results,
                # Arayüzde kullanıcı tanımlı eşiklerle yeniden filtreleme için
                # tüm hisselerin gösterge değerleri + varsayılan eşikler
                "stocks": stocks,
                "ema_periods": ema_periods,
                "thresholds": DEFAULT_THRESHOLDS,
                # "Bugün" sayfasının endeks nabzı kartı için
                "benchmark": benchmark_summary(benchmark_df, market),
            }
            market_payloads[timeframe] = payload

            # Günlük dosya adı geriye dönük uyumluluk için eksiz kalır.
            suffix = "" if timeframe == "daily" else f"_{timeframe}"
            out_path = out_dir / f"{market}{suffix}.json"
            out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
            print(f"[SCAN] {market}/{timeframe}: {len(results)} sonuç ({new_count} yeni) -> {out_path}")

        all_market_payloads[market] = market_payloads

        news_payload = build_news_payload(market, signal_symbols)
        news_path = out_dir / f"news_{market}.json"
        news_path.write_text(json.dumps(news_payload, ensure_ascii=False), encoding="utf-8")
        print(f"[HABER] {market}: {len(news_payload['items'])} başlık -> {news_path}")

    stock_prices_path = out_dir / "stock_prices.json"
    stock_prices_path.write_text(
        json.dumps(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "series": stock_series,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(f"[SCAN] {len(stock_series)} hisse fiyat serisi -> {stock_prices_path}")

    # Temettü takvimi: ödemeler günlük fiyat isteğinden, yaklaşan ex-tarih temel
    # oran (.info) isteğinden düşer — bu adım ek istek atmaz, yalnızca hesap yapar.
    try:
        dividends_payload = build_dividend_payload(dividend_rows, fetcher)
    except Exception as e:
        print(f"[TEMETTÜ] takvim üretilemedi ({e}); boş payload yazılıyor")
        dividends_payload = {"count": 0, "upcoming_count": 0, "items": [], "upcoming": []}
    dividends_payload["generated_at"] = datetime.now(timezone.utc).isoformat()
    dividends_path = out_dir / "dividends.json"
    dividends_path.write_text(json.dumps(dividends_payload, ensure_ascii=False), encoding="utf-8")
    print(
        f"[TEMETTÜ] {dividends_payload['count']} hisse "
        f"({dividends_payload['upcoming_count']} yaklaşan) -> {dividends_path}"
    )

    # Döviz/altın serileri: arayüzdeki TL / $ / gram altın anahtarı bunlardan besleniyor.
    fx = fetch_fx_series(fetcher)
    fx_path = out_dir / "fx.json"
    fx_path.write_text(
        json.dumps(
            {"generated_at": datetime.now(timezone.utc).isoformat(), **fx},
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(f"[FX] usdtry={len(fx.get('usdtry', []))} goldusd={len(fx.get('goldusd', []))} -> {fx_path}")

    # Skor/sinyal geçmişi: değişim raporu (skoru en çok yükselen/düşen, sinyale
    # yeni giren/çıkan) arayüzde son iki günü karşılaştırarak üretilir.
    score_history = fetch_previous_scores()
    scan_day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if score_today:
        score_history[scan_day] = score_today
    score_history = dict(sorted(score_history.items())[-SCORE_HISTORY_DAYS:])
    score_path = out_dir / "score_history.json"
    score_path.write_text(
        json.dumps(
            {"generated_at": datetime.now(timezone.utc).isoformat(), "history": score_history},
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(f"[SCAN] skor arşivi: {len(score_history)} gün -> {score_path}")

    # Sinyal karnesi arşivi: "site N hafta önce şu sinyalleri verdi, bugün ne durumda?"
    # Aynı gün iki kez tarama çalıştığında gün kaydı ÜZERİNE yazılır (mükerrer kayıt olmaz).
    signal_log = fetch_previous_signal_log()
    if signal_log_today:
        signal_log[scan_day] = signal_log_today
    signal_log = dict(sorted(signal_log.items())[-SIGNAL_LOG_DAYS:])
    signal_log_path = out_dir / "signal_log.json"
    signal_log_path.write_text(
        json.dumps(
            {"generated_at": datetime.now(timezone.utc).isoformat(), "history": signal_log},
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(
        f"[KARNE] sinyal arşivi: {len(signal_log)} gün, "
        f"bugün {len(signal_log_today)} taze sinyal -> {signal_log_path}"
    )

    # TEFAS yatırım fonları (hisse pipeline'ından ayrı: getiri/risk metrikleri).
    # Fiyat serileri ayrı dosyada: karşılaştırma grafiği için; liste JSON'unu şişirmez.
    fund_series: dict = {}
    try:
        fund_results, fund_series = run_fund_screener(include_series=True)
        funds_payload = {
            "market": "FUNDS",
            "count": len(fund_results),
            "scanned": len(fund_results),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "results": fund_results,
            "metrics": [
                "return_1m",
                "return_3m",
                "return_6m",
                "return_1y",
                "return_ytd",
                "volatility",
                "sharpe",
                "max_drawdown",
                "score",
            ],
        }
    except Exception as e:
        print(f"[FON] tarama başarısız ({e}); boş payload yazılıyor")
        fund_results = []
        funds_payload = {
            "market": "FUNDS",
            "count": 0,
            "scanned": 0,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "results": [],
            "error": str(e),
            "metrics": [],
        }
    funds_path = out_dir / "funds.json"
    funds_path.write_text(json.dumps(funds_payload, ensure_ascii=False), encoding="utf-8")
    print(f"[FON] {funds_payload['count']} fon -> {funds_path}")

    # Karşılaştırma benchmark'ları (normalize eğri için). Başarısız olanlar sessizce atlanır.
    benchmarks: dict[str, dict] = {}
    for symbol, name in (
        ("XU100.IS", "BIST 100"),
        ("USDTRY=X", "USD/TRY"),
        ("GC=F", "Altın (ons)"),
    ):
        try:
            bdf = fetcher.fetch_ohlcv(symbol, period="1y", interval="1d")
            if bdf is None or bdf.empty or "close" not in bdf.columns:
                continue
            points = []
            for ts, row in bdf.iterrows():
                px = float(row["close"])
                if px <= 0:
                    continue
                day = ts.strftime("%Y-%m-%d") if hasattr(ts, "strftime") else str(ts)[:10]
                points.append([day, round(px, 4)])
            if points:
                benchmarks[symbol] = {"name": name, "points": points}
        except Exception as e:
            print(f"[FON] benchmark {symbol} alınamadı: {e}")

    prices_payload = {
        "generated_at": funds_payload["generated_at"],
        "series": fund_series,
        "benchmarks": benchmarks,
    }
    prices_path = out_dir / "fund_prices.json"
    prices_path.write_text(json.dumps(prices_payload, ensure_ascii=False), encoding="utf-8")
    print(
        f"[FON] {len(fund_series)} fiyat serisi + {len(benchmarks)} benchmark -> {prices_path}"
    )

    # Fon akışı arşivi: günlük yatırımcı sayıları birikir; arayüz bundan
    # "son 7/30 günde en çok yatırımcı kazanan/kaybeden" listesini üretir.
    flows_history = fetch_previous_flows()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    counts = {
        r["symbol"]: r["investor_count"]
        for r in fund_results
        if r.get("investor_count") is not None
    }
    if counts:
        flows_history[today] = counts
    flows_history = dict(sorted(flows_history.items())[-FLOW_HISTORY_DAYS:])
    flows_path = out_dir / "fund_flows.json"
    flows_path.write_text(
        json.dumps(
            {"generated_at": funds_payload["generated_at"], "history": flows_history},
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(f"[FON] akış arşivi: {len(flows_history)} gün -> {flows_path}")

    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    report_path = reports_dir / f"{date_str}.html"
    report_path.write_text(build_report_html(date_str, all_market_payloads), encoding="utf-8")
    print(f"[RAPOR] günlük rapor -> {report_path}")


if __name__ == "__main__":
    main()
