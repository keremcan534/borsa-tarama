import numpy as np
import pandas as pd

from app.screener.engine import drop_in_progress_bar
from app.screener.filters import passes_liquidity_filter


def _ohlcv(n=30, close=10.0, volume=1_000_000, freq="D", start="2026-01-05"):
    idx = pd.date_range(start, periods=n, freq=freq)
    c = np.full(n, close)
    return pd.DataFrame(
        {"open": c, "high": c + 0.5, "low": c - 0.5, "close": c, "volume": np.full(n, volume)},
        index=idx,
    )


# --- likidite filtresi ---

def test_liquidity_passes_when_daily_turnover_above_threshold():
    # 1M adet x 10 TL = 10M TL/gün ciro
    df = _ohlcv(volume=1_000_000, close=10.0)
    assert passes_liquidity_filter(df, "1d", min_daily_turnover=5_000_000)


def test_liquidity_fails_when_daily_turnover_below_threshold():
    # 10k adet x 10 TL = 100k TL/gün ciro
    df = _ohlcv(volume=10_000, close=10.0)
    assert not passes_liquidity_filter(df, "1d", min_daily_turnover=5_000_000)


def test_liquidity_normalizes_weekly_bars_to_daily():
    # Haftalık mumda 5M adet x 10 TL = 50M TL/hafta -> ~10M TL/gün
    df = _ohlcv(volume=5_000_000, close=10.0, freq="W-MON")
    assert passes_liquidity_filter(df, "1wk", min_daily_turnover=8_000_000)
    assert not passes_liquidity_filter(df, "1wk", min_daily_turnover=12_000_000)


# --- tamamlanmamış mum düşürme ---

def test_daily_bars_never_dropped():
    df = _ohlcv(n=10)
    assert len(drop_in_progress_bar(df, "1d")) == 10


def test_weekly_in_progress_bar_dropped():
    # Son haftalık mum pazartesi başladı, "şimdi" o haftanın çarşambası
    df = _ohlcv(n=10, freq="W-MON", start="2026-05-04")
    last_start = df.index[-1]
    now = last_start + pd.Timedelta(days=2)
    assert len(drop_in_progress_bar(df, "1wk", now=now)) == 9


def test_weekly_completed_bar_kept():
    df = _ohlcv(n=10, freq="W-MON", start="2026-05-04")
    last_start = df.index[-1]
    now = last_start + pd.Timedelta(days=8)  # bir sonraki hafta başladı
    assert len(drop_in_progress_bar(df, "1wk", now=now)) == 10


def test_monthly_in_progress_bar_dropped():
    df = _ohlcv(n=12, freq="MS", start="2025-01-01")  # son mum 2025-12-01
    now = pd.Timestamp("2025-12-14")
    assert len(drop_in_progress_bar(df, "1mo", now=now)) == 11


def test_monthly_completed_bar_kept():
    df = _ohlcv(n=12, freq="MS", start="2025-01-01")
    now = pd.Timestamp("2026-01-03")  # yeni ay başladı, aralık mumu kapandı
    assert len(drop_in_progress_bar(df, "1mo", now=now)) == 12


def test_quarterly_in_progress_bar_dropped():
    df = _ohlcv(n=8, freq="QS", start="2024-01-01")  # son çeyrek 2025-10-01
    now = pd.Timestamp("2025-11-15")  # aynı çeyrek (Q4) içinde
    assert len(drop_in_progress_bar(df, "3mo", now=now)) == 7


def test_quarterly_completed_bar_kept():
    df = _ohlcv(n=8, freq="QS", start="2024-01-01")  # son çeyrek 2025-10-01
    now = pd.Timestamp("2026-01-10")  # yeni çeyrek (Q1 2026) başladı
    assert len(drop_in_progress_bar(df, "3mo", now=now)) == 8
