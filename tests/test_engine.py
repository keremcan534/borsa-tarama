import numpy as np
import pandas as pd

from app.data.fetchers.base import BaseFetcher
from app.screener.engine import run_screener, screen_symbol


def _uptrend_ohlcv(n: int = 400) -> pd.DataFrame:
    """Uzun vadeli yükseliş + kısa vadede ölçülü bir son yükseliş: momentum filtresini geçecek şekilde ayarlı."""
    np.random.seed(1)
    trend = np.linspace(50, 135, n)
    noise = np.random.randn(n) * 1.2
    close = trend + noise
    close[-25:] = close[-26] + np.linspace(0, 3, 25) + np.random.randn(25) * 0.2
    idx = pd.date_range("2024-01-01", periods=n, freq="D")
    return pd.DataFrame(
        {
            "open": close,
            "high": close + 1,
            "low": close - 1,
            "close": close,
            "volume": np.full(n, 1_000_000),
        },
        index=idx,
    )


def _flat_ohlcv(n: int) -> pd.DataFrame:
    close = np.full(n, 100.0)
    idx = pd.date_range("2024-01-01", periods=n, freq="D")
    return pd.DataFrame(
        {"open": close, "high": close + 0.5, "low": close - 0.5, "close": close, "volume": np.full(n, 1_000_000)},
        index=idx,
    )


