"""Her iki marketi tarar ve sonuçları statik JSON dosyalarına yazar.

GitHub Actions'ta zamanlanmış olarak çalışır; çıktılar frontend build'ine
gömülüp GitHub Pages'te yayınlanır. Ayrıca günlük SEO rapor sayfasını
reports/ klasörüne yazar (workflow bunu repoya commit'ler). Kullanım:

    python scripts/scan_to_json.py frontend/public/data [reports]
"""

import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.data.benchmarks import BENCHMARKS, benchmark_summary, fetch_benchmark
from app.funds.forecast import daily_returns, fit_forecast, latest_common_day
from app.data.dividends import build_dividend_payload
from app.data.fetchers.yfinance_fetcher import YFinanceFetcher
from app.data.calendars import build_calendar_payload
from app.data.financials import load_financials
from app.data.fx import fetch_fx_series
from app.data.inflation import load_cpi
from app.data.kap import fetch_disclosures
from app.data.macro import CORRELATION_BARS, build_macro_payload
from app.data.markets import enabled_markets, load_symbols
from app.data.price_files import assert_unique_file_names, price_file_name
from app.funds.categories import FUND_CATEGORIES, OTHER, categorize
from app.funds.screen import FUND_METRIC_KEYS, run_fund_screener
from app.news.collect import build_news_payload
from app.reports.generate import SITE_URL, build_report_html
from app.reports.fund_category_pages import (
    CATEGORY_DIR,
    build_category_index,
    build_category_page,
    category_url,
)
from app.reports.symbol_pages import build_symbol_index, build_symbol_page, symbol_slug, symbol_url
from app.screener.engine import run_analysis
from app.screener.filters import passes_filters
from app.screener.score import technical_score
from app.screener.timeframes import TIMEFRAMES

# Arayüzdeki filtre panelinin varsayılan eşikleri (client-side filtreleme için)
DEFAULT_THRESHOLDS = {"rsi": 70, "stoch_k": 80, "stoch_rsi_k": 80, "macd_positive": True}


def sanitize_for_json(value):
    """Sonlu olmayan her sayıyı (NaN/Inf) None'a çevirir — iç içe yapıları gezerek.

    Python'un json modülü NaN'i literal `NaN` olarak yazar ve tarayıcının
    JSON.parse'ı TÜM dosyayı reddeder: çeyreklik taramada stoch-rsi NaN'i tam
    olarak bunu yaptı ve "3 Aylık" sekmesi yayında ham hata kutusuna dönüştü.
    Göstergeler artık kaynakta temizleniyor (engine.finite_or_none) ama temel
    oranlar/piyasa değeri gibi dış kaynaklı alanlar da NaN taşıyabilir.
    """
    if isinstance(value, dict):
        return {k: sanitize_for_json(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [sanitize_for_json(v) for v in value]
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def dump_json(value) -> str:
    """Yazılan her dosya için tek kapı: önce temizlik, sonra allow_nan=False.

    allow_nan=False emniyet kilididir — temizlikten kaçan bir NaN sessizce
    bozuk dosya yayınlamak yerine taramayı burada patlatır.
    """
    return json.dumps(sanitize_for_json(value), ensure_ascii=False, allow_nan=False)


# Fon akışı arşivi bu kadar günü aşınca en eski günler düşer
FLOW_HISTORY_DAYS = 90

# fund_prices.json içinde satır içi taşınan seri sayısı (geri uyumluluk; geri
# kalanı fon başına dosyadan tek tek iner). Puana göre ilk N fon.
FUND_PRICES_INLINE = 120


def fetch_previous_funds() -> dict:
    """Yayındaki funds.json — tarama başarısız olduğunda listeyi korumak için.

    Neden gerekli: TEFAS, GitHub runner IP'lerinden zaman zaman zaman aşımına
    uğruyor (2026-08-29: 6 denemenin altısı da ReadTimeout). Eski davranışta bu
    tek ağ hatası yayındaki fon listesini SIFIRA indiriyordu — kullanıcı için
    "fonlar kayboldu" demek. Makro panelde aynı sorun `merge_with_previous_macro`
    ile çözülmüştü; buradaki karşılığı: bir gün eski liste, boş listeden iyidir
    (tarih zaten arayüzde yazıyor, bayatlık gizlenmiyor).
    """
    try:
        resp = requests.get(f"{SITE_URL}data/funds.json", timeout=20)
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, dict) else {}
    except Exception as e:
        print(f"[FON] yayındaki liste alınamadı ({e})")
        return {}


def fetch_previous_fund_prices() -> dict:
    """Yayındaki fund_prices.json (benchmark + satır içi seriler).

    Liste korunup fiyat serileri boş kalırsa grafikler kırılırdı; ikisi
    birlikte korunur.
    """
    try:
        resp = requests.get(f"{SITE_URL}data/fund_prices.json", timeout=30)
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, dict) else {}
    except Exception as e:
        print(f"[FON] yayındaki fiyat serileri alınamadı ({e})")
        return {}


