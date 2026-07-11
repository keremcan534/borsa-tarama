import pandas as pd

from .rsi import calculate_rsi


def calculate_stochastic(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    k_period: int = 14,
    smooth_k: int = 3,
    d_period: int = 3,
) -> dict[str, pd.Series]:
    """Klasik (slow) Stokastik: %K ve %D döner."""
    lowest_low = low.rolling(window=k_period).min()
    highest_high = high.rolling(window=k_period).max()

    raw_k = 100 * (close - lowest_low) / (highest_high - lowest_low)
    k = raw_k.rolling(window=smooth_k).mean().clip(0, 100)  # smoothed %K
    d = k.rolling(window=d_period).mean().clip(0, 100)      # %D

    return {"k": k, "d": d}


def calculate_stochastic_rsi(
    close: pd.Series,
    rsi_period: int = 14,
    stoch_period: int = 14,
    k_period: int = 3,
    d_period: int = 3,
) -> dict[str, pd.Series]:
    """Stokastik formülünü fiyat yerine RSI üzerine uygular."""
    rsi = calculate_rsi(close, rsi_period)
    lowest_rsi = rsi.rolling(window=stoch_period).min()
    highest_rsi = rsi.rolling(window=stoch_period).max()

    raw_stoch_rsi = 100 * (rsi - lowest_rsi) / (highest_rsi - lowest_rsi)
    k = raw_stoch_rsi.rolling(window=k_period).mean().clip(0, 100)
    d = k.rolling(window=d_period).mean().clip(0, 100)

    return {"stoch_rsi_k": k, "stoch_rsi_d": d}
