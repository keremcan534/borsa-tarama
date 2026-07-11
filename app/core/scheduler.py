import json
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler

from app.data.fetchers.yfinance_fetcher import YFinanceFetcher
from app.screener.engine import run_screener

scheduler = BackgroundScheduler(timezone="Europe/Istanbul")

# Basit in-memory cache. Kalıcı olması gerekirse Redis/SQLite'a taşınabilir.
_cache: dict[str, list[dict]] = {"bist100": [], "sp500": []}

SYMBOLS_DIR = Path(__file__).resolve().parents[1] / "data" / "symbols"
MARKET_FILES = {"bist100": "bist100.json", "sp500": "sp500.json"}


def _run_scan(market: str) -> None:
    fetcher = YFinanceFetcher()
    with open(SYMBOLS_DIR / MARKET_FILES[market], encoding="utf-8") as f:
        symbols = json.load(f)
    _cache[market] = run_screener(symbols, fetcher)
    print(f"[SCHEDULER] {market} taraması tamamlandı: {len(_cache[market])} sonuç")


def start_scheduler() -> None:
    # BIST kapanışı ~18:10 TR saati, ABD (S&P 500) kapanışı ~23:00-00:00 TR saati
    scheduler.add_job(lambda: _run_scan("bist100"), "cron", hour=18, minute=30, id="bist100_scan")
    scheduler.add_job(lambda: _run_scan("sp500"), "cron", hour=23, minute=30, id="sp500_scan")
    scheduler.start()


def get_cached_results(market: str) -> list[dict]:
    return _cache.get(market, [])
