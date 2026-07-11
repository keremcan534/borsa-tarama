import pandas as pd

from app.data.fetchers.base import BaseFetcher
from app.indicators.ema import calculate_multi_ema
from app.indicators.macd import calculate_macd
from app.indicators.rsi import calculate_rsi
from app.indicators.stochastic import calculate_stochastic, calculate_stochastic_rsi
from app.screener.filters import passes_filters


def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Bir hissenin OHLCV DataFrame'ine tüm göstergeleri kolon olarak ekler."""
    close, high, low = df["close"], df["high"], df["low"]

    for name, series in calculate_multi_ema(close, [9, 21, 50, 200]).items():
        df[name] = series

    macd = calculate_macd(close)
    df["macd_line"] = macd["macd_line"]
    df["macd_signal"] = macd["signal_line"]
    df["macd_hist"] = macd["histogram"]

    df["rsi"] = calculate_rsi(close)

    stoch = calculate_stochastic(high, low, close)
    df["stoch_k"] = stoch["k"]
    df["stoch_d"] = stoch["d"]

    stoch_rsi = calculate_stochastic_rsi(close)
    df["stoch_rsi_k"] = stoch_rsi["stoch_rsi_k"]
    df["stoch_rsi_d"] = stoch_rsi["stoch_rsi_d"]

    return df


def screen_symbol(symbol: str, fetcher: BaseFetcher) -> dict | None:
    """Tek bir sembolü çeker, gösterge hesaplar, filtreden geçirir."""
    df = fetcher.fetch_ohlcv(symbol, period="1y", interval="1d")

    if len(df) < 200:
        return None  # 200 günlük EMA için yeterli geçmiş veri yok

    df = compute_indicators(df)
    last_row = df.iloc[-1]

    if not passes_filters(last_row):
        return None

    market_cap = fetcher.fetch_market_cap(symbol)

    return {
        "symbol": symbol,
        "close": round(float(last_row["close"]), 2),
        "market_cap": market_cap,
        "ema_9": round(float(last_row["ema_9"]), 2),
        "ema_21": round(float(last_row["ema_21"]), 2),
        "ema_50": round(float(last_row["ema_50"]), 2),
        "ema_200": round(float(last_row["ema_200"]), 2),
        "macd_line": round(float(last_row["macd_line"]), 3),
        "rsi": round(float(last_row["rsi"]), 2),
        "stoch_k": round(float(last_row["stoch_k"]), 2),
        "stoch_rsi_k": round(float(last_row["stoch_rsi_k"]), 2),
    }


def run_screener(symbols: list[str], fetcher: BaseFetcher) -> list[dict]:
    """Sembol listesini tarar, filtreden geçenleri piyasa değerine göre büyükten küçüğe sıralar."""
    results = []
    for symbol in symbols:
        try:
            result = screen_symbol(symbol, fetcher)
            if result:
                results.append(result)
        except Exception as e:
            # Üretimde: logging.warning(f"{symbol} atlandı: {e}")
            print(f"[UYARI] {symbol} atlandı: {e}")
            continue

    results.sort(key=lambda x: x["market_cap"] or 0, reverse=True)
    return results
