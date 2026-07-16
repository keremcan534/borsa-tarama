import numpy as np
import pandas as pd

from app.backtest.engine import (
    Benchmark,
    backtest_symbol,
    evaluate_signal,
    find_signal_bars,
    load_benchmark,
    signal_mask,
)
from app.backtest.metrics import summarize, top_symbols
from app.data.fetchers.base import BaseFetcher


def _df(closes, opens=None, lows=None) -> pd.DataFrame:
    n = len(closes)
    closes = np.asarray(closes, dtype=float)
    opens = np.asarray(opens if opens is not None else closes, dtype=float)
    lows = np.asarray(lows if lows is not None else closes - 1, dtype=float)
    return pd.DataFrame(
        {
            "open": opens,
            "high": closes + 1,
            "low": lows,
            "close": closes,
            "volume": np.full(n, 1_000_000),
        },
        index=pd.date_range("2024-01-01", periods=n, freq="D"),
    )


def _uptrend(n: int = 400) -> pd.DataFrame:
    """Uzun vadeli yükseliş: geçmişinde momentum sinyalleri üretecek bir seri."""
    np.random.seed(1)
    close = np.linspace(50, 135, n) + np.random.randn(n) * 1.2
    return _df(close)


class FakeFetcher(BaseFetcher):
    def __init__(self, ohlcv: pd.DataFrame):
        self._ohlcv = ohlcv
        self.requested_periods: list[str] = []

    def fetch_ohlcv(self, symbol: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame:
        self.requested_periods.append(period)
        return self._ohlcv.copy()

    def fetch_market_cap(self, symbol: str) -> float | None:
        return 1_000_000.0


class RaisingFetcher(BaseFetcher):
    def fetch_ohlcv(self, symbol: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame:
        raise ValueError("veri yok")

    def fetch_market_cap(self, symbol: str) -> float | None:
        return None


# --- sinyal tespiti ---------------------------------------------------------


def test_find_signal_bars_only_returns_false_to_true_transitions():
    mask = pd.Series([False, True, True, True, False, False, True])
    assert find_signal_bars(mask, warmup=0) == [1, 6]  # 2 ve 3 aynı sinyalin devamı


def test_find_signal_bars_skips_warmup_region():
    # EMA'lar serinin başında oturmadığından warmup içindeki geçişler sayılmaz
    mask = pd.Series([False, True, False, False, True])
    assert find_signal_bars(mask, warmup=4) == [4]


def test_signal_mask_matches_live_filter_row_by_row():
    from app.screener.engine import compute_indicators
    from app.screener.filters import passes_filters

    df = compute_indicators(_uptrend(), [9, 21, 50, 200])
    mask = signal_mask(df, [9, 21, 50, 200])
    # backtest sinyali ile canlı taramanın filtresi tanım olarak aynı olmalı
    assert bool(mask.iloc[-1]) == passes_filters(df.iloc[-1], [9, 21, 50, 200])
    assert bool(mask.iloc[250]) == passes_filters(df.iloc[250], [9, 21, 50, 200])


# --- sinyal değerlendirme (look-ahead kontrolü) -----------------------------


def test_entry_uses_next_bar_open_not_signal_bar_close():
    # Sinyal barının kapanışı 100, ertesi barın açılışı 110: giriş 110'dan olmalı.
    # 100'den girmek, sinyal anında bilinmeyen bir fiyattan işlem yapmak olurdu.
    df = _df(closes=[100, 120, 132], opens=[100, 110, 130])
    trade = evaluate_signal(df, signal_idx=0, horizons=[1])
    assert trade["entry_price"] == 110.0
    assert trade["entry_date"] == "2024-01-02"
    assert trade["returns"]["1"] == 120 / 110 - 1


def test_signal_on_last_bar_is_not_tradeable():
    df = _df(closes=[100, 105])
    assert evaluate_signal(df, signal_idx=1, horizons=[1]) is None


def test_horizon_longer_than_available_history_is_omitted():
    df = _df(closes=[100, 110, 121])
    trade = evaluate_signal(df, signal_idx=0, horizons=[1, 2, 60])
    assert set(trade["returns"]) == {"1", "2"}  # 60 mum dolmadı, ölçülmez


def test_evaluate_signal_returns_none_when_no_horizon_completes():
    df = _df(closes=[100, 110])
    assert evaluate_signal(df, signal_idx=0, horizons=[5]) is None


def test_max_drawdown_uses_lows_and_is_zero_when_never_underwater():
    df = _df(closes=[100, 110, 120], opens=[100, 100, 120], lows=[99, 95, 118])
    trade = evaluate_signal(df, signal_idx=0, horizons=[2])
    # giriş 100, pozisyon süresince en dip 95 -> -%5
    assert trade["max_drawdown"] == 95 / 100 - 1

    df = _df(closes=[100, 110, 120], opens=[100, 100, 120], lows=[99, 101, 118])
    trade = evaluate_signal(df, signal_idx=0, horizons=[2])
    assert trade["max_drawdown"] == 0.0  # hiç zarara geçmedi


def test_zero_entry_price_is_rejected():
    df = _df(closes=[100, 110, 120], opens=[100, 0, 120])
    assert evaluate_signal(df, signal_idx=0, horizons=[1]) is None


# --- endeks karşılaştırması -------------------------------------------------


def test_benchmark_return_measured_over_the_same_window():
    bench = Benchmark(_df(closes=[10, 11, 12], opens=[10, 10, 12]))
    df = _df(closes=[100, 110, 120], opens=[100, 100, 120])
    trade = evaluate_signal(df, signal_idx=0, horizons=[2], benchmark=bench)
    assert trade["returns"]["2"] == 120 / 100 - 1  # hisse +%20
    assert trade["benchmark_returns"]["2"] == 12 / 10 - 1  # endeks +%20


def test_benchmark_without_data_yields_no_benchmark_returns():
    df = _df(closes=[100, 110, 120], opens=[100, 100, 120])
    trade = evaluate_signal(df, signal_idx=0, horizons=[2], benchmark=Benchmark(None))
    assert trade["benchmark_returns"] == {}


def test_load_benchmark_is_empty_for_market_without_index():
    assert load_benchmark("commodity", FakeFetcher(_uptrend()))._df is None


def test_load_benchmark_survives_fetch_failure():
    assert load_benchmark("bist100", RaisingFetcher())._df is None


# --- uçtan uca --------------------------------------------------------------


def test_backtest_symbol_finds_signals_in_uptrend():
    fetcher = FakeFetcher(_uptrend())
    trades = backtest_symbol("XYZ", fetcher)
    assert trades
    assert all(t["symbol"] == "XYZ" for t in trades)
    assert all(t["entry_date"] > t["signal_date"] for t in trades)
    assert fetcher.requested_periods == ["5y"]  # canlı taramanın 1y'ı backtest'e yetmez


def test_backtest_symbol_returns_empty_when_history_too_short():
    assert backtest_symbol("XYZ", FakeFetcher(_uptrend(50))) == []


def test_run_backtest_skips_failing_symbols():
    from app.backtest.engine import run_backtest

    assert run_backtest("bist100", ["BAD"], RaisingFetcher()) == []


# --- metrikler --------------------------------------------------------------


def _trade(symbol: str, ret: float, bench: float | None = None, date: str = "2024-01-01") -> dict:
    return {
        "symbol": symbol,
        "signal_date": date,
        "entry_date": date,
        "entry_price": 100.0,
        "returns": {"20": ret},
        "benchmark_returns": {"20": bench} if bench is not None else {},
        "max_drawdown": -0.05,
    }


def test_summarize_computes_win_rate_and_excess_over_benchmark():
    trades = [
        _trade("A", 0.10, 0.04),
        _trade("B", -0.05, 0.04),
        _trade("C", 0.30, 0.04),
        _trade("D", 0.02, 0.04),
    ]
    summary = summarize(trades, [20])
    h = summary["horizons"]["20"]

    assert summary["signals"] == 4
    assert summary["symbols"] == 4
    assert h["win_rate"] == 0.75  # 4 sinyalin 3'ü artıda kapandı
    assert h["avg_return"] == 0.0925
    # ama endeksi yalnızca 2'si yendi: isabet oranı tek başına yanıltıcı
    assert h["beat_benchmark_rate"] == 0.5
    assert round(h["avg_excess_return"], 4) == 0.0525
    assert summary["avg_max_drawdown"] == -0.05


def test_summarize_empty_trades():
    assert summarize([], [20]) == {"signals": 0, "symbols": 0, "horizons": {}}


def test_summarize_omits_benchmark_stats_when_no_benchmark_data():
    summary = summarize([_trade("A", 0.10), _trade("B", 0.20)], [20])
    assert "beat_benchmark_rate" not in summary["horizons"]["20"]


def test_summarize_skips_horizon_with_no_completed_trades():
    assert summarize([_trade("A", 0.1)], [20, 60])["horizons"].keys() == {"20"}


def test_top_symbols_requires_minimum_signal_count():
    trades = [_trade("A", 0.5)] + [_trade("B", 0.1) for _ in range(3)]
    rows = top_symbols(trades, "20", min_signals=3)
    # A'nın tek sinyali daha yüksek getirili ama şans eseri olabilir; listeye girmez
    assert [r["symbol"] for r in rows] == ["B"]
    assert rows[0]["signals"] == 3
