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

from app.core.scheduler import MARKET_FILES, SYMBOLS_DIR
from app.data.fetchers.yfinance_fetcher import YFinanceFetcher
from app.screener.engine import run_screener


def main() -> None:
    out_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
    out_dir.mkdir(parents=True, exist_ok=True)

    fetcher = YFinanceFetcher()
    for market, filename in MARKET_FILES.items():
        with open(SYMBOLS_DIR / filename, encoding="utf-8") as f:
            symbols = json.load(f)

        results = run_screener(symbols, fetcher)
        payload = {
            "market": market.upper(),
            "count": len(results),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "results": results,
        }
        out_path = out_dir / f"{market}.json"
        out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        print(f"[SCAN] {market}: {len(results)} sonuç -> {out_path}")


if __name__ == "__main__":
    main()
