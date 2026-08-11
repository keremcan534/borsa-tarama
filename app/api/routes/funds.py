"""TEFAS fon tarama API'si."""

from datetime import datetime, timezone

from fastapi import APIRouter

from app.funds.screen import FUND_METRIC_KEYS, run_fund_screener

router = APIRouter(prefix="/api/funds", tags=["funds"])

# Basit process-memory cache (hisse cache'i gibi)
_cache: dict | None = None


@router.get("")
def get_funds(live: bool = False):
    """live=false: cache; live=true: TEFAS'tan yeniden tara (yavaş, ~3 dk)."""
    global _cache
    if not live and _cache is not None:
        return _cache

    results = run_fund_screener()
    payload = {
        "market": "FUNDS",
        "count": len(results),
        "scanned": len(results),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "results": results,
        "metrics": FUND_METRIC_KEYS,
    }
    _cache = payload
    return payload
