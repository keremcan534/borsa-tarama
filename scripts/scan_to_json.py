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
from app.core.scheduler import MARKET_FILES, SYMBOLS_DIR
from app.data.fetchers.yfinance_fetcher import YFinanceFetcher
from app.news.collect import build_news_payload
from app.reports.generate import SITE_URL, build_report_html
from app.screener.diff import mark_new_signals
from app.screener.engine import run_analysis
from app.screener.filters import passes_filters
from app.screener.timeframes import TIMEFRAMES

# Arayüzdeki filtre panelinin varsayılan eşikleri (client-side filtreleme için)
DEFAULT_THRESHOLDS = {"rsi": 70, "stoch_k": 80, "stoch_rsi_k": 80, "macd_positive": True}


def fetch_previous_symbols(market: str, timeframe: str) -> set[str] | None:
    """Yayındaki mevcut JSON'dan bir önceki taramanın sinyal sembollerini çeker.

    Erişilemezse None döner (yeni sinyal tespiti o koşuda devre dışı kalır).
    """
    suffix = "" if timeframe == "daily" else f"_{timeframe}"
    url = f"{SITE_URL}data/{market}{suffix}.json"
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        payload = resp.json()
        return {s["symbol"] for s in payload.get("results", [])}
    except Exception as e:
        print(f"[DIFF] {market}/{timeframe} için önceki tarama alınamadı ({e}); yeni-sinyal etiketi atlanacak")
        return None


def main() -> None:
    out_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
    reports_dir = Path(sys.argv[2] if len(sys.argv) > 2 else "reports")
    out_dir.mkdir(parents=True, exist_ok=True)
    reports_dir.mkdir(parents=True, exist_ok=True)

    fetcher = YFinanceFetcher()
    all_market_payloads: dict[str, dict[str, dict]] = {}

    for market, filename in MARKET_FILES.items():
        with open(SYMBOLS_DIR / filename, encoding="utf-8") as f:
            symbols = json.load(f)

        min_turnover = settings.min_daily_turnover.get(market)
        signal_symbols: list[str] = []  # haberler için: günlük öncelikli sinyal birleşimi
        market_payloads: dict[str, dict] = {}

        for timeframe in TIMEFRAMES:
            ema_periods = TIMEFRAMES[timeframe]["ema_periods"]
            stocks = run_analysis(symbols, fetcher, timeframe, min_turnover)
            results = [s for s in stocks if passes_filters(s, ema_periods)]

            previous = fetch_previous_symbols(market, timeframe)
            new_count = mark_new_signals(results, previous)

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

    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    report_path = reports_dir / f"{date_str}.html"
    report_path.write_text(build_report_html(date_str, all_market_payloads), encoding="utf-8")
    print(f"[RAPOR] günlük rapor -> {report_path}")


if __name__ == "__main__":
    main()
