import pandas as pd
import pytest

from app.data.fetchers.base import BaseFetcher
from app.data.fx import GRAMS_PER_OUNCE, fetch_fx_series


def _ohlcv(values: list[float]) -> pd.DataFrame:
    idx = pd.date_range("2026-01-01", periods=len(values), freq="D")
    return pd.DataFrame(
        {
            "open": values,
            "high": values,
            "low": values,
            "close": values,
            "volume": [1_000] * len(values),
        },
        index=idx,
    )


class FxFetcher(BaseFetcher):
    """USDTRY ve altın için farklı seriler döndüren sahte fetcher."""

    def __init__(self, failing: set[str] | None = None):
        self.failing = failing or set()

    def fetch_ohlcv(self, symbol: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame:
        if symbol in self.failing:
            raise ValueError(f"{symbol} çekilemedi")
        return _ohlcv([40.0, 41.0] if symbol == "USDTRY=X" else [3000.0, 3100.0])

    def fetch_market_cap(self, symbol: str) -> float | None:
        return None


def test_fetch_fx_series_returns_both_series():
    fx = fetch_fx_series(FxFetcher())
    assert [p[1] for p in fx["usdtry"]] == [40.0, 41.0]
    assert [p[1] for p in fx["goldusd"]] == [3000.0, 3100.0]
    # Tarihler ISO formatında (arayüz bu formatla arama yapıyor)
    assert fx["usdtry"][0][0] == "2026-01-01"


def test_fetch_fx_series_leaves_failing_series_empty():
    # Bir seri çekilemezse diğeri yine dönmeli; arayüz boş seride o seçeneği gizler
    fx = fetch_fx_series(FxFetcher(failing={"GC=F"}))
    assert len(fx["usdtry"]) == 2
    assert fx["goldusd"] == []


def test_grams_per_ounce_constant():
    # Gram altın dönüşümü bu sabite dayanıyor; yanlış değer tüm getirileri kaydırır
    assert GRAMS_PER_OUNCE == pytest.approx(31.1034768)
