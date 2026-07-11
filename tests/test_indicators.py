import numpy as np
import pandas as pd

from app.indicators.ema import calculate_ema
from app.indicators.macd import calculate_macd
from app.indicators.rsi import calculate_rsi
from app.indicators.stochastic import calculate_stochastic, calculate_stochastic_rsi


def _sample_close(n: int = 300) -> pd.Series:
    np.random.seed(42)
    return pd.Series(100 + np.cumsum(np.random.randn(n) * 0.5 + 0.05))


def test_ema_length_matches_input():
    close = _sample_close()
    ema = calculate_ema(close, 21)
    assert len(ema) == len(close)


def test_rsi_bounded_between_0_and_100():
    close = _sample_close()
    rsi = calculate_rsi(close).dropna()
    assert rsi.between(0, 100).all()


def test_macd_has_three_components():
    close = _sample_close()
    macd = calculate_macd(close)
    assert set(macd.keys()) == {"macd_line", "signal_line", "histogram"}


def test_stochastic_bounded_between_0_and_100():
    close = _sample_close()
    high = close + 0.5
    low = close - 0.5
    stoch = calculate_stochastic(high, low, close)
    k = stoch["k"].dropna()
    assert k.between(0, 100).all()


def test_stochastic_rsi_bounded_between_0_and_100():
    close = _sample_close()
    stoch_rsi = calculate_stochastic_rsi(close)
    k = stoch_rsi["stoch_rsi_k"].dropna()
    assert k.between(0, 100).all()
