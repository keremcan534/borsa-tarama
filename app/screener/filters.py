import pandas as pd

DEFAULT_EMA_PERIODS = [9, 21, 50, 200]

# Bir mumun kapsadığı ortalama işlem günü sayısı (ciroyu günlüğe çevirmek için)
BARS_PER_DAY = {"1d": 1, "1wk": 5, "1mo": 21}


def passes_liquidity_filter(df: pd.DataFrame, interval: str, min_daily_turnover: float) -> bool:
    """
    Son 20 mumun ortalama GÜNLÜK cirosu (hacim x kapanış) eşiğin üzerinde mi?
    Haftalık/aylık mumlarda ciro, mumun kapsadığı gün sayısına bölünerek
    günlük yaklaşık değere çevrilir.
    """
    try:
        turnover_per_bar = (df["volume"] * df["close"]).tail(20).mean()
        daily_turnover = turnover_per_bar / BARS_PER_DAY.get(interval, 1)
        return bool(daily_turnover >= min_daily_turnover)
    except (KeyError, TypeError):
        return False


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
