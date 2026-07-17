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


def _fund_rows(code, name, prices, end=datetime(2026, 7, 16)):
    n = len(prices)
    return [
        {
            "date": (end - timedelta(days=n - i)).date(),
            "kind": "YAT",
            "fund_code": code,
            "fund_name": name,
            "price": p,
            "portfolio_size": 500_000_000,
            "investor_count": 1000,
        }
        for i, p in enumerate(prices)
    ]


def test_fund_with_single_day_jump_excluded():
    """Tek günde %40+ sıçrayan fon (denominasyon/bölünme artefaktı) elenir."""
    import pandas as pd

    from app.funds.screen import run_fund_screener

    n = 400
    # JMP: düzgün seyrederken tek günde 10 katına fırlar (gerçek fon böyle yapmaz)
    jumpy = [10.0 * (1.001**i) for i in range(n)]
    jumpy[250:] = [p * 10 for p in jumpy[250:]]
    smooth = [10.0 * (1.001**i) for i in range(n)]  # ~%49, mantıklı

    df = pd.DataFrame(_fund_rows("JMP", "Sıçrayan Fon", jumpy) + _fund_rows("OKY", "Normal Fon", smooth))
    results = run_fund_screener(df=df, min_portfolio_size=100_000_000, max_funds=50)
    codes = {r["symbol"] for r in results}
    assert "JMP" not in codes
    assert "OKY" in codes


def test_high_return_fund_without_jump_is_kept():
    """Sıçraması olmayan, düzgün yükselen yüksek getirili fon (RSZ/TLY gibi) ELENMEZ."""
    import pandas as pd

    from app.funds.screen import run_fund_screener

    n = 400
    # ~16x ama günlük hareketler küçük (max ~%1) → artefakt değil, gerçek performans
    high = [0.70 * ((11.84 / 0.70) ** (i / (n - 1))) for i in range(n)]
    df = pd.DataFrame(_fund_rows("HIG", "Yüksek Getirili Fon", high))
    results = run_fund_screener(df=df, min_portfolio_size=100_000_000, max_funds=50)
    assert "HIG" in {r["symbol"] for r in results}


def test_absurd_total_return_excluded_even_without_jump():
    """Sıçrama olmasa da fiziksel olarak anlamsız toplam getiri (88x) elenir."""
    import pandas as pd

    from app.funds.screen import run_fund_screener

    n = 400
    absurd = [0.165 * ((14.63 / 0.165) ** (i / (n - 1))) for i in range(n)]  # ~88x
    df = pd.DataFrame(_fund_rows("ABS", "Saçma Fon", absurd))
    results = run_fund_screener(df=df, min_portfolio_size=100_000_000, max_funds=50)
    assert "ABS" not in {r["symbol"] for r in results}


def test_daily_return_is_last_two_prices():
    from app.funds.metrics import daily_return

    s = pd.Series([10.0, 10.5], index=pd.date_range("2024-01-01", periods=2))
    assert round(daily_return(s), 6) == 0.05


def test_daily_return_guards_bad_prices_and_short_series():
    from app.funds.metrics import daily_return

    idx2 = pd.date_range("2024-01-01", periods=2)
    assert daily_return(pd.Series([10.0], index=idx2[:1])) is None
    assert daily_return(pd.Series([0.0, 10.0], index=idx2)) is None


def test_compute_fund_metrics_includes_daily_return():
    from app.funds.metrics import compute_fund_metrics

    prices = pd.Series(
        [10.0, 10.1, 10.2, 10.4],
        index=pd.date_range("2024-01-01", periods=4),
    )
    m = compute_fund_metrics(prices)
    assert round(m["return_1d"], 6) == round(10.4 / 10.2 - 1, 6)


def _smooth_prices(n=120, base=10.0, drift=0.002):
    return [base * ((1 + drift) ** i) for i in range(n)]


def test_ozel_fon_is_excluded_even_with_top_score():
    """ÖZEL fonlar halka satılmaz; puanı ne olursa olsun listeye giremez."""
    rows = _fund_rows("KFZ", "KUVEYT TÜRK PORTFÖY KFZ KATILIM SERBEST ÖZEL FON", _smooth_prices())
    rows += _fund_rows("PHE", "PUSULA PORTFÖY HİSSE SENEDİ FONU", _smooth_prices())
    results = run_fund_screener(df=pd.DataFrame(rows))
    codes = {r["symbol"] for r in results}
    assert "PHE" in codes
    assert "KFZ" not in codes


def test_nano_funds_below_investor_floor_are_excluded():
    """1-200 yatırımcılı fonlar tepeyi işgal edip TLY/PHE'yi gömüyordu."""
    rows = []
    for code, investors in [("SFA", 18), ("TLY", 97_340)]:
        r = _fund_rows(code, f"{code} FON", _smooth_prices())
        for x in r:
            x["investor_count"] = investors
        rows += r
    results = run_fund_screener(df=pd.DataFrame(rows))
    codes = {r["symbol"] for r in results}
    assert "TLY" in codes
    assert "SFA" not in codes


def test_missing_investor_column_skips_the_floor():
    """Eski şemada investor_count yoksa filtre sessizce devre dışı kalmalı."""
    rows = _fund_rows("AAA", "TEST FON", _smooth_prices())
    df = pd.DataFrame(rows).drop(columns=["investor_count"])
    results = run_fund_screener(df=df)
    assert {r["symbol"] for r in results} == {"AAA"}
