from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest

from app.data.fetchers.yfinance_fetcher import YFinanceFetcher


def _history_df_with_trailing_nan() -> pd.DataFrame:
    idx = pd.date_range("2024-01-01", periods=5, freq="D")
    return pd.DataFrame(
        {
            "Open": [10.0, 10.5, 11.0, 11.5, np.nan],
            "High": [10.5, 11.0, 11.5, 12.0, np.nan],
            "Low": [9.5, 10.0, 10.5, 11.0, np.nan],
            "Close": [10.2, 10.8, 11.2, 11.8, np.nan],
            "Volume": [1000, 1100, 1200, 1300, 1400],
        },
        index=idx,
    )


@patch("app.data.fetchers.yfinance_fetcher.yf.Ticker")
def test_fetch_ohlcv_drops_trailing_nan_row(mock_ticker_cls):
    mock_ticker = MagicMock()
    mock_ticker.history.return_value = _history_df_with_trailing_nan()
    mock_ticker_cls.return_value = mock_ticker

    fetcher = YFinanceFetcher()
    df = fetcher.fetch_ohlcv("FAKE.IS")

    assert len(df) == 4
    assert list(df.columns) == ["open", "high", "low", "close", "volume"]
    assert not df["close"].isna().any()


@patch("app.data.fetchers.yfinance_fetcher.yf.Ticker")
def test_fetch_ohlcv_raises_on_empty_data(mock_ticker_cls):
    mock_ticker = MagicMock()
    mock_ticker.history.return_value = pd.DataFrame()
    mock_ticker_cls.return_value = mock_ticker

    fetcher = YFinanceFetcher()
    with pytest.raises(ValueError):
        fetcher.fetch_ohlcv("FAKE.IS")


@patch("app.data.fetchers.yfinance_fetcher.yf.Ticker")
def test_fetch_market_cap_uses_fast_info(mock_ticker_cls):
    mock_ticker = MagicMock()
    mock_ticker.fast_info = {"market_cap": 123456.0}
    mock_ticker_cls.return_value = mock_ticker

    fetcher = YFinanceFetcher()
    assert fetcher.fetch_market_cap("FAKE.IS") == 123456.0


@patch("app.data.fetchers.yfinance_fetcher.yf.Ticker")
def test_fetch_market_cap_falls_back_to_info(mock_ticker_cls):
    mock_ticker = MagicMock()
    mock_ticker.fast_info = {}
    mock_ticker.info = {"marketCap": 999.0}
    mock_ticker_cls.return_value = mock_ticker

    fetcher = YFinanceFetcher()
    assert fetcher.fetch_market_cap("FAKE.IS") == 999.0
