"""Sembol -> sektör haritasını üretir (`app/data/sectors.json`).

Neden ayrı bir script ve statik dosya: sektör bilgisi yalnızca `yfinance`'in `.info`
çağrısından geliyor, bu da sembol başına ~0.5 sn sürüyor ve rate-limit'e açık. 600+
sembol için her taramada ~5 dakika ek maliyet ve kırılganlık demek. Oysa bir şirketin
sektörü neredeyse hiç değişmez — bir kez üretilip repoya commit'lenir, tarama onu
okur ve HİÇ ek istek atmaz.

Yeniden çalıştırmak gerekir: sembol listeleri endeks revizyonuyla değişince.

    python scripts/build_sectors.py
"""

import json
import sys
import time
from pathlib import Path

import yfinance as yf

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.scheduler import MARKET_FILES, SYMBOLS_DIR
from app.data.sectors import SECTORS_PATH


def fetch_sector(symbol: str) -> str | None:
    try:
        info = yf.Ticker(symbol).info or {}
    except Exception as e:
        print(f"[SEKTÖR] {symbol}: alınamadı ({e})")
        return None
    return info.get("sector") or None


def main() -> None:
    # Mevcut harita korunur: yeni semboller eklenir, çekilemeyenler eskisini kaybetmez.
    existing: dict[str, str] = {}
    if SECTORS_PATH.exists():
        existing = json.loads(SECTORS_PATH.read_text(encoding="utf-8"))

    symbols: list[str] = []
    for filename in MARKET_FILES.values():
        with open(SYMBOLS_DIR / filename, encoding="utf-8") as f:
            symbols.extend(json.load(f))

    found = 0
    for i, symbol in enumerate(symbols, 1):
        sector = fetch_sector(symbol)
        if sector:
            existing[symbol] = sector
            found += 1
        time.sleep(0.2)  # yfinance'i rate-limit'e sokmamak için nazik davran
        if i % 50 == 0:
            print(f"[SEKTÖR] {i}/{len(symbols)} işlendi")

    SECTORS_PATH.write_text(
        json.dumps(dict(sorted(existing.items())), ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    print(f"[SEKTÖR] {found}/{len(symbols)} sembolün sektörü bulundu -> {SECTORS_PATH}")


if __name__ == "__main__":
    main()
