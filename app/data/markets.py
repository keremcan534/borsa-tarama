"""Market tanımları — tek kaynak.

Daha önce `MARKET_FILES` hem `app/core/scheduler.py` hem `app/api/routes/screener.py`
içinde ayrı ayrı tanımlıydı ve elle senkron tutulması gerekiyordu. Artık ikisi de
buradan okur.

Bir market eklemek: `app/data/symbols/` altına sembol json'u + buraya bir satır
(+ likidite eşiği isteniyorsa `config.min_daily_turnover`, + karşılaştırma endeksi
isteniyorsa `app/data/benchmarks.py`).
"""

import json
from pathlib import Path

from app.core.config import settings

SYMBOLS_DIR = Path(__file__).resolve().parent / "symbols"

# Tanımlı tüm marketler. Hangilerinin taranacağı `settings.enabled_markets` ile
# belirlenir — burada durmaları kodun/sembol listesinin korunduğu anlamına gelir.
MARKET_FILES = {
    # "bist": borsanın tamamı (610 hisse). "bist100" endeks listesi olarak DURUYOR:
    # silinmedi çünkü endeks üyeliği hâlâ bir bilgi (bkz. app/data/indices.py) ve
    # yalnızca endeksi taramak istenirse tek satırla geri dönülebilir.
    "bist": "bist_all.json",
    "bist100": "bist100.json",
    "sp500": "sp500.json",
    "etf": "etf.json",
    "commodity": "commodity.json",
}


def enabled_markets() -> list[str]:
    """Taranacak marketler (tanım sırasını korur, bilinmeyen anahtarları atar)."""
    enabled = set(settings.enabled_markets)
    return [market for market in MARKET_FILES if market in enabled]


def is_enabled(market: str) -> bool:
    return market in enabled_markets()


def load_symbols(market: str) -> list[str]:
    """Marketin sembol listesini okur; market tanımlı değilse KeyError."""
    with open(SYMBOLS_DIR / MARKET_FILES[market], encoding="utf-8") as f:
        return json.load(f)
