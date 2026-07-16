from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.core.scheduler import get_cached_results
from app.data.fetchers.yfinance_fetcher import YFinanceFetcher
from app.data.markets import MARKET_FILES, load_symbols
from app.models.schemas import ScreenerResponse
from app.screener.engine import run_screener
from app.screener.timeframes import TIMEFRAMES

router = APIRouter(prefix="/api/screener", tags=["screener"])
fetcher = YFinanceFetcher()


def _load_symbols(market: str) -> list[str]:
    if market not in MARKET_FILES:
        valid = ", ".join(f"'{m}'" for m in MARKET_FILES)
        raise HTTPException(status_code=400, detail=f"Geçersiz market. Şunlardan biri olmalı: {valid}.")
    return load_symbols(market)


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
