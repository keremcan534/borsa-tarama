import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.core.scheduler import get_cached_results
from app.data.fetchers.yfinance_fetcher import YFinanceFetcher
from app.models.schemas import ScreenerResponse
from app.screener.engine import run_screener

router = APIRouter(prefix="/api/screener", tags=["screener"])
fetcher = YFinanceFetcher()

SYMBOLS_DIR = Path(__file__).resolve().parents[2] / "data" / "symbols"
MARKET_FILES = {"bist100": "bist100.json", "sp500": "sp500.json"}


def _load_symbols(market: str) -> list[str]:
    filename = MARKET_FILES.get(market)
    if not filename:
        raise HTTPException(status_code=400, detail="Geçersiz market. 'bist100' veya 'sp500' kullanın.")
    with open(SYMBOLS_DIR / filename, encoding="utf-8") as f:
        return json.load(f)


@router.get("/{market}", response_model=ScreenerResponse)
def get_screened_stocks(market: str, live: bool = False):
    """
    live=false (varsayılan): scheduler'ın günlük ürettiği cache'ten okur, hızlıdır.
    live=true: anlık tarama yapar, yavaştır ama güncel veri döner.
    """
    symbols = _load_symbols(market)

    if not live:
        cached = get_cached_results(market)
        if cached:
            return ScreenerResponse(
                market=market.upper(), count=len(cached), scanned=len(symbols), results=cached
            )

    results = run_screener(symbols, fetcher)
    return ScreenerResponse(
        market=market.upper(), count=len(results), scanned=len(symbols), results=results
    )