def fetch_previous_flows() -> dict:
    """Yayındaki fund_flows.json'dan birikmiş fon akışı arşivini çeker.

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


SYMBOL_NAMES_PATH = Path(__file__).resolve().parents[1] / "app" / "data" / "symbols" / "bist_all_names.json"


def load_symbol_names() -> dict[str, str]:
    """Hisse kodu -> şirket adı (sayfa başlıkları için). Dosya yoksa boş."""
    try:
        return json.loads(SYMBOL_NAMES_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def write_symbol_pages(public_dir: Path, market_payloads: dict, financials: dict, kap_items: list[dict]) -> None:
    """Her taranan hisse için bağımsız HTML sayfası + dizin + manifest üretir.

    Sayfa GÜNLÜK zaman diliminin verisiyle basılır: kullanıcı bir hisseyi
    aradığında beklediği şey son kapanış ve güncel görünümdür, aylık mum değil.
    Manifest (`index.json`) yalnızca URL taşır; site haritasını `build_site_meta`
    ondan üretir, böylece iki script birbirinin veri yapısını bilmek zorunda kalmaz.
    """
    names = load_symbol_names()
    fin_by_symbol = financials.get("symbols") or {}

    kap_by_symbol: dict[str, list[dict]] = {}
    for item in kap_items:
        kap_by_symbol.setdefault(item["symbol"], []).append(item)

    symbol_dir = public_dir / "hisse"
    symbol_dir.mkdir(parents=True, exist_ok=True)

    generated_at = datetime.now(timezone.utc).isoformat()
    entries: list[tuple[str, str | None]] = []

    for market, payloads in market_payloads.items():
        # Emtia/kripto sembolleri için "hisse analizi" sayfası anlamsız olurdu.
        if market == "commodity":
            continue
        for stock in payloads.get("daily", {}).get("stocks") or []:
            symbol = stock["symbol"]
            name = names.get(symbol_slug(symbol))
            html = build_symbol_page(
                symbol,
                stock,
                name=name,
                financials=fin_by_symbol.get(symbol),
                kap_items=kap_by_symbol.get(symbol),
                generated_at=generated_at,
            )
            (symbol_dir / f"{symbol_slug(symbol)}.html").write_text(html, encoding="utf-8")
            entries.append((symbol, name))

    (symbol_dir / "index.html").write_text(build_symbol_index(entries), encoding="utf-8")
    (symbol_dir / "index.json").write_text(
        dump_json(
            {"generated_at": generated_at, "urls": [symbol_url(sym) for sym, _ in entries]},
        ),
        encoding="utf-8",
    )
    print(f"[HİSSE SAYFASI] {len(entries)} sayfa -> {symbol_dir}")


BENCHMARK_FACTORS = {"bist": "XU100.IS", "gold": "GC=F", "usd": "USDTRY=X"}


def attach_fund_forecasts(
    fund_results: list[dict], fund_series: dict, benchmarks: dict
) -> tuple[int, str | None]:
    """Fonlara ertesi gün tahminini ekler (bkz. app/funds/forecast.py).

    TEFAS fiyatı bir gün gecikmeli yayımladığından bugünkü piyasa hareketi
    yarınki fon fiyatına yansıyor; tahmin bunun hesabı. Kalite kapısını
    geçemeyen fona alan YAZILMAZ — arayüz o fonda tahmin göstermez.
    """
    missing = [s for s in BENCHMARK_FACTORS.values() if s not in benchmarks]
    if missing:
        print(f"[TAHMİN] benchmark eksik ({', '.join(missing)}); tahmin üretilmedi")
        return 0, None

    factor_ret = {
        name: daily_returns({d: px for d, px in benchmarks[symbol]["points"]})
        for name, symbol in BENCHMARK_FACTORS.items()
    }
    as_of = latest_common_day(factor_ret)
    if not as_of:
        print("[TAHMİN] benchmark serileri kesişmiyor; tahmin üretilmedi")
        return 0, None

    made = 0
    for row in fund_results:
        points = fund_series.get(row["symbol"])
        if not points:
            continue
        forecast = fit_forecast(daily_returns({d: px for d, px in points}), factor_ret, as_of)
        if forecast is None:
            continue
        # NaN/Inf JSON'a yazılamaz ve tarayıcıda tüm dosyayı bozar
        # (bkz. sanitize_for_json'ın çıkış noktası).
        values = (forecast.change, forecast.band, forecast.direction_rate, forecast.mae_gain)
        if not all(math.isfinite(v) for v in values):
            continue
        row["next_day"] = {
            "change": round(forecast.change, 6),
            "band": round(forecast.band, 6),
            "direction_rate": round(forecast.direction_rate, 3),
            "mae_gain": round(forecast.mae_gain, 3),
            "samples": forecast.samples,
            "driver": forecast.driver,
            "as_of": forecast.as_of,
        }
        made += 1
    print(f"[TAHMİN] {made}/{len(fund_results)} fona ertesi gün tahmini ({as_of} hareketiyle)")
    return made, as_of


def write_fund_category_pages(public_dir: Path, fund_results: list[dict], generated_at: str) -> None:
    """Kategori başına statik HTML sayfası + dizin + manifest üretir.

    Hisse sayfalarıyla aynı desen: sayfalar burada basılır, site haritasına
    `build_site_meta` manifestten ekler — iki script birbirinin veri yapısını
    bilmek zorunda kalmaz. Fonu olmayan kategori sayfası HİÇ basılmaz.
    """
    if not fund_results:
        print("[FON KATEGORİ] fon listesi boş; sayfa üretilmedi")
        return

    by_category: dict[str, list[dict]] = {}
    for fund in fund_results:
        # `category` taramada mühürlenir; alanı taşımayan eski bir liste
        # kurtarılmışsa addan türetilir (aksi halde hepsi "diğer"e düşer ve
        # tek bir kategori sayfası bile basılmazdı).
        key = fund.get("category") or categorize(fund.get("name"))
        by_category.setdefault(key, []).append(fund)

    category_dir = public_dir / CATEGORY_DIR
    category_dir.mkdir(parents=True, exist_ok=True)

    urls: list[str] = []
    counts: dict[str, int] = {}
    for category in FUND_CATEGORIES:
        funds = by_category.get(category.key) or []
        if not funds:
            continue  # boş kategori sayfası "içerik var" yalanı olurdu
        counts[category.key] = len(funds)
        html = build_category_page(category.key, funds, generated_at=generated_at)
        (category_dir / f"{category.slug}.html").write_text(html, encoding="utf-8")
        urls.append(category_url(category.slug))

    (category_dir / "index.html").write_text(
        build_category_index(counts, generated_at=generated_at), encoding="utf-8"
    )
    (category_dir / "index.json").write_text(
        dump_json({"generated_at": generated_at, "urls": urls}), encoding="utf-8"
    )
    print(f"[FON KATEGORİ] {len(urls)} kategori sayfası -> {category_dir}")


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
    macro_path.write_text(dump_json(macro_payload), encoding="utf-8")
    stale = sum(1 for i in macro_payload["items"] if i.get("stale"))
    print(f"[MAKRO] {macro_payload['count']} gösterge ({stale} tanesi eski veriden) -> {macro_path}")

    # Arayüz market listesini bu manifestten okur: kapalı bir marketin sekmesi
    # gösterilip veri dosyası bulunamaması (backend/frontend drift'i) böyle önlenir.
    manifest_path = out_dir / "markets.json"
    manifest_path.write_text(dump_json(markets), encoding="utf-8")
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

            # series_sink her zaman verilir: haftalık/aylık taramaya girip günlük
            # elemeye takılan sembollerin de grafiği olsun (sink günlük seriyi,
            # yalnızca eksik semboller için, fetcher cache'inden doldurur).
            stocks = run_analysis(
                symbols,
                fetcher,
                timeframe,
                min_turnover,
                benchmark_close,
                series_sink=stock_series,
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
            out_path.write_text(dump_json(payload), encoding="utf-8")
            print(f"[SCAN] {market}/{timeframe}: {len(results)} sonuç ({new_count} yeni) -> {out_path}")

        all_market_payloads[market] = market_payloads

        news_payload = build_news_payload(market, signal_symbols)
        news_path = out_dir / f"news_{market}.json"
        news_path.write_text(dump_json(news_payload), encoding="utf-8")
        print(f"[HABER] {market}: {len(news_payload['items'])} başlık -> {news_path}")

        # Fiyat cache'i market bitince boşaltılır. Fetcher artık sembol başına TÜM
        # günlük geçmişi bellekte tutuyor (haftalık/aylık/çeyreklik ondan türetiliyor,
        # bkz. app/data/resample.py) — sembol başına ~150 KB, 700 sembollük bir
        # markette ~100 MB. Tüm marketler birikirse runner'ın belleğini zorlar;
        # döngü market eksenli olduğundan bir marketin verisine bir daha bakılmaz.
        fetcher.clear_price_cache()

    # Fiyat serileri SEMBOL BAŞINA ayrı dosyalara yazılır. Eskiden tek bir
    # stock_prices.json vardı (8,4 MB ham / 2,6 MB sıkıştırılmış) ve tek bir
    # hisseye tıklamak bu dosyanın tamamını indiriyordu; ölçüldü, en yüksek
    # niyetli an sitenin en yavaş anıydı. Şimdi grafik açmak ~4 KB indiriyor.
    prices_dir = out_dir / "prices"
    prices_dir.mkdir(parents=True, exist_ok=True)
    assert_unique_file_names(stock_series.keys())

    generated_at = datetime.now(timezone.utc).isoformat()
    for symbol, bars in stock_series.items():
        path = prices_dir / f"{price_file_name(symbol)}.json"
        path.write_text(
            dump_json({"symbol": symbol, "bars": bars}),
            encoding="utf-8",
        )

    # Arayüzün "hangi sembollerin serisi var" sorusuna cevap veren küçük dizin
    # (portföy sayfasındaki hisse listesi bunu kullanır). Seri taşımaz.
    index_path = prices_dir / "index.json"
    index_path.write_text(
        dump_json(
            {"generated_at": generated_at, "symbols": sorted(stock_series.keys())},
        ),
        encoding="utf-8",
    )
    print(f"[SCAN] {len(stock_series)} hisse fiyat serisi -> {prices_dir}/ (sembol başına dosya)")

    # Temettü takvimi: ödemeler günlük fiyat isteğinden, yaklaşan ex-tarih temel
    # oran (.info) isteğinden düşer — bu adım ek istek atmaz, yalnızca hesap yapar.
    try:
        dividends_payload = build_dividend_payload(dividend_rows, fetcher)
    except Exception as e:
        print(f"[TEMETTÜ] takvim üretilemedi ({e}); boş payload yazılıyor")
        dividends_payload = {"count": 0, "upcoming_count": 0, "items": [], "upcoming": []}
    dividends_payload["generated_at"] = datetime.now(timezone.utc).isoformat()
    dividends_path = out_dir / "dividends.json"
    dividends_path.write_text(dump_json(dividends_payload), encoding="utf-8")
    print(
        f"[TEMETTÜ] {dividends_payload['count']} hisse "
        f"({dividends_payload['upcoming_count']} yaklaşan) -> {dividends_path}"
    )

    # Döviz/altın serileri: arayüzdeki TL / $ / gram altın anahtarı bunlardan besleniyor.
    fx = fetch_fx_series(fetcher)
    fx_path = out_dir / "fx.json"
    fx_path.write_text(
        dump_json(
            {"generated_at": datetime.now(timezone.utc).isoformat(), **fx},
        ),
        encoding="utf-8",
    )
    print(f"[FX] usdtry={len(fx.get('usdtry', []))} goldusd={len(fx.get('goldusd', []))} -> {fx_path}")

    # KAP bildirimleri: haber akışı Google News üzerinden çalışıyordu, yani ikincil
    # kaynak. Bilanço, pay alım-satım, özel durum açıklaması önce KAP'ta yayımlanır.
    # Tek istek — sembol başına değil, tüm borsa için (bkz. app/data/kap.py).
    scanned_symbols = {s["symbol"] for series in all_market_payloads.values() for s in
                       (series.get("daily", {}).get("stocks") or [])}
    kap_items = fetch_disclosures(symbols=scanned_symbols)
    kap_path = out_dir / "kap.json"
    kap_path.write_text(
        dump_json(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "count": len(kap_items),
                "items": kap_items,
            },
        ),
        encoding="utf-8",
    )
    print(f"[KAP] {len(kap_items)} bildirim -> {kap_path}")

    # TÜFE serisi: portföy ve fon getirilerinin reel (enflasyondan arındırılmış)
    # karşılığı arayüzde hesaplanıyor, seri bir kez indirilip payload'a konuyor.
    # `as_of` bilinçli olarak taşınır — arayüz hangi aya kadar veri olduğunu yazar
    # ve kapsanmayan dönemde reel getiriyi HİÇ göstermez.
    cpi = load_cpi()
    inflation_path = out_dir / "inflation.json"
    inflation_path.write_text(
        dump_json({"generated_at": datetime.now(timezone.utc).isoformat(), **cpi}),
        encoding="utf-8",
    )
    print(f"[TÜFE] {len(cpi['series'])} ay ({cpi['source'] or 'kaynak yok'}) -> {inflation_path}")

    # Ekonomik takvim: makro panel fiyat SEVİYELERİNİ gösteriyor, bu ise OLAYLARI.
    # Statik dosyadan okunur (bkz. app/data/calendars.py), istek atılmaz.
    calendar_payload = build_calendar_payload()
    calendar_path = out_dir / "calendar.json"
    calendar_path.write_text(
        dump_json(
            {"generated_at": datetime.now(timezone.utc).isoformat(), **calendar_payload},
        ),
        encoding="utf-8",
    )
    print(f"[TAKVİM] {calendar_payload['count']} yaklaşan olay -> {calendar_path}")

    # Çeyreklik finansallar repoda statik durur (bilanço çeyrekte bir değişir,
    # tarama günde iki kez çalışır); burada yalnızca siteye kopyalanır, istek atılmaz.
    financials = load_financials()
    financials_path = out_dir / "financials.json"
    financials_path.write_text(dump_json(financials), encoding="utf-8")
    print(f"[FİNANSAL] {len(financials.get('symbols') or {})} sembol -> {financials_path}")

    # Hisse başına statik sayfa: sitenin arama motorundan trafik alabilmesi için
    # tek gerçek içerik ekseni. Sitemap'te yalnızca tarih damgalı raporlar vardı,
    # oysa aramalar sembol adıyla yapılıyor (bkz. app/reports/symbol_pages.py).
    write_symbol_pages(out_dir.parent, all_market_payloads, financials, kap_items)


    # Skor/sinyal geçmişi: değişim raporu (skoru en çok yükselen/düşen, sinyale
    # yeni giren/çıkan) arayüzde son iki günü karşılaştırarak üretilir.
    score_history = fetch_previous_scores()
    scan_day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if score_today:
        score_history[scan_day] = score_today
    score_history = dict(sorted(score_history.items())[-SCORE_HISTORY_DAYS:])
    score_path = out_dir / "score_history.json"
    score_path.write_text(
        dump_json(
            {"generated_at": datetime.now(timezone.utc).isoformat(), "history": score_history},
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
        dump_json(
            {"generated_at": datetime.now(timezone.utc).isoformat(), "history": signal_log},
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
            "metrics": FUND_METRIC_KEYS,
        }
    except Exception as e:
        # Boş payload yazmak yayındaki listeyi siler; önce yayındakini kurtar.
        previous = fetch_previous_funds()
        previous_results = previous.get("results") or []
        if previous_results:
            fund_results = previous_results
            funds_payload = {
                **previous,
                # Bayatlık gizlenmez: arayüz tarihi zaten gösteriyor, bayrak da
                # açıkça duruyor. Sessizce eski veriyi bugünkü gibi sunmak
                # kullanıcıyı yanıltırdı.
                "stale": True,
                "error": str(e),
            }
            print(
                f"[FON] tarama başarısız ({e}); yayındaki "
                f"{len(previous_results)} fonluk liste korundu "
                f"({previous.get('generated_at', '?')[:10]} tarihli)"
            )
        else:
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
            print(f"[FON] tarama başarısız ({e}) ve kurtarılacak liste yok; boş payload")
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

    # Fiyat serileri FON BAŞINA ayrı dosyada. Kapak kalkınca liste 120'den ~690
    # fona çıktı; hepsini tek dosyaya koymak onu ~800 KB'tan ~4,7 MB'a şişirirdi
    # ve kullanıcı tek bir fonun grafiğini açmak için tamamını indirirdi. Hisse
    # serilerinde aynı sorun aynı şekilde çözülmüştü (bkz. app/data/price_files.py).
    # Tarama başarısız olup liste yayındakinden kurtarıldıysa serileri de oradan
    # kurtar: liste dolu ama grafikler boşsa fon sayfaları yarım görünürdü.
    if not fund_series and funds_payload.get("stale"):
        recovered = fetch_previous_fund_prices()
        fund_series = recovered.get("series") or {}
        if not benchmarks:
            benchmarks = recovered.get("benchmarks") or {}
        if fund_series:
            print(f"[FON] yayındaki {len(fund_series)} fiyat serisi korundu")

    # Ertesi gün tahmini benchmark'lara BAĞLI, o yüzden funds.json bu noktada
    # yazılıyor: tahminler eklenmeden yazılsaydı dosya tahminsiz kalırdı.
    made, _ = attach_fund_forecasts(fund_results, fund_series, benchmarks)
    funds_payload["forecast_count"] = made

    funds_path = out_dir / "funds.json"
    funds_path.write_text(dump_json(funds_payload), encoding="utf-8")
    print(f"[FON] {funds_payload['count']} fon -> {funds_path}")

    # Kategori SEO sayfaları: "gümüş fonu", "en iyi hisse fonu" gibi aramaların
    # ineceği hedef sayfa yoktu (uygulama SPA; ?v=funds indekslenebilir içerik
    # üretmiyor). Hisse sayfalarıyla aynı gerekçe, aynı desen.
    write_fund_category_pages(out_dir.parent, fund_results, funds_payload["generated_at"])

    fund_price_dir = out_dir / "fund-prices"
    fund_price_dir.mkdir(parents=True, exist_ok=True)
    assert_unique_file_names(fund_series.keys())
    for code, points in fund_series.items():
        (fund_price_dir / f"{price_file_name(code)}.json").write_text(
            dump_json({"symbol": code, "points": points}), encoding="utf-8"
        )
    (fund_price_dir / "index.json").write_text(
        dump_json({"generated_at": funds_payload["generated_at"], "symbols": sorted(fund_series)}),
        encoding="utf-8",
    )

    # fund_prices.json benchmark'ları ve EN ÇOK AÇILAN fonların serilerini taşımayı
    # sürdürür: yeni arayüz eksik seriyi tek tek ister, güncellemeyi henüz almamış
    # bir istemcide de en çok bakılan fonların grafiği çalışmaya devam eder.
    top_codes = [r["symbol"] for r in fund_results[:FUND_PRICES_INLINE]]
    prices_payload = {
        "generated_at": funds_payload["generated_at"],
        "series": {c: fund_series[c] for c in top_codes if c in fund_series},
        "benchmarks": benchmarks,
    }
    prices_path = out_dir / "fund_prices.json"
    prices_path.write_text(dump_json(prices_payload), encoding="utf-8")
    print(
        f"[FON] {len(fund_series)} fiyat serisi -> {fund_price_dir} "
        f"({len(prices_payload['series'])} tanesi + {len(benchmarks)} benchmark {prices_path.name} içinde)"
    )

    # Fon akışı arşivi: gün başına yatırımcı sayısı, fon büyüklüğü ve fiyat birikir.
    # Yatırımcı sayısı "kaç kişi katıldı"yı, büyüklük+fiyat ise "net kaç TL girdi"yi
    # verir (bkz. app/funds/flows.py) — biri diğerinin yerine geçmez: tek kurumsal
    # giriş yatırımcı sayısını hiç değiştirmeden fonun boyutunu ikiye katlayabilir.
    #
    # Kayıt biçimi düz sayıdan sözlüğe geçti; okuma tarafı eski kayıtları da kabul
    # eder (o günler için akış hesaplanamaz, yatırımcı sayısı yine okunur).
    flows_history = fetch_previous_flows()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    readings = {
        r["symbol"]: {
            "investors": r.get("investor_count"),
            "size": r.get("portfolio_size"),
            "price": r.get("price"),
        }
        for r in fund_results
        if r.get("investor_count") is not None or r.get("portfolio_size") is not None
    }
    if readings:
        flows_history[today] = readings
    flows_history = dict(sorted(flows_history.items())[-FLOW_HISTORY_DAYS:])
    flows_path = out_dir / "fund_flows.json"
    flows_path.write_text(
        dump_json(
            {"generated_at": funds_payload["generated_at"], "history": flows_history},
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
