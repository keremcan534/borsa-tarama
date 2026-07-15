"""Mevcut tarama JSON'larından sinyal sembollerini okuyup haber dosyalarını üretir.

Tam taramayı tekrar çalıştırmadan haberleri yenilemek için kullanılır:

    python scripts/news_to_json.py frontend/public/data
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.scheduler import MARKET_FILES
from app.news.collect import build_news_payload


def main() -> None:
    data_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "frontend/public/data")

    for market in MARKET_FILES:
        signal_symbols: list[str] = []
        for suffix in ("", "_weekly", "_monthly"):
            path = data_dir / f"{market}{suffix}.json"
            if not path.exists():
                continue
            payload = json.loads(path.read_text(encoding="utf-8"))
            for stock in payload.get("results", []):
                if stock["symbol"] not in signal_symbols:
                    signal_symbols.append(stock["symbol"])

        if not signal_symbols:
            print(f"[HABER] {market}: sinyal sembolü yok, atlandı")
            continue

        news_payload = build_news_payload(market, signal_symbols)
        news_path = data_dir / f"news_{market}.json"
        news_path.write_text(json.dumps(news_payload, ensure_ascii=False), encoding="utf-8")
        print(f"[HABER] {market}: {len(news_payload['items'])} başlık -> {news_path}")


if __name__ == "__main__":
    main()
