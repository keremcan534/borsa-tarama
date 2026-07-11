import pandas as pd


def passes_filters(row: pd.Series) -> bool:
    """
    Tek bir hissenin SON GÜN verisine göre filtre şartlarını kontrol eder.
    Beklenen kolonlar: close, ema_9, ema_21, ema_50, ema_200,
                       macd_line, rsi, stoch_k, stoch_rsi_k

    Şartlar:
      - Fiyat > EMA 9, 21, 50, 200 (hepsi birden)
      - MACD Line > 0
      - RSI < 70
      - Stokastik %K < 80
      - Stokastik RSI %K < 80
    """
    try:
        price_above_emas = (
            row["close"] > row["ema_9"]
            and row["close"] > row["ema_21"]
            and row["close"] > row["ema_50"]
            and row["close"] > row["ema_200"]
        )
        macd_positive = row["macd_line"] > 0
        rsi_ok = row["rsi"] < 70
        stoch_ok = row["stoch_k"] < 80
        stoch_rsi_ok = row["stoch_rsi_k"] < 80

        return all([price_above_emas, macd_positive, rsi_ok, stoch_ok, stoch_rsi_ok])
    except (KeyError, TypeError):
        return False
