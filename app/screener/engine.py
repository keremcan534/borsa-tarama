import math

import pandas as pd

from app.data.fetchers.base import BaseFetcher
from app.data.indices import index_flags
from app.data.sectors import sector_of
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


def signal_fresh(df: pd.DataFrame, ema_periods: list[int]) -> bool:
    """Filtre SON KAPANMIŞ mumda False→True geçtiyse True (taze sinyal).

    "Yeni sinyal" bunu ifade eder ve backtest'in giriş kuralıyla (find_signal_bars,
    filtrenin kapalıdan açığa döndüğü bar) birebir aynıdır. Önceki taramayla kıyaslayan
    eski yöntemin aksine bu tanım verinin kendisinden gelir: haftalık/aylık bir sinyal
    tüm periyot boyunca (son mum değişene dek) taze işaretlenir, günde iki kez çalışan
    tarama etiketi bir sonraki koşuda düşürmez.
    """
    if df.empty or not passes_filters(df.iloc[-1], ema_periods):
        return False
    if len(df) < 2:
        return True  # kıyaslanacak önceki mum yok: ilk mumdaki sinyali taze say
    return not passes_filters(df.iloc[-2], ema_periods)


def finite_or_none(value, digits: int) -> float | None:
    """Sayıyı yuvarlar; NaN/Inf ise None döner.

    NaN JSON'a literal `NaN` olarak sızıyor ve tarayıcının JSON.parse'ı TÜM
    payload'ı reddediyordu — çeyreklik taramada stoch-rsi'nin sıfıra bölmesi
    tam olarak bunu üretti ve "3 Aylık" sekmesi yayında günlerce boş kaldı
    (Python'un json modülü NaN'i kabul ettiğinden testlerde görünmez).
    Hesaplanamayan gösterge None (JSON null) olarak yazılır; filtreler None'ı
    zaten "geçemedi" sayar.
    """
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(v):
        return None
    return round(v, digits)


def last_bar_change(df: pd.DataFrame) -> float | None:
    """Son mumun bir öncekine göre yüzde değişimi (oran, örn. 0.031 = %3,1).

    Günlük zaman diliminde "bugünün getirisi", haftalıkta haftanınki demektir —
    her zaman SON KAPANMIŞ muma göredir (`drop_in_progress_bar` sonrası).
    """
    if len(df) < 2:
        return None
    previous = float(df["close"].iloc[-2])
    last = float(df["close"].iloc[-1])
    if previous <= 0:
        return None
    return round(last / previous - 1, 4)


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
    series_sink: dict[str, list] | None = None,
) -> dict | None:
    """
    Tek bir sembolün gösterge değerlerini hesaplar; AL/SAT filtresi UYGULAMAZ.
    Yeterli geçmişi veya likiditesi olmayan semboller için None döner.
    Dönen dict, arayüzde kullanıcı tanımlı eşiklerle yeniden filtrelenebilir.

    `benchmark_close` verilirse göreli güç (`relative_strength`) de hesaplanır.
    `series_sink` verilirse fiyat serisi [[YYYY-MM-DD, close, open, high, low], ...]
    olarak sink'e yazılır (arayüzdeki fiyat/mum grafiği için; veri zaten elde, ek
    istek yok). İkinci alan bilinçli olarak KAPANIŞtır: eski [date, close] formatını
    okuyan tüm tüketiciler (sparkline, portföy değeri) index 1'i değiştirmeden çalışsın.
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
        "close": finite_or_none(last_row["close"], 2),
        # Son kapanmış mumun bir öncekine göre değişimi. Günlük taramada bu
        # "bugünün getirisi"dir — bir finans sayfasında ilk beklenen rakam.
        "change": last_bar_change(df),
        "market_cap": fetcher.fetch_market_cap(symbol),
        # Statik haritadan okunur, ek istek yok (ETF/emtiada sektör kavramı yok -> None)
        "sector": sector_of(symbol),
    }
    # Endeks üyeliği (in_bist100): tarama artık borsanın tamamını kapsıyor, arayüz
    # "yalnızca BIST 100" filtresini bu bayraktan üretiyor. Statik liste, ek istek yok.
    result.update(index_flags(symbol))
    for p in ema_periods:
        result[f"ema_{p}"] = finite_or_none(last_row[f"ema_{p}"], 2)
    result.update(
        {
            "macd_line": finite_or_none(last_row["macd_line"], 3),
            "rsi": finite_or_none(last_row["rsi"], 2),
            "stoch_k": finite_or_none(last_row["stoch_k"], 2),
            "stoch_rsi_k": finite_or_none(last_row["stoch_rsi_k"], 2),
        }
    )

    rs = relative_strength(df["close"], benchmark_close, config["rs_bars"])
    result["relative_strength"] = None if rs is None else round(rs, 4)

    # Sinyal bu (son kapanmış) mumda mı açıldı? "YENİ" etiketi bundan üretilir.
    result["signal_fresh"] = signal_fresh(df, ema_periods)

    # Temel oranlar (F/K, PD/DD, temettü): tarama saf teknikti, "güçlü ama pahalı mı?"
    # sorusuna cevabı yoktu. Kaynak temel veri sağlamıyorsa alanlar hiç eklenmez.
    result.update(fetcher.fetch_fundamentals(symbol))

    if series_sink is not None and symbol not in series_sink:
        # Grafikler her zaman GÜNLÜK seriden çizilir. Yalnızca haftalık/aylık taramaya
        # girip günlük elemeye (min_bars/likidite) takılan semboller eskiden dosyasız
        # kalıyor ve modal grafiği hiç açılamıyordu; günlük mumlar fetcher'ın
        # bellekteki geçmişinden türetildiğinden ek istek maliyeti yok.
        if config["interval"] == "1d":
            source = df
        else:
            try:
                source = fetcher.fetch_ohlcv(symbol, period="1y", interval="1d")
            except Exception:
                source = None
        if source is not None and len(source):
            bars = source[["open", "high", "low", "close"]].dropna(subset=["close"]).tail(270)

            def bar_row(ts, row):
                close = round(float(row.close), 4)

                # Tatil/işlem durması mumlarında açılış/uç değerler NaN gelebilir;
                # NaN JSON'u bozar, kapanışa düşmek mum çizimini ayakta tutar.
                def field(value):
                    cleaned = finite_or_none(value, 4)
                    return close if cleaned is None else cleaned

                return [ts.strftime("%Y-%m-%d"), close, field(row.open), field(row.high), field(row.low)]

            series_sink[symbol] = [bar_row(ts, row) for ts, row in bars.iterrows()]
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
    series_sink: dict[str, list] | None = None,
) -> list[dict]:
    """Tüm sembollerin gösterge değerlerini (filtresiz) döner, piyasa değerine göre sıralı."""
    stocks = []
    for symbol in symbols:
        try:
            stock = analyze_symbol(
                symbol, fetcher, timeframe, min_daily_turnover, benchmark_close, series_sink
            )
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
