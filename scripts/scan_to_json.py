"""Her iki marketi tarar ve sonuçları statik JSON dosyalarına yazar.

GitHub Actions'ta zamanlanmış olarak çalışır; çıktılar frontend build'ine
gömülüp GitHub Pages'te yayınlanır. Kullanım (repo kökünden):

    python scripts/scan_to_json.py frontend/public/data
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.core.scheduler import MARKET_FILES, SYMBOLS_DIR
from app.data.fetchers.yfinance_fetcher import YFinanceFetcher
from app.news.collect import build_news_payload
from app.screener.engine import run_analysis
from app.screener.filters import passes_filters
from app.screener.timeframes import TIMEFRAMES

# Arayüzdeki filtre panelinin varsayılan eşikleri (client-side filtreleme için)
DEFAULT_THRESHOLDS = {"rsi": 70, "stoch_k": 80, "stoch_rsi_k": 80, "macd_positive": True}


def main() -> None:
    out_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
    out_dir.mkdir(parents=True, exist_ok=True)

    fetcher = YFinanceFetcher()
    for market, filename in MARKET_FILES.items():
        with open(SYMBOLS_DIR / filename, encoding="utf-8") as f:
            symbols = json.load(f)

        min_turnover = settings.min_daily_turnover.get(market)
        signal_symbols: list[str] = []  # haberler için: günlük öncelikli sinyal birleşimi
        for timeframe in TIMEFRAMES:
            ema_periods = TIMEFRAMES[timeframe]["ema_periods"]
            stocks = run_analysis(symbols, fetcher, timeframe, min_turnover)
            results = [s for s in stocks if passes_filters(s, ema_periods)]
            for s in results:
                if s["symbol"] not in signal_symbols:
                    signal_symbols.append(s["symbol"])
            payload = {
                "market": market.upper(),
                "timeframe": timeframe,
                "count": len(results),
                "scanned": len(symbols),
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "results": results,
                # Arayüzde kullanıcı tanımlı eşiklerle yeniden filtreleme için
                # tüm hisselerin gösterge değerleri + varsayılan eşikler
                "stocks": stocks,
                "ema_periods": ema_periods,
                "thresholds": DEFAULT_THRESHOLDS,
            }
            # Günlük dosya adı geriye dönük uyumluluk için eksiz kalır.
            suffix = "" if timeframe == "daily" else f"_{timeframe}"
            out_path = out_dir / f"{market}{suffix}.json"
            out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
            print(f"[SCAN] {market}/{timeframe}: {len(results)} sonuç -> {out_path}")

        news_payload = build_news_payload(market, signal_symbols)
        news_path = out_dir / f"news_{market}.json"
        news_path.write_text(json.dumps(news_payload, ensure_ascii=False), encoding="utf-8")
        print(f"[HABER] {market}: {len(news_payload['items'])} başlık -> {news_path}")


if __name__ == "__main__":
    main()
