import pandas as pd
import pytest

from app.data.benchmarks import BENCHMARKS, benchmark_summary, fetch_benchmark
from app.data.fetchers.base import BaseFetcher


def _df(closes) -> pd.DataFrame:
    return pd.DataFrame(
        {"open": closes, "high": closes, "low": closes, "close": closes, "volume": [1] * len(closes)},
        index=pd.date_range("2024-01-01", periods=len(closes), freq="D"),
    )


class FakeFetcher(BaseFetcher):
    def __init__(self, df=None, raises=False):
        self._df = df
        self._raises = raises
        self.calls: list[str] = []

    def fetch_ohlcv(self, symbol, period="1y", interval="1d"):
        if self._raises:
            raise ValueError("veri yok")
        self.calls.append(symbol)
        return self._df

    def fetch_market_cap(self, symbol):
        return None


def test_summary_reports_last_close_and_change():
    summary = benchmark_summary(_df([100.0, 110.0]), "bist100")
    assert summary == {"symbol": "XU100.IS", "name": "BIST 100", "close": 110.0, "change": 0.1}


def test_summary_names_the_index_not_the_market():
    # sp500 kapalıyken S&P nabzı ETF marketinin endeksinden gelir; kart yine
    # "S&P 500" demeli, "ETF" değil.
    assert benchmark_summary(_df([100.0, 110.0]), "etf")["name"] == "S&P 500"


def test_summary_is_none_for_market_without_index():
    assert benchmark_summary(_df([100.0, 110.0]), "commodity") is None


def test_summary_is_none_without_enough_bars():
    assert benchmark_summary(_df([100.0]), "bist100") is None
    assert benchmark_summary(None, "bist100") is None


def test_summary_is_none_when_previous_close_is_invalid():
    assert benchmark_summary(_df([0.0, 110.0]), "bist100") is None


@pytest.mark.parametrize("market,symbol", [("bist100", "XU100.IS"), ("sp500", "^GSPC")])
def test_fetch_benchmark_uses_the_market_index(market, symbol):
    fetcher = FakeFetcher(_df([1.0, 2.0]))
    assert fetch_benchmark(market, fetcher, "1y", "1d") is not None
    assert fetcher.calls == [symbol]


def test_fetch_benchmark_skips_market_without_index():
    fetcher = FakeFetcher(_df([1.0, 2.0]))
    assert fetch_benchmark("commodity", fetcher, "1y", "1d") is None
    assert fetcher.calls == []  # endeksi olmayan market için istek atılmaz


def test_fetch_benchmark_survives_fetch_failure():
    # Endeks çekilemezse tarama durmamalı; yalnızca karşılaştırma alanları boş kalır
    assert fetch_benchmark("bist100", FakeFetcher(raises=True), "1y", "1d") is None


def test_sp500_and_etf_share_the_same_index():
    # "Bugün" sayfası endeks kartlarını sembole göre tekilleştirdiğinden bu önemli
    assert BENCHMARKS["etf"] == BENCHMARKS["sp500"]
