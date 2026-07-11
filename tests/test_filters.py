import pandas as pd

from app.screener.filters import passes_filters


def _row(close=110.0, ema_9=100.0, ema_21=95.0, ema_50=90.0, ema_200=80.0, macd_line=1.0, rsi=55.0, stoch_k=50.0, stoch_rsi_k=50.0) -> pd.Series:
    return pd.Series(
        {
            "close": close,
            "ema_9": ema_9,
            "ema_21": ema_21,
            "ema_50": ema_50,
            "ema_200": ema_200,
            "macd_line": macd_line,
            "rsi": rsi,
            "stoch_k": stoch_k,
            "stoch_rsi_k": stoch_rsi_k,
        }
    )


def test_passes_when_all_conditions_met():
    assert passes_filters(_row())


def test_fails_when_price_below_an_ema():
    assert not passes_filters(_row(close=85.0))  # ema_200=80 ok ama ema_9=100 altinda kalir


def test_fails_when_macd_not_positive():
    assert not passes_filters(_row(macd_line=-0.5))


def test_fails_when_rsi_overbought():
    assert not passes_filters(_row(rsi=75.0))


def test_fails_when_stochastic_overbought():
    assert not passes_filters(_row(stoch_k=85.0))


def test_fails_when_stochastic_rsi_overbought():
    assert not passes_filters(_row(stoch_rsi_k=85.0))


def test_fails_when_expected_column_missing():
    row = pd.Series({"close": 100.0})
    assert not passes_filters(row)
