from apscheduler.schedulers.background import BackgroundScheduler

from app.core.config import settings
from app.data.fetchers.yfinance_fetcher import YFinanceFetcher

# Geriye dönük uyumluluk: bu isimler eskiden burada tanımlıydı, artık tek kaynak
# app/data/markets.py. Buradan da dışa aktarılıyorlar ki mevcut importlar kırılmasın.
from app.data.markets import MARKET_FILES, SYMBOLS_DIR, enabled_markets, load_symbols  # noqa: F401
from app.screener.engine import run_screener
from app.screener.timeframes import TIMEFRAMES

scheduler = BackgroundScheduler(timezone="Europe/Istanbul")

# Basit in-memory cache, anahtar: "market:timeframe".
# Kalıcı olması gerekirse Redis/SQLite'a taşınabilir.
_cache: dict[str, list[dict]] = {}


def _run_scan(market: str) -> None:
    fetcher = YFinanceFetcher()
    symbols = load_symbols(market)
    min_turnover = settings.min_daily_turnover.get(market)
    for timeframe in TIMEFRAMES:
        _cache[f"{market}:{timeframe}"] = run_screener(symbols, fetcher, timeframe, min_turnover)
        print(
            f"[SCHEDULER] {market}/{timeframe} taraması tamamlandı: "
            f"{len(_cache[f'{market}:{timeframe}'])} sonuç"
        )


def start_scheduler() -> None:
    # BIST kapanışı ~18:10 TR saati, ABD piyasaları ~23:00-00:00 TR saati.
    # Kapalı marketler (settings.enabled_markets) zamanlanmaz.
    schedule = {
        "bist100": {"hour": 18, "minute": 30},
        "sp500": {"hour": 23, "minute": 30},
        "etf": {"hour": 23, "minute": 40},
        "commodity": {"hour": 23, "minute": 50},
    }
    for market in enabled_markets():
        when = schedule.get(market)
        if not when:
            continue
        scheduler.add_job(
            lambda m=market: _run_scan(m), "cron", id=f"{market}_scan", **when
        )
    scheduler.start()


def get_cached_results(market: str, timeframe: str = "daily") -> list[dict]:
    return _cache.get(f"{market}:{timeframe}", [])
