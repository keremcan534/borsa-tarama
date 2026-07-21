import numpy as np
import pandas as pd

from app.data.macro import (
    GRAMS_PER_OUNCE,
    _correlation,
    _gram_gold,
    _pct_change,
    _thin_series,
    _ytd_change,
    build_macro_payload,
)


def _series(values, start="2025-08-01"):
    idx = pd.date_range(start=start, periods=len(values), freq="D")
    return pd.Series(values, index=idx, dtype=float)


def test_pct_change_windows():
    s = _series([100.0, 110.0, 121.0])
    assert _pct_change(s, 1) == 0.1
    assert _pct_change(s, 2) == 0.21
    assert _pct_change(s, 5) is None  # yeterli geçmiş yok -> uydurulmaz


def test_ytd_uses_first_trading_day_of_the_current_year():
    idx = pd.to_datetime(["2025-12-30", "2026-01-05", "2026-03-01"])
    s = pd.Series([50.0, 100.0, 150.0], index=idx)
    # 2025'teki kapanış referans DEĞİL: yılın ilk işlem günü 2026-01-05.
    assert _ytd_change(s) == 0.5


def test_thin_series_keeps_the_last_point():
    s = _series(list(np.linspace(1, 500, 500)))
    points = _thin_series(s, max_points=50)
    assert len(points) <= 60
    assert points[-1][1] == round(float(s.iloc[-1]), 4)


def test_gram_gold_uses_only_common_dates():
    """Farklı tatil takvimleri: eksik gün doldurulmaz, kesişim alınır."""
    gold = _series([2000.0] * 40)
    fx = _series([40.0] * 40).iloc[5:]  # ilk 5 gün kur yok
    gram = _gram_gold(gold, fx)

    assert gram is not None
    assert len(gram) == 35
    assert round(float(gram.iloc[-1]), 2) == round(2000 * 40 / GRAMS_PER_OUNCE, 2)


def test_gram_gold_needs_enough_overlap():
    assert _gram_gold(_series([2000.0] * 10), _series([40.0] * 10)) is None


def test_correlation_is_computed_on_returns_not_levels():
    """İki yükselen seri seviyede ~1 korelasyon verir; getiri korelasyonu ayırt eder."""
    rng = np.random.default_rng(0)
    a_ret = rng.normal(0, 0.01, 200)
    b_ret = rng.normal(0, 0.01, 200)  # bağımsız
    a = _series(list(100 * np.cumprod(1 + a_ret) + np.arange(200)))
    b = _series(list(100 * np.cumprod(1 + b_ret) + np.arange(200)))

    level_corr = a.corr(b)  # ikisi de trendli -> yüksek
    ret_corr = _correlation(a, b)

    assert level_corr > 0.9
    assert abs(ret_corr) < 0.4


def test_correlation_returns_none_without_enough_overlap():
    assert _correlation(_series([1.0] * 10), _series([1.0] * 10)) is None


class FakeFetcher:
    """Her sembol için deterministik bir seri; bazıları bilerek hata verir."""

    def __init__(self, broken=(), short=()):
        self.broken = set(broken)
        self.short = set(short)
        self.calls = []

    def fetch_ohlcv(self, symbol, period="1y", interval="1d"):
        self.calls.append(symbol)
        if symbol in self.broken:
            raise RuntimeError("kaynak hatası")
        n = 10 if symbol in self.short else 300
        idx = pd.date_range(end="2026-07-20", periods=n, freq="D")
        return pd.DataFrame({"close": np.linspace(100, 200, n)}, index=idx)


def test_payload_skips_failing_and_short_instruments():
    fetcher = FakeFetcher(broken=["^VIX"], short=["BZ=F"])
    payload = build_macro_payload(fetcher)

    keys = {i["key"] for i in payload["items"]}
    assert "vix" not in keys  # çekilemedi
    assert "brent" not in keys  # yetersiz veri
    assert "usdtry" in keys and "xu100" in keys
    assert payload["count"] == len(payload["items"])


def test_payload_adds_derived_gram_gold_without_an_extra_request():
    fetcher = FakeFetcher()
    payload = build_macro_payload(fetcher)

    gram = next(i for i in payload["items"] if i["key"] == "gramgold")
    assert gram["derived"] is True
    # Gram altın türetilmiştir: kendi adına istek atılmaz.
    assert "GRAMALTIN" not in fetcher.calls


def test_bist_card_has_no_self_correlation():
    payload = build_macro_payload(FakeFetcher())
    bist = next(i for i in payload["items"] if i["key"] == "xu100")
    assert bist["corr_bist"] is None
