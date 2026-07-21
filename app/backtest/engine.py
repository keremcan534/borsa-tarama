"""Tarama stratejisinin geçmiş verideki performansını ölçer (backtest).

Yöntem:
1. Sembolün geçmişi çekilir, göstergeler CANLI TARAMANIN AYNI kodu ile hesaplanır
   (`compute_indicators` + `passes_filters`) — böylece backtest ile sitede gösterilen
   sinyaller tanım olarak aynı şeydir.
2. Filtrenin `False -> True` geçtiği her mum bir GİRİŞ SİNYALİ sayılır. Filtre arka
   arkaya birçok mumda açık kalabilir; bunların hepsini ayrı sinyal saymak aynı hareketi
   defalarca sayardı.
3. Giriş, sinyal mumunun ERTESİ mumunun açılışında yapılır. Filtre kapanışa baktığından
   sinyal mumunun kendi kapanışından almak, henüz bilinmeyen bir fiyattan işlem yapmak
   olurdu (look-ahead).
4. `h` mum sonraki kapanışa kadar tutulur; getiri ve aynı dönemdeki endeks getirisi
   birlikte kaydedilir.

Bilinçli kabuller / sınırlar:
- **Survivorship bias**: sembol listeleri BUGÜNÜN endeks üyeleri. Geçmişte endeksten
  düşmüş/battı diye çıkarılmış şirketler veride yok; sonuçlar bu yönde iyimserdir.
  Endeksin geçmiş üyelik verisi elimizde olmadığı için düzeltilemiyor, yalnızca
  raporda açıkça belirtiliyor.
- İşlem maliyeti, komisyon, slipaj, temettü ve vergi hesaba katılmaz.
- EMA'lar `min_periods` kullanmadığından serinin başındaki barlarda EMA değerleri
  oturmamış olur; bu yüzden ilk `max(ema_periods)` bar (warmup) atlanır.
"""

import pandas as pd

from app.data.benchmarks import BENCHMARKS, fetch_benchmark
from app.data.fetchers.base import BaseFetcher
from app.screener.engine import compute_indicators, drop_in_progress_bar
from app.screener.filters import passes_filters
from app.screener.timeframes import TIMEFRAMES

__all__ = ["BENCHMARKS", "HORIZONS", "Benchmark", "backtest_symbol", "load_benchmark", "run_backtest"]

# Backtest, canlı taramadan daha uzun geçmiş ister (canlı tarama yalnızca son mumu
# kullandığı için "1y" yetiyordu; burada her mumda sinyal aranıyor).
BACKTEST_PERIODS = {"daily": "5y", "weekly": "max", "monthly": "max", "quarterly": "max"}

# Sinyalden sonra kaç mum tutulduğunda ölçüleceği. Mum cinsindendir:
# günlükte 5/20/60 mum ~ 1 hafta / 1 ay / 3 ay.
HORIZONS = {"daily": [5, 20, 60], "weekly": [4, 13, 26], "monthly": [3, 6, 12], "quarterly": [2, 4, 8]}

# Karşılaştırma endeksleri `app/data/benchmarks.py`'de: taramanın göreli güç kolonu
# da aynı endeksi kullanır. Boğa piyasasında rastgele bir alım da yüksek isabet verir;
# asıl soru "endeksi al-tut'tan iyi mi?" olduğundan bu karşılaştırma şart.


def signal_mask(df: pd.DataFrame, ema_periods: list[int]) -> pd.Series:
    """Her mum için filtrenin geçip geçmediğini döner (canlı taramadaki filtrenin aynısı)."""
    return df.apply(lambda row: passes_filters(row, ema_periods), axis=1)


def find_signal_bars(mask: pd.Series, warmup: int) -> list[int]:
    """Filtrenin kapalıdan açığa geçtiği bar indekslerini döner (warmup sonrası)."""
    values = list(mask)
    return [i for i in range(max(warmup, 1), len(values)) if values[i] and not values[i - 1]]


def _pct(a: float, b: float) -> float | None:
    """b fiyatından a fiyatına yüzde değişim; geçersiz fiyatta None."""
    if b is None or a is None or b <= 0:
        return None
    return a / b - 1


class Benchmark:
    """Sinyalle aynı pencerede endeks getirisini veren yardımcı."""

    def __init__(self, df: pd.DataFrame | None):
        self._df = df if df is not None and not df.empty else None

    def close_at(self, date) -> float | None:
        """Verilen tarihteki (yoksa ondan önceki son) endeks kapanışı — al-tut eğrisi için."""
        if self._df is None:
            return None
        try:
            value = self._df["close"].asof(pd.Timestamp(date).tz_localize(self._df.index.tz))
        except (KeyError, TypeError, ValueError):
            try:
                value = self._df["close"].asof(pd.Timestamp(date))
            except (KeyError, TypeError, ValueError):
                return None
        return None if pd.isna(value) else float(value)

    def window_return(self, entry_date, exit_date) -> float | None:
        if self._df is None:
            return None
        try:
            entry = self._df["open"].asof(entry_date)
            exit_ = self._df["close"].asof(exit_date)
        except (KeyError, TypeError):
            return None
        if pd.isna(entry) or pd.isna(exit_):
            return None
        return _pct(float(exit_), float(entry))


