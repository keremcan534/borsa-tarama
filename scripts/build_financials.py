"""Çeyreklik finansal özet haritasını üretir (`app/data/financials.json`).

Bilanço çeyrekte bir değişir, tarama ise günde iki kez çalışır. Sembol başına ayrı
bir istek gerektiren bu veriyi her taramada çekmek 610 sembolde ~5 dakika boşa
harcamak olurdu. Sektör haritasıyla aynı desen: burada üretilir, repoya commit'lenir,
tarama yalnızca okur.

Çeyrek sonlarından birkaç hafta sonra (Mart/Haziran/Eylül/Aralık bilançoları
yayımlandıkça) yeniden çalıştırılmalı:

    python scripts/build_financials.py

Mevcut harita korunur: veri çekilemeyen sembol eski kaydını KAYBETMEZ. Yahoo bir
sembolde geçici olarak boş dönerse, çalışan bir çeyreklik seri sessizce silinmiş
olurdu — bilgiyi silmektense bayat göstermek yeğdir (dosya `generated_at` taşır).
"""

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from datetime import datetime, timezone  # noqa: E402

from app.data.financials import FINANCIALS_PATH, fetch_financials  # noqa: E402
from app.data.markets import MARKET_FILES, SYMBOLS_DIR, enabled_markets  # noqa: E402
from app.data.yahoo_http import YahooHttpClient  # noqa: E402

REQUEST_DELAY_SECONDS = 0.2


def target_symbols() -> list[str]:
    """Etkin marketlerdeki hisseler. Emtia/kripto elenir: bilançoları yok."""
    symbols: list[str] = []
    for market in enabled_markets():
        if market == "commodity":
            continue
        path = SYMBOLS_DIR / MARKET_FILES[market]
        if not path.exists():
            continue
        for symbol in json.loads(path.read_text(encoding="utf-8")):
            if symbol not in symbols:
                symbols.append(symbol)
    return symbols


def main() -> int:
    existing: dict = {}
    if FINANCIALS_PATH.exists():
        try:
            existing = (json.loads(FINANCIALS_PATH.read_text(encoding="utf-8")) or {}).get("symbols") or {}
        except json.JSONDecodeError:
            existing = {}

    symbols = target_symbols()
    print(f"[FİNANSAL] {len(symbols)} sembol taranacak ({len(existing)} kayıt mevcut)")

    client = YahooHttpClient()
    if not client.crumb():
        print("[FİNANSAL] Yahoo oturumu (crumb) alınamadı; harita güncellenmedi")
        return 1

    updated, kept = 0, 0
    for index, symbol in enumerate(symbols, start=1):
        summary = fetch_financials(symbol, client)
        if summary:
            existing[symbol] = summary
            updated += 1
        elif symbol in existing:
            kept += 1  # eski kayıt korunur, bkz. modül başlığı
        if index % 100 == 0:
            print(f"[FİNANSAL] {index}/{len(symbols)} ({updated} güncellendi)")
        time.sleep(REQUEST_DELAY_SECONDS)

    if not updated:
        print("[FİNANSAL] hiçbir sembol için veri gelmedi; dosya yazılmadı")
        return 1

    FINANCIALS_PATH.write_text(
        json.dumps(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "symbols": dict(sorted(existing.items())),
            },
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"[FİNANSAL] {updated} sembol güncellendi, {kept} eski kayıt korundu -> {FINANCIALS_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