class FakeFetcher(BaseFetcher):
    def __init__(self, ohlcv: pd.DataFrame, market_cap: float | None = 1_000_000.0):
        self._ohlcv = ohlcv
        self._market_cap = market_cap

    def fetch_ohlcv(self, symbol: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame:
        return self._ohlcv

    def fetch_market_cap(self, symbol: str) -> float | None:
        return self._market_cap


class RaisingFetcher(BaseFetcher):
    def fetch_ohlcv(self, symbol: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame:
        raise ValueError(f"{symbol} için veri bulunamadı")

    def fetch_market_cap(self, symbol: str) -> float | None:
        return None


def test_screen_symbol_returns_none_when_not_enough_history():
    fetcher = FakeFetcher(_flat_ohlcv(50))
    assert screen_symbol("XYZ", fetcher) is None


def test_screen_symbol_passes_when_strong_uptrend():
    fetcher = FakeFetcher(_uptrend_ohlcv(), market_cap=42.0)
    result = screen_symbol("XYZ", fetcher)
    assert result is not None
    assert result["symbol"] == "XYZ"
    assert result["market_cap"] == 42.0
    assert result["close"] > result["ema_200"]


def test_screen_symbol_fails_when_flat_no_momentum():
    fetcher = FakeFetcher(_flat_ohlcv(400))
    assert screen_symbol("XYZ", fetcher) is None


def test_run_screener_skips_symbol_that_raises_and_continues():
    fetcher = RaisingFetcher()
    results = run_screener(["BAD1", "BAD2"], fetcher)
    assert results == []


def test_run_screener_sorts_by_market_cap_descending(monkeypatch):
    import app.screener.engine as engine

    fake_results = {
        "A": {"symbol": "A", "market_cap": 100.0},
        "B": {"symbol": "B", "market_cap": 500.0},
        "C": {"symbol": "C", "market_cap": 250.0},
    }

    def fake_screen_symbol(symbol, fetcher, timeframe="daily", min_daily_turnover=None):
        return fake_results[symbol]

    monkeypatch.setattr(engine, "screen_symbol", fake_screen_symbol)
    results = engine.run_screener(["A", "B", "C"], fetcher=None)
    assert [r["symbol"] for r in results] == ["B", "C", "A"]


def test_analyze_symbol_returns_indicators_without_filtering():
    from app.screener.engine import analyze_symbol

    # Düz seri varsayılan filtreyi geçmez ama analyze yine de değerleri döndürmeli
    fetcher = FakeFetcher(_flat_ohlcv(400))
    stock = analyze_symbol("XYZ", fetcher)
    assert stock is not None
    assert {"symbol", "close", "rsi", "macd_line", "stoch_k", "ema_200"} <= set(stock)


def test_run_analysis_includes_non_passing_stocks(monkeypatch):
    from app.screener.engine import run_analysis

    fetcher = FakeFetcher(_flat_ohlcv(400))
    stocks = run_analysis(["AAA", "BBB"], fetcher)
    assert len(stocks) == 2  # filtreyi geçmeseler de analizde yer alırlar


def test_signal_fresh_true_on_crossing_bar():
    from app.screener.engine import signal_fresh
    from app.screener.filters import DEFAULT_EMA_PERIODS

    cols = ["close", "ema_9", "ema_21", "ema_50", "ema_200", "macd_line", "rsi", "stoch_k", "stoch_rsi_k"]
    prev_fail = [100, 101, 101, 101, 101, -1, 50, 50, 50]  # fiyat EMA'ların altında -> geçmez
    last_pass = [110, 100, 100, 100, 100, 1, 50, 50, 50]  # hepsinin üstünde, macd>0 -> geçer
    df = pd.DataFrame([prev_fail, last_pass], columns=cols)
    assert signal_fresh(df, DEFAULT_EMA_PERIODS) is True


def test_signal_fresh_false_when_already_passing():
    from app.screener.engine import signal_fresh
    from app.screener.filters import DEFAULT_EMA_PERIODS

    cols = ["close", "ema_9", "ema_21", "ema_50", "ema_200", "macd_line", "rsi", "stoch_k", "stoch_rsi_k"]
    passing = [110, 100, 100, 100, 100, 1, 50, 50, 50]
    df = pd.DataFrame([passing, passing], columns=cols)  # iki mum da geçiyor -> taze değil
    assert signal_fresh(df, DEFAULT_EMA_PERIODS) is False


def test_signal_fresh_false_when_last_bar_not_signal():
    from app.screener.engine import signal_fresh
    from app.screener.filters import DEFAULT_EMA_PERIODS

    cols = ["close", "ema_9", "ema_21", "ema_50", "ema_200", "macd_line", "rsi", "stoch_k", "stoch_rsi_k"]
    passing = [110, 100, 100, 100, 100, 1, 50, 50, 50]
    fail = [100, 101, 101, 101, 101, -1, 50, 50, 50]
    df = pd.DataFrame([passing, fail], columns=cols)  # son mum sinyal değil -> taze değil
    assert signal_fresh(df, DEFAULT_EMA_PERIODS) is False


def test_analyze_symbol_without_fundamentals_support():
    # Temel veri sağlamayan bir fetcher (BaseFetcher varsayılanı {}) taramayı bozmamalı
    from app.screener.engine import analyze_symbol

    stock = analyze_symbol("XYZ", FakeFetcher(_uptrend_ohlcv()))
    assert stock is not None
    assert "pe" not in stock  # alan hiç eklenmez, arayüz '—' gösterir


def test_analyze_symbol_merges_fundamentals_when_available():
    from app.screener.engine import analyze_symbol

    class FundamentalFetcher(FakeFetcher):
        def fetch_fundamentals(self, symbol: str) -> dict:
            return {"pe": 12.5, "pb": 1.8, "dividend_yield": 0.031, "roe": 0.22}

    stock = analyze_symbol("XYZ", FundamentalFetcher(_uptrend_ohlcv()))
    assert stock["pe"] == 12.5
    assert stock["dividend_yield"] == 0.031
    # Teknik alanlar temel veriyle ezilmemeli
    assert "rsi" in stock and "ema_200" in stock


def test_base_fetcher_fundamentals_default_is_empty():
    assert FakeFetcher(_flat_ohlcv(400)).fetch_fundamentals("XYZ") == {}


def test_analyze_symbol_includes_signal_fresh_field():
    from app.screener.engine import analyze_symbol

    fetcher = FakeFetcher(_uptrend_ohlcv())
    stock = analyze_symbol("XYZ", fetcher)
    assert "signal_fresh" in stock


def test_screen_symbol_weekly_requires_200_bars():
    fetcher = FakeFetcher(_uptrend_ohlcv(150))
    assert screen_symbol("XYZ", fetcher, timeframe="weekly") is None


def test_screen_symbol_monthly_uses_reduced_ema_set():
    # 100 aylık mum: EMA200 için yetersiz ama aylık görünümün 9/21/50 seti için yeterli.
    # 400 barlık yumuşak eğimli serinin son 100 barı alınır (dik seri RSI'ı 70 üstüne itiyor).
    fetcher = FakeFetcher(_uptrend_ohlcv(400).iloc[-100:])
    result = screen_symbol("XYZ", fetcher, timeframe="monthly")
    assert result is not None
    assert "ema_50" in result
    assert "ema_200" not in result
