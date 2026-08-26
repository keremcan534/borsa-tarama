"""Sembol -> sektör haritasını üretir (`app/data/sectors.json`).

Neden ayrı bir script ve statik dosya: sektör bilgisi Yahoo'nun `assetProfile`
modülünden geliyor, bu da sembol başına ayrı bir istek ve rate-limit'e açık. 600+
sembol için her taramada ~5 dakika ek maliyet ve kırılganlık demek. Oysa bir şirketin
sektörü neredeyse hiç değişmez — bir kez üretilip repoya commit'lenir, tarama onu
okur ve HİÇ ek istek atmaz.

Yeniden çalıştırmak gerekir: sembol listeleri değişince (endeks revizyonu, yeni
halka arz, `scripts/build_bist_symbols.py` yeniden koşunca).

    python scripts/build_sectors.py

## Neden yfinance değil düz HTTP

Eskiden `yfinance.Ticker(symbol).info` kullanılıyordu. yfinance isteklerini curl_cffi
ile atıyor (tarayıcı TLS taklidi) ve bu bazı ağların arkasında tamamen bloklanıyor;
o ortamlarda script hiçbir sembolü çekemeden bitiyordu. `app/data/yahoo_http.py`
aynı veriyi `requests` ile alır — hem burada hem CI'da çalışır.
"""

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.data.markets import MARKET_FILES, SYMBOLS_DIR  # noqa: E402
from app.data.sectors import SECTORS_PATH  # noqa: E402
from app.data.yahoo_http import YahooHttpClient  # noqa: E402

REQUEST_DELAY_SECONDS = 0.2  # Yahoo'yu yormamak için semboller arası bekleme


def fetch_sector(client: YahooHttpClient, symbol: str) -> str | None:
    data = client.quote_summary(symbol, ["assetProfile"])
    if not data:
        return None
    return (data.get("assetProfile") or {}).get("sector") or None


def main() -> int:
    # Mevcut harita korunur: yeni semboller eklenir, çekilemeyenler eskisini kaybetmez.
    existing: dict[str, str] = {}
    if SECTORS_PATH.exists():
        existing = json.loads(SECTORS_PATH.read_text(encoding="utf-8"))

    symbols: list[str] = []
    for file_name in MARKET_FILES.values():
        path = SYMBOLS_DIR / file_name
        if not path.exists():
            continue
        for symbol in json.loads(path.read_text(encoding="utf-8")):
            if symbol not in symbols:
                symbols.append(symbol)

    missing = [s for s in symbols if s not in existing]
    print(f"[SEKTÖR] {len(symbols)} sembol, {len(missing)} tanesi haritada yok")
    if not missing:
        print("[SEKTÖR] güncel, iş yok")
        return 0

    client = YahooHttpClient()
    if not client.crumb():
        print("[SEKTÖR] Yahoo oturumu (crumb) alınamadı; harita güncellenmedi")
        return 1

    found = 0
    for index, symbol in enumerate(missing, start=1):
        sector = fetch_sector(client, symbol)
        if sector:
            existing[symbol] = sector
            found += 1
        if index % 50 == 0:
            print(f"[SEKTÖR] {index}/{len(missing)} ({found} bulundu)")
        time.sleep(REQUEST_DELAY_SECONDS)

    SECTORS_PATH.write_text(
        json.dumps(dict(sorted(existing.items())), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"[SEKTÖR] {found}/{len(missing)} yeni sembolün sektörü bulundu -> {SECTORS_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