def evaluate_signal(
    df: pd.DataFrame,
    signal_idx: int,
    horizons: list[int],
    benchmark: Benchmark | None = None,
) -> dict | None:
    """Tek bir sinyali işleme çevirip ufuk bazında getirilerini ölçer.

    Giriş sinyal mumunun ERTESİ mumunun açılışıdır; sinyalden sonra hiç mum
    kalmamışsa (veya giriş fiyatı geçersizse) None döner.
    """
    entry_idx = signal_idx + 1
    if entry_idx >= len(df):
        return None  # sinyal en son mumda: henüz girilebilecek bir mum yok

    entry_price = float(df["open"].iloc[entry_idx])
    if entry_price <= 0:
        return None

    entry_date = df.index[entry_idx]
    returns: dict[str, float] = {}
    benchmark_returns: dict[str, float] = {}
    exit_dates: dict[str, str] = {}

    for h in horizons:
        exit_idx = signal_idx + h
        if exit_idx >= len(df):
            continue  # bu ufuk henüz dolmadı, ölçülemez
        ret = _pct(float(df["close"].iloc[exit_idx]), entry_price)
        if ret is None:
            continue
        returns[str(h)] = ret
        # Portföy simülasyonu pozisyonun ne zaman kapandığını bilmek zorunda
        exit_dates[str(h)] = str(df.index[exit_idx].date())
        if benchmark is not None:
            bench = benchmark.window_return(entry_date, df.index[exit_idx])
            if bench is not None:
                benchmark_returns[str(h)] = bench

    if not returns:
        return None  # hiçbir ufuk dolmamış: değerlendirilemez

    # En uzun dolan ufuk boyunca pozisyonun giriş fiyatına göre gördüğü en kötü nokta.
    # Hiç zarara geçmediyse 0 olur (dipteki fiyat girişin üstündeyse "düşüş" yaşanmamıştır).
    longest = max(int(h) for h in returns)
    lows = df["low"].iloc[entry_idx : signal_idx + longest + 1]
    worst = _pct(float(lows.min()), entry_price) if len(lows) else None
    max_dd = min(worst, 0.0) if worst is not None else None

    return {
        "signal_date": str(df.index[signal_idx].date()),
        "entry_date": str(entry_date.date()),
        "entry_price": round(entry_price, 4),
        "returns": returns,
        "exit_dates": exit_dates,
        "benchmark_returns": benchmark_returns,
        "max_drawdown": max_dd,
    }


def backtest_symbol(
    symbol: str,
    fetcher: BaseFetcher,
    timeframe: str = "daily",
    benchmark: Benchmark | None = None,
) -> list[dict]:
    """Tek sembolün geçmişindeki tüm sinyalleri bulup değerlendirir."""
    config = TIMEFRAMES[timeframe]
    horizons = HORIZONS[timeframe]
    ema_periods = config["ema_periods"]

    df = fetcher.fetch_ohlcv(symbol, period=BACKTEST_PERIODS[timeframe], interval=config["interval"])
    df = drop_in_progress_bar(df, config["interval"])
    if len(df) < config["min_bars"]:
        return []

    df = compute_indicators(df.copy(), ema_periods)
    mask = signal_mask(df, ema_periods)

    trades = []
    for idx in find_signal_bars(mask, warmup=max(ema_periods)):
        trade = evaluate_signal(df, idx, horizons, benchmark)
        if trade:
            trade["symbol"] = symbol
            trades.append(trade)
    return trades


def load_benchmark(market: str, fetcher: BaseFetcher, timeframe: str = "daily") -> Benchmark:
    """Marketin karşılaştırma endeksini çeker; yoksa/çekilemezse boş Benchmark döner."""
    df = fetch_benchmark(
        market,
        fetcher,
        period=BACKTEST_PERIODS[timeframe],
        interval=TIMEFRAMES[timeframe]["interval"],
    )
    return Benchmark(df)


def run_backtest(
    market: str,
    symbols: list[str],
    fetcher: BaseFetcher,
    timeframe: str = "daily",
    benchmark: Benchmark | None = None,
) -> list[dict]:
    """Bir marketin tüm sembollerini backtest eder, tüm işlemleri tarih sırasıyla döner.

    `benchmark` verilmezse marketinki yüklenir; çağıran aynı endeksi portföy
    simülasyonunda da kullanacaksa bir kez yükleyip buraya geçirmelidir.
    """
    if benchmark is None:
        benchmark = load_benchmark(market, fetcher, timeframe)

    trades: list[dict] = []
    for symbol in symbols:
        try:
            trades.extend(backtest_symbol(symbol, fetcher, timeframe, benchmark))
        except Exception as e:
            print(f"[UYARI] {symbol} backtest'te atlandı: {e}")
            continue

    trades.sort(key=lambda t: t["signal_date"])
    return trades
