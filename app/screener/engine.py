import pandas as pd

from app.data.fetchers.base import BaseFetcher
from app.indicators.ema import calculate_multi_ema
from app.indicators.macd import calculate_macd
from app.indicators.rsi import calculate_rsi
from app.indicators.stochastic import calculate_stochastic, calculate_stochastic_rsi
from app.screener.filters import DEFAULT_EMA_PERIODS, passes_filters, passes_liquidity_filter
from app.screener.relative_strength import relative_strength
from app.screener.timeframes import TIMEFRAMES


def drop_in_progress_bar(df: pd.DataFrame, interval: str, now: pd.Timestamp | None = None) -> pd.DataFrame:
    """
    Haftalık/aylık veride SON mum henüz kapanmadıysa (içinde bulunduğumuz
    hafta/ay) onu düşürür: göstergeler tamamlanmamış muma göre hesaplanırsa
    mum kapanana kadar sinyal değişebilir. Günlük veri olduğu gibi bırakılır
    (taramalar zaten seans kapanışından sonra çalışır).
    """
    if df.empty or interval == "1d":
        return df

    last = df.index[-1]
    if now is None:
        now = pd.Timestamp.now(tz=last.tz) if last.tz is not None else pd.Timestamp.now()

    if interval == "1wk" and now < last + pd.Timedelta(days=7):
        return df.iloc[:-1]
    if interval == "1mo" and (now.year == last.year and now.month == last.month):
        return df.iloc[:-1]
    if interval == "3mo":
        # Aynı takvim çeyreği içindeysek son (çeyreklik) mum henüz kapanmamıştır
        last_q = (last.month - 1) // 3
        now_q = (now.month - 1) // 3
        if now.year == last.year and now_q == last_q:
            return df.iloc[:-1]
    return df


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


def analyze_symbol(
    symbol: str,
    fetcher: BaseFetcher,
    timeframe: str = "daily",
    min_daily_turnover: float | None = None,
    benchmark_close: pd.Series | None = None,
) -> dict | None:
    """
    Tek bir sembolün gösterge değerlerini hesaplar; AL/SAT filtresi UYGULAMAZ.
    Yeterli geçmişi veya likiditesi olmayan semboller için None döner.
    Dönen dict, arayüzde kullanıcı tanımlı eşiklerle yeniden filtrelenebilir.

    `benchmark_close` verilirse göreli güç (`relative_strength`) de hesaplanır.
    """
    config = TIMEFRAMES[timeframe]
    df = fetcher.fetch_ohlcv(symbol, period=config["period"], interval=config["interval"])
    df = drop_in_progress_bar(df, config["interval"])

    if len(df) < config["min_bars"]:
        return None  # bu zaman diliminde yeterli geçmiş veri yok

    if min_daily_turnover and not passes_liquidity_filter(df, config["interval"], min_daily_turnover):
        return None  # ortalama günlük ciro eşiğin altında (likidite yetersiz)

    ema_periods = config["ema_periods"]
    df = compute_indicators(df, ema_periods)
    last_row = df.iloc[-1]

    result = {
        "symbol": symbol,
        "close": round(float(last_row["close"]), 2),
        "market_cap": fetcher.fetch_market_cap(symbol),
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

    rs = relative_strength(df["close"], benchmark_close, config["rs_bars"])
    result["relative_strength"] = None if rs is None else round(rs, 4)
    return result


def screen_symbol(
    symbol: str,
    fetcher: BaseFetcher,
    timeframe: str = "daily",
    min_daily_turnover: float | None = None,
) -> dict | None:
    """Tek bir sembolü çeker, gösterge hesaplar, varsayılan filtreden geçirir."""
    result = analyze_symbol(symbol, fetcher, timeframe, min_daily_turnover)
    if result is None:
        return None

    # passes_filters yalnızca anahtar erişimi yaptığından dict ile de çalışır
    if not passes_filters(result, TIMEFRAMES[timeframe]["ema_periods"]):
        return None
    return result


def run_analysis(
    symbols: list[str],
    fetcher: BaseFetcher,
    timeframe: str = "daily",
    min_daily_turnover: float | None = None,
    benchmark_close: pd.Series | None = None,
) -> list[dict]:
    """Tüm sembollerin gösterge değerlerini (filtresiz) döner, piyasa değerine göre sıralı."""
    stocks = []
    for symbol in symbols:
        try:
            stock = analyze_symbol(symbol, fetcher, timeframe, min_daily_turnover, benchmark_close)
            if stock:
                stocks.append(stock)
        except Exception as e:
            print(f"[UYARI] {symbol} atlandı: {e}")
            continue

    stocks.sort(key=lambda x: x["market_cap"] or 0, reverse=True)
    return stocks


def run_screener(
    symbols: list[str],
    fetcher: BaseFetcher,
    timeframe: str = "daily",
    min_daily_turnover: float | None = None,
) -> list[dict]:
    """Sembol listesini tarar, filtreden geçenleri piyasa değerine göre büyükten küçüğe sıralar."""
    results = []
    for symbol in symbols:
        try:
            result = screen_symbol(symbol, fetcher, timeframe, min_daily_turnover)
            if result:
                results.append(result)
        except Exception as e:
            # Üretimde: logging.warning(f"{symbol} atlandı: {e}")
            print(f"[UYARI] {symbol} atlandı: {e}")
            continue

    results.sort(key=lambda x: x["market_cap"] or 0, reverse=True)
    return results
