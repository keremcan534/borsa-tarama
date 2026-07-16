"""Fon metrik birim testleri (ağ yok)."""

from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from app.funds.metrics import (
    compute_fund_metrics,
    cumulative_return,
    fund_score,
    max_drawdown,
    sharpe_ratio,
)
from app.funds.screen import run_fund_screener


def _rising_series(n: int = 120, start: float = 10.0, daily: float = 0.002) -> pd.Series:
    idx = pd.date_range(end=datetime(2026, 7, 15), periods=n, freq="B")
    prices = [start * ((1 + daily) ** i) for i in range(n)]
    return pd.Series(prices, index=idx)


def test_cumulative_return_positive_on_uptrend():
    s = _rising_series()
    r = cumulative_return(s, 30)
    assert r is not None and r > 0


def test_max_drawdown_zero_on_monotone_up():
    s = _rising_series()
    assert max_drawdown(s) == 0.0 or abs(max_drawdown(s)) < 1e-12


def test_max_drawdown_detects_drop():
    idx = pd.date_range("2026-01-01", periods=5, freq="D")
    s = pd.Series([100.0, 110.0, 105.0, 90.0, 95.0], index=idx)
    mdd = max_drawdown(s)
    assert mdd is not None and abs(mdd - (-20 / 110)) < 1e-9


def test_sharpe_positive_on_steady_gain():
    s = _rising_series(200)
    sh = sharpe_ratio(s)
    assert sh is not None and sh > 0


def test_fund_score_bounds():
    assert fund_score(None, None, None) == 0
    assert 0 <= fund_score(0.5, 1.0, -0.1) <= 100
    assert fund_score(1.0, 3.0, 0.0) == 100


def test_compute_fund_metrics_keys():
    s = _rising_series(100)
    m = compute_fund_metrics(s)
    for key in (
        "price",
        "return_1m",
        "return_3m",
        "return_6m",
        "return_1y",
        "return_ytd",
        "volatility",
        "sharpe",
        "max_drawdown",
        "score",
        "history_days",
    ):
        assert key in m
    assert m["history_days"] == 100
    assert m["price"] == float(s.iloc[-1])


def test_run_fund_screener_with_fake_df():
    rng = np.random.default_rng(0)
    rows = []
    end = datetime(2026, 7, 15)
    for code, name, base, drift in [
        ("AAA", "Test Fon A", 10.0, 0.003),
        ("BBB", "Test Fon B", 20.0, 0.001),
        ("CCC", "Küçük Fon", 5.0, 0.002),  # düşük AUM → elenir
    ]:
        for i in range(100):
            d = end - timedelta(days=100 - i)
            if d.weekday() >= 5:
                continue
            price = base * ((1 + drift) ** i) * (1 + float(rng.normal(0, 0.002)))
            size = 500_000_000 if code != "CCC" else 1_000_000
            rows.append(
                {
                    "date": d.date(),
                    "kind": "YAT",
                    "fund_code": code,
                    "fund_name": name,
                    "price": price,
                    "portfolio_size": size,
                    "investor_count": 1000,
                }
            )
    df = pd.DataFrame(rows)
    results = run_fund_screener(df=df, min_portfolio_size=100_000_000, max_funds=50)
    codes = {r["symbol"] for r in results}
    assert "AAA" in codes
    assert "BBB" in codes
    assert "CCC" not in codes
    assert results[0]["score"] >= results[-1]["score"]
    assert "tefas_url" in results[0]
    # TEFAS URL doğru formatta (FonAnaliz.aspx?FonKod=...) olmalı
    assert results[0]["tefas_url"] == f"https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod={results[0]['symbol']}"


def test_implausible_return_fund_excluded():
    """Birim-pay bölünmesi gibi gerçek dışı getirili fon (0.16→14.6) listeden atılır."""
    import numpy as np
    import pandas as pd

    from app.funds.screen import run_fund_screener

    end = datetime(2026, 7, 16)
    rng = np.random.default_rng(1)
    rows = []
    # SPLIT: 0.16'dan 14.6'ya kademeli tırmanan gerçek dışı fon
    for code, name, start_price, end_price in [
        ("SPL", "Bölünme Fonu", 0.16, 14.6),
        ("OKY", "Normal Fon", 10.0, 13.0),  # ~%30/yıl, mantıklı
    ]:
        n = 300
        for i in range(n):
            d = end - timedelta(days=n - i)
            price = start_price * ((end_price / start_price) ** (i / (n - 1)))
            rows.append(
                {
                    "date": d.date(),
                    "kind": "YAT",
                    "fund_code": code,
                    "fund_name": name,
                    "price": price * (1 + float(rng.normal(0, 0.001))),
                    "portfolio_size": 500_000_000,
                    "investor_count": 1000,
                }
            )
    df = pd.DataFrame(rows)
    results = run_fund_screener(df=df, min_portfolio_size=100_000_000, max_funds=50)
    codes = {r["symbol"] for r in results}
    assert "SPL" not in codes  # gerçek dışı getiri → elenir
    assert "OKY" in codes
