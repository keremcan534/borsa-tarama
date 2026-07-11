import pandas as pd


def calculate_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    """
    Wilder'ın yöntemiyle RSI hesaplar (ewm alpha=1/period).
    TradingView ve çoğu platformla aynı sonucu verir.
    """
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()

    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    rsi = rsi.where(avg_loss != 0, 100)  # avg_loss 0 ise RSI 100 kabul edilir
    return rsi
