"""Fon metrik birim testleri (ağ yok)."""

from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import pytest

from app.funds.metrics import (
    alpha_beta,
    calmar_ratio,
    compute_fund_metrics,
    cumulative_return,
    fund_score,
    max_drawdown,
    sharpe_ratio,
    sortino_ratio,
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


def _noisy_series(n=400, drift=0.0006, vol=0.01, seed=7, start=10.0):
    """Rastgele ama tekrarlanabilir fiyat serisi (metriklerin işaretini test etmek için)."""
    rng = np.random.default_rng(seed)
    steps = rng.normal(drift, vol, n)
    idx = pd.date_range(end=datetime(2026, 7, 15), periods=n, freq="B")
    return pd.Series(start * np.cumprod(1 + steps), index=idx)


def test_sortino_ignores_upside_volatility():
    """İki serinin ortalaması ve düşüş günleri AYNI; biri yukarı yönde daha oynak.

    Sharpe bu oynaklığı risk sayıp fonu cezalandırır; Sortino'nun paydası
    değişmediği için oran (log getiri kaynaklı çok küçük fark dışında) aynı kalır.
    Metriğin asıl varlık sebebi budur.
    """
    idx = pd.date_range("2024-01-01", periods=201, freq="B")
    steady, choppy, up_days = [], [], 0
    for i in range(200):
        if i % 10 == 0:
            steady.append(-0.001)  # düşüş günleri iki seride de birebir aynı
            choppy.append(-0.001)
        else:
            steady.append(0.002)
            # Aynı sayıda 0.001 ve 0.003: ortalama korunur, oynaklık iki katına çıkar
            choppy.append(0.001 if up_days % 2 else 0.003)
            up_days += 1

    def build(rets):
        prices = [10.0]
        for r in rets:
            prices.append(prices[-1] * (1 + r))
        return pd.Series(prices, index=idx)

    steady_s, choppy_s = build(steady), build(choppy)
    assert sharpe_ratio(choppy_s) < sharpe_ratio(steady_s) * 0.9
    assert sortino_ratio(choppy_s) == pytest.approx(sortino_ratio(steady_s), rel=0.01)


def test_sortino_is_higher_than_sharpe_when_downside_is_mild():
    """Kayıplar küçük, kazançlar dalgalı: Sortino Sharpe'tan yüksek çıkar."""
    rng = np.random.default_rng(3)
    rets = np.abs(rng.normal(0.004, 0.02, 300))  # tamamı pozitif...
    rets[::10] = -0.001  # ...her 10 günde bir küçük kayıp
    idx = pd.date_range(end=datetime(2026, 7, 15), periods=len(rets) + 1, freq="B")
    prices = pd.Series(10.0 * np.cumprod(np.r_[1.0, 1 + rets]), index=idx)
    assert sortino_ratio(prices) > sharpe_ratio(prices) > 0


def test_sortino_risk_free_lowers_the_ratio():
    """Risksiz faiz yükseldikçe fazla getiri azalır → oran düşer."""
    prices = _noisy_series()
    base = sortino_ratio(prices)
    with_rf = sortino_ratio(prices, risk_free=0.40)
    assert base is not None and with_rf is not None
    assert with_rf < base


def test_sortino_needs_history():
    short = _rising_series(10)
    assert sortino_ratio(short) is None


def test_calmar_is_cagr_over_max_drawdown():
    idx = pd.date_range("2024-01-01", periods=366, freq="D")
    # Yıl ortasında -%20 düşüş, yıl sonunda +%50 kapanış
    prices = np.r_[
        np.linspace(100, 120, 120),
        np.linspace(120, 96, 100),
        np.linspace(96, 150, 146),
    ]
    s = pd.Series(prices, index=idx)
    calmar = calmar_ratio(s)
    mdd = max_drawdown(s)
    span_years = (idx[-1] - idx[0]).days / 365.25
    cagr = (150 / 100) ** (1 / span_years) - 1
    assert abs(calmar - cagr / abs(mdd)) < 1e-9


def test_calmar_none_without_drawdown_or_history():
    monotone = pd.Series(
        [10 * 1.001**i for i in range(300)], index=pd.date_range("2025-01-01", periods=300)
    )
    assert calmar_ratio(monotone) is None  # payda 0 → tanımsız
    short = pd.Series([10.0, 11.0, 9.0], index=pd.date_range("2025-01-01", periods=3))
    assert calmar_ratio(short) is None  # 3 gün CAGR'ye çevrilemez


def test_alpha_beta_recovers_known_beta_and_alpha():
    """Endeksin 0.5 katı + günlük sabit fazla getiri üretilen seride regresyon bunu bulmalı."""
    bench = _noisy_series(seed=11, start=100.0)
    bench_rets = bench.pct_change().fillna(0.0).to_numpy()
    daily_alpha = 0.0003
    fund_rets = 0.5 * bench_rets + daily_alpha
    fund = pd.Series(10.0 * np.cumprod(1 + fund_rets), index=bench.index)

    # Bu seri endeksle AYNI güne hizalı üretildi; gecikme düzeltmesi kapatılmalı
    capm = alpha_beta(fund, bench, benchmark_lag=0)
    assert capm is not None
    assert abs(capm["beta"] - 0.5) < 0.02
    # Yıllıklandırma bileşik: (1 + günlük alfa)^252 - 1
    assert abs(capm["alpha"] - ((1 + daily_alpha) ** 252 - 1)) < 0.01


def test_alpha_beta_matches_previous_day_index_return():
    """TEFAS gecikmesi: D tarihli fon fiyatı D-1 kapanışını yansıtır.

    Fon getirisi bilerek endeksin BİR ÖNCEKİ günkü getirisinden üretiliyor.
    Varsayılan (gecikmeli) hizalama betayı bulmalı; aynı güne hizalayan hesap
    ise sıfıra yakın bir beta üretmeli — yayında görülen hata tam olarak buydu.
    """
    bench = _noisy_series(seed=13, start=100.0)
    bench_rets = bench.pct_change().fillna(0.0)
    # shift(1): D günündeki fon getirisi D-1'in endeks getirisine bağlı
    fund_rets = 0.8 * bench_rets.shift(1).fillna(0.0)
    fund = pd.Series(10.0 * np.cumprod(1 + fund_rets.to_numpy()), index=bench.index)

    lagged = alpha_beta(fund, bench)
    same_day = alpha_beta(fund, bench, benchmark_lag=0)
    assert abs(lagged["beta"] - 0.8) < 0.02
    assert abs(same_day["beta"]) < 0.1


def test_alpha_beta_handles_timezone_and_missing_days():
    """Fon (tz'siz, iş günü) ile endeks (tz'li, eksik günlü) hizalanabilmeli."""
    bench = _noisy_series(seed=5, start=100.0)
    bench = bench.tz_localize("Europe/Istanbul")
    bench = bench.drop(bench.index[::7])  # endekste tatil delikleri
    fund = _noisy_series(seed=6)

    capm = alpha_beta(fund, bench)
    assert capm is not None
    assert capm["obs"] < len(fund)  # yalnızca ortak günler kullanıldı
    assert -3 < capm["beta"] < 3


def test_alpha_beta_none_without_benchmark_or_overlap():
    fund = _noisy_series()
    assert alpha_beta(fund, None) is None
    far_away = _noisy_series(n=100)
    far_away.index = pd.date_range("2019-01-01", periods=100, freq="B")
    assert alpha_beta(fund, far_away) is None


def test_compute_fund_metrics_exposes_new_ratios():
    bench = _noisy_series(seed=21, start=100.0)
    fund = _noisy_series(seed=22)
    m = compute_fund_metrics(fund, benchmark=bench)
    for key in ("sortino", "calmar", "beta", "alpha"):
        assert key in m and m[key] is not None
    # Endeks verilmezse beta/alfa boş kalır, diğer metrikler üretilmeye devam eder
    without = compute_fund_metrics(fund)
    assert without["beta"] is None and without["alpha"] is None
    assert without["sortino"] == m["sortino"]
    assert without["score"] == m["score"]


def _flat_growth_rows(code, name, annual_rate, days=400, end=datetime(2026, 7, 16)):
    """Yıllık `annual_rate` ile düzgün büyüyen bir fon (para piyasası benzeri)."""
    daily = (1 + annual_rate) ** (1 / 365.25) - 1
    prices = [10.0 * ((1 + daily) ** i) for i in range(days)]
    return _fund_rows(code, name, prices, end=end)


def test_risk_free_rate_is_median_of_money_market_funds():
    from app.funds.screen import estimate_risk_free_rate

    idx = pd.date_range("2025-06-01", periods=400, freq="D")

    def series(rate):
        daily = (1 + rate) ** (1 / 365.25) - 1
        return pd.Series([10.0 * ((1 + daily) ** i) for i in range(400)], index=idx)

    series_by_code = {
        "AAA": series(0.38),
        "BBB": series(0.42),
        "CCC": series(0.40),
        "DDD": series(1.20),  # para piyasası DEĞİL → medyana girmemeli
    }
    names = {
        "AAA": "İŞ PORTFÖY PARA PİYASASI FONU",
        "BBB": "AK PORTFÖY LİKİT FON",
        "CCC": "GARANTİ PORTFÖY PARA PIYASASI FONU",  # noktasız I ile yazılmış
        "DDD": "PUSULA PORTFÖY HİSSE SENEDİ FONU",
    }
    rate = estimate_risk_free_rate(series_by_code, names)
    assert rate is not None and abs(rate - 0.40) < 0.005


def test_risk_free_rate_none_when_too_few_money_market_funds():
    from app.funds.screen import estimate_risk_free_rate

    idx = pd.date_range("2025-06-01", periods=400, freq="D")
    one = {"AAA": pd.Series([10.0 * (1.001**i) for i in range(400)], index=idx)}
    assert estimate_risk_free_rate(one, {"AAA": "PARA PİYASASI FONU"}) is None


def test_risk_free_rate_ignores_absurd_series():
    """Bozuk fiyat serisi (yılda 40 kat) vekil oranı kaçırmasın."""
    from app.funds.screen import estimate_risk_free_rate

    idx = pd.date_range("2025-06-01", periods=400, freq="D")

    def series(rate):
        daily = (1 + rate) ** (1 / 365.25) - 1
        return pd.Series([10.0 * ((1 + daily) ** i) for i in range(400)], index=idx)

    codes = {"A": series(0.40), "B": series(0.41), "C": series(0.39), "D": series(40.0)}
    names = {c: "PARA PİYASASI FONU" for c in codes}
    rate = estimate_risk_free_rate(codes, names)
    assert rate is not None and 0.38 < rate < 0.42


def test_screener_measures_risk_free_rate_from_money_market_funds():
    """Risksiz getiri para piyasası fonlarından ölçülür; Sortino ona göre düşer.

    Para piyasası fonlarıyla aynı sürükleyişe (yılda ~%40) sahip ama günlük
    dalgalanan bir hisse fonu, risksiz getiri 0 sayılırsa "yüksek Sortino" alır.
    Vekil oran ölçülünce fazla getirisi kaybolur — dalgalanmanın geometrik
    aşındırması yüzünden risksiz getirinin bir tık ALTINDA kalır — ve oran
    negatife döner. İstenen davranış budur: bu fon riski boşuna taşımıştır.
    """
    rows = []
    for code in ("PPA", "PPB", "PPC"):
        rows += _flat_growth_rows(code, f"{code} PORTFÖY PARA PİYASASI FONU", 0.40)

    daily = (1 + 0.40) ** (1 / 365.25) - 1
    prices, price = [], 10.0
    for i in range(400):
        prices.append(price)
        # Aynı ortalama sürükleyiş, ama gün gün zikzak: düşüş günleri var
        price *= 1 + daily + (0.01 if i % 2 else -0.01)
    rows += _fund_rows("EQU", "TEST PORTFÖY HİSSE SENEDİ FONU", prices)
    df = pd.DataFrame(rows)

    measured = next(r for r in run_fund_screener(df=df) if r["symbol"] == "EQU")
    zero_rf = next(r for r in run_fund_screener(df=df, risk_free=0.0) if r["symbol"] == "EQU")

    assert measured["sortino"] < 0 < zero_rf["sortino"]


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
        "sortino",
        "calmar",
        "max_drawdown",
        "beta",
        "alpha",
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


def test_include_series_returns_price_points_for_listed_funds():
    rows = _fund_rows("PHE", "PUSULA", _smooth_prices())
    rows += _fund_rows("TLY", "İŞ PORTFÖY", _smooth_prices())
    results, series = run_fund_screener(df=pd.DataFrame(rows), include_series=True)
    codes = {r["symbol"] for r in results}
    assert codes <= set(series)
    assert all(isinstance(pt[0], str) and isinstance(pt[1], float) for pt in series["PHE"][:3])
    assert len(series["PHE"]) >= 60
