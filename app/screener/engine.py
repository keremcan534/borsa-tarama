import pandas as pd

from app.data.fetchers.base import BaseFetcher
from app.indicators.ema import calculate_multi_ema
from app.indicators.macd import calculate_macd
from app.indicators.rsi import calculate_rsi
from app.indicators.stochastic import calculate_stochastic, calculate_stochastic_rsi
from app.screener.filters import DEFAULT_EMA_PERIODS, passes_filters
from app.screener.timeframes import TIMEFRAMES


def compute_indicators(df: pd.DataFrame, ema_periods: list[int] = DEFAULT_EMA_PERIODS) -> pd.DataFrame:
    """Bir hissenin OHLCV DataFrame'ine tüm göstergeleri kolon olarak ekler."""
    close, high, low = df["close"], df["high"], df["low"]

    for name, series in calculate_multi_ema(close, ema_periods).items():
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


def screen_symbol(symbol: str, fetcher: BaseFetcher, timeframe: str = "daily") -> dict | None:
    """Tek bir sembolü verilen zaman diliminde çeker, gösterge hesaplar, filtreden geçirir."""
    config = TIMEFRAMES[timeframe]
    df = fetcher.fetch_ohlcv(symbol, period=config["period"], interval=config["interval"])

    if len(df) < config["min_bars"]:
        return None  # bu zaman diliminde yeterli geçmiş veri yok

    ema_periods = config["ema_periods"]
    df = compute_indicators(df, ema_periods)
    last_row = df.iloc[-1]

    if not passes_filters(last_row, ema_periods):
        return None

    market_cap = fetcher.fetch_market_cap(symbol)

    result = {
        "symbol": symbol,
        "close": round(float(last_row["close"]), 2),
        "market_cap": market_cap,
    }
    for p in ema_periods:
        result[f"ema_{p}"] = round(float(last_row[f"ema_{p}"]), 2)
    result.update(
        {
            "macd_line": round(float(last_row["macd_line"]), 3),
            "rsi": round(float(last_row["rsi"]), 2),
            "stoch_k": round(float(last_row["stoch_k"]), 2),
            "stoch_rsi_k": round(float(last_row["stoch_rsi_k"]), 2),
        }
    )
    return result


def run_screener(symbols: list[str], fetcher: BaseFetcher, timeframe: str = "daily") -> list[dict]:
    """Sembol listesini tarar, filtreden geçenleri piyasa değerine göre büyükten küçüğe sıralar."""
    results = []
    for symbol in symbols:
        try:
            result = screen_symbol(symbol, fetcher, timeframe)
            if result:
                results.append(result)
        except Exception as e:
            # Üretimde: logging.warning(f"{symbol} atlandı: {e}")
            print(f"[UYARI] {symbol} atlandı: {e}")
            continue

    results.sort(key=lambda x: x["market_cap"] or 0, reverse=True)
    return results
