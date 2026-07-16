import numpy as np
import pandas as pd

from app.screener.relative_strength import relative_strength


def _series(values, start="2024-01-01", freq="D") -> pd.Series:
    return pd.Series(
        np.asarray(values, dtype=float),
        index=pd.date_range(start, periods=len(values), freq=freq),
    )


def test_stock_outperforming_the_index_has_positive_relative_strength():
    stock = _series([100, 110, 120])  # +%20
    bench = _series([100, 102, 105])  # +%5
    assert round(relative_strength(stock, bench, bars=2), 6) == round(0.20 - 0.05, 6)


def test_stock_rising_less_than_the_index_has_negative_relative_strength():
    # Yükselen bir piyasada hisse de yükselir; asıl soru endeksi geçip geçmediğidir.
    stock = _series([100, 105, 110])  # +%10
    bench = _series([100, 115, 130])  # +%30
    assert round(relative_strength(stock, bench, bars=2), 6) == round(0.10 - 0.30, 6)


def test_falling_stock_can_still_beat_a_worse_index():
    stock = _series([100, 95, 90])  # -%10
    bench = _series([100, 80, 70])  # -%30
    assert round(relative_strength(stock, bench, bars=2), 6) == 0.2


def test_missing_benchmark_returns_none():
    stock = _series([100, 110, 120])
    assert relative_strength(stock, None, bars=2) is None
    assert relative_strength(stock, pd.Series(dtype=float), bars=2) is None


def test_not_enough_history_returns_none():
    stock = _series([100, 110])
    bench = _series([100, 105])
    assert relative_strength(stock, bench, bars=60) is None


def test_benchmark_gaps_are_forward_filled_to_the_stock_calendar():
    # Endeks bazı günler işlem görmemiş (tatil): hissenin takvimine hizalanmalı
    stock = _series([100, 110, 120, 130])
    bench = pd.Series(
        [100.0, 110.0],
        index=pd.DatetimeIndex(["2024-01-01", "2024-01-04"]),
    )
    rs = relative_strength(stock, bench, bars=3)
    assert rs is not None
    assert round(rs, 6) == round(0.30 - 0.10, 6)


def test_zero_start_price_returns_none():
    stock = _series([0, 110, 120])
    bench = _series([100, 105, 110])
    assert relative_strength(stock, bench, bars=2) is None


def test_analyze_symbol_includes_relative_strength_when_benchmark_given():
    from tests.test_engine import FakeFetcher, _uptrend_ohlcv
    from app.screener.engine import analyze_symbol

    df = _uptrend_ohlcv(400)
    # Endeks hisseden daha yavaş yükseliyor -> göreli güç pozitif olmalı
    bench = pd.Series(np.linspace(100, 105, 400), index=df.index)

    stock = analyze_symbol("XYZ", FakeFetcher(df), benchmark_close=bench)
    assert stock["relative_strength"] > 0


def test_analyze_symbol_relative_strength_is_none_without_benchmark():
    from tests.test_engine import FakeFetcher, _uptrend_ohlcv
    from app.screener.engine import analyze_symbol

    stock = analyze_symbol("XYZ", FakeFetcher(_uptrend_ohlcv(400)))
    assert stock["relative_strength"] is None
