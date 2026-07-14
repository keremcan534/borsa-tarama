import pandas as pd

DEFAULT_EMA_PERIODS = [9, 21, 50, 200]


def passes_filters(row: pd.Series, ema_periods: list[int] = DEFAULT_EMA_PERIODS) -> bool:
    """
    Tek bir hissenin SON MUM verisine göre filtre şartlarını kontrol eder.
    Beklenen kolonlar: close, ema_<p> (verilen her periyot için),
                       macd_line, rsi, stoch_k, stoch_rsi_k

    Şartlar:
      - Fiyat verilen tüm EMA'ların üzerinde
      - MACD Line > 0
      - RSI < 70
      - Stokastik %K < 80
      - Stokastik RSI %K < 80
    """
    try:
        price_above_emas = all(row["close"] > row[f"ema_{p}"] for p in ema_periods)
        macd_positive = row["macd_line"] > 0
        rsi_ok = row["rsi"] < 70
        stoch_ok = row["stoch_k"] < 80
        stoch_rsi_ok = row["stoch_rsi_k"] < 80

        return all([price_above_emas, macd_positive, rsi_ok, stoch_ok, stoch_rsi_ok])
    except (KeyError, TypeError):
        return False
