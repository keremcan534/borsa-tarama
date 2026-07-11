import pandas as pd

from .ema import calculate_ema


def calculate_macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> dict[str, pd.Series]:
    """
    MACD Line   = EMA(fast) - EMA(slow)
    Signal Line = EMA(MACD Line, signal)
    Histogram   = MACD Line - Signal Line
    """
    ema_fast = calculate_ema(close, fast)
    ema_slow = calculate_ema(close, slow)
    macd_line = ema_fast - ema_slow
    signal_line = calculate_ema(macd_line, signal)
    histogram = macd_line - signal_line

    return {
        "macd_line": macd_line,
        "signal_line": signal_line,
        "histogram": histogram,
    }
