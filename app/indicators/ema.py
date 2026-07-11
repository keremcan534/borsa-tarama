import pandas as pd


def calculate_ema(series: pd.Series, period: int) -> pd.Series:
    """Verilen periyot için Üstel Hareketli Ortalama (EMA) hesaplar."""
    return series.ewm(span=period, adjust=False).mean()


def calculate_multi_ema(close: pd.Series, periods: list[int] = [9, 21, 50, 200]) -> dict[str, pd.Series]:
    """Birden fazla periyot için EMA'ları tek seferde hesaplar. Dönüş: {'ema_9': ..., 'ema_21': ...}"""
    return {f"ema_{p}": calculate_ema(close, p) for p in periods}
