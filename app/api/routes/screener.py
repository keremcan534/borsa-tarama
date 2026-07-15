import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.core.scheduler import get_cached_results
from app.data.fetchers.yfinance_fetcher import YFinanceFetcher
from app.models.schemas import ScreenerResponse
from app.screener.engine import run_screener
from app.screener.timeframes import TIMEFRAMES

router = APIRouter(prefix="/api/screener", tags=["screener"])
fetcher = YFinanceFetcher()

SYMBOLS_DIR = Path(__file__).resolve().parents[2] / "data" / "symbols"
MARKET_FILES = {
    "bist100": "bist100.json",
    "sp500": "sp500.json",
    "etf": "etf.json",
    "commodity": "commodity.json",
}


def _load_symbols(market: str) -> list[str]:
    filename = MARKET_FILES.get(market)
    if not filename:
        raise HTTPException(status_code=400, detail="Geçersiz market. 'bist100', 'sp500' veya 'etf' kullanın.")
    with open(SYMBOLS_DIR / filename, encoding="utf-8") as f:
        return json.load(f)


@router.get("/{market}", response_model=ScreenerResponse)
def get_screened_stocks(market: str, live: bool = False, timeframe: str = "daily"):
    """
    live=false (varsayılan): scheduler'ın ürettiği cache'ten okur, hızlıdır.
    live=true: anlık tarama yapar, yavaştır ama güncel veri döner.
    timeframe: daily (varsayılan) | weekly | monthly
    """
    if timeframe not in TIMEFRAMES:
        raise HTTPException(
            status_code=400, detail="Geçersiz timeframe. 'daily', 'weekly' veya 'monthly' kullanın."
        )

    symbols = _load_symbols(market)

    if not live:
        cached = get_cached_results(market, timeframe)
        if cached:
            return ScreenerResponse(
                market=market.upper(),
                timeframe=timeframe,
                count=len(cached),
                scanned=len(symbols),
                results=cached,
            )

    results = run_screener(symbols, fetcher, timeframe, settings.min_daily_turnover.get(market))
    return ScreenerResponse(
        market=market.upper(),
        timeframe=timeframe,
        count=len(results),
        scanned=len(symbols),
        results=results,
    )
