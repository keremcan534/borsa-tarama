import json
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler

from app.data.fetchers.yfinance_fetcher import YFinanceFetcher
from app.screener.engine import run_screener
from app.screener.timeframes import TIMEFRAMES

scheduler = BackgroundScheduler(timezone="Europe/Istanbul")

# Basit in-memory cache, anahtar: "market:timeframe".
# Kalıcı olması gerekirse Redis/SQLite'a taşınabilir.
_cache: dict[str, list[dict]] = {}

SYMBOLS_DIR = Path(__file__).resolve().parents[1] / "data" / "symbols"
MARKET_FILES = {"bist100": "bist100.json", "sp500": "sp500.json"}


def _run_scan(market: str) -> None:
    fetcher = YFinanceFetcher()
    with open(SYMBOLS_DIR / MARKET_FILES[market], encoding="utf-8") as f:
        symbols = json.load(f)
    for timeframe in TIMEFRAMES:
        _cache[f"{market}:{timeframe}"] = run_screener(symbols, fetcher, timeframe)
        print(
            f"[SCHEDULER] {market}/{timeframe} taraması tamamlandı: "
            f"{len(_cache[f'{market}:{timeframe}'])} sonuç"
        )


def start_scheduler() -> None:
    # BIST kapanışı ~18:10 TR saati, ABD (S&P 500) kapanışı ~23:00-00:00 TR saati
    scheduler.add_job(lambda: _run_scan("bist100"), "cron", hour=18, minute=30, id="bist100_scan")
    scheduler.add_job(lambda: _run_scan("sp500"), "cron", hour=23, minute=30, id="sp500_scan")
    scheduler.start()


def get_cached_results(market: str, timeframe: str = "daily") -> list[dict]:
    return _cache.get(f"{market}:{timeframe}", [])
