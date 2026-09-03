"""Fon ertesi-gün tahmini: model ve kalite kapısı.

Buradaki en kritik test `test_no_skill_fund_is_rejected`: modelin
açıklayamadığı bir fona tahmin BASILMAMALI. Kapı gevşerse site, yabancı ve
serbest fonlar için ölçülmemiş sayılar yayımlamaya başlar.
"""

import math

import pytest

from app.funds.forecast import (
    MIN_HISTORY,
    daily_returns,
    fit_forecast,
    latest_common_day,
)

DAYS = [f"2026-{m:02d}-{d:02d}" for m in range(1, 13) for d in range(1, 26)]


def _lcg(seed: int):
    """Deterministik sözde-rastgele: test sonucu koşudan koşuya değişmesin."""
    state = seed
    while True:
        state = (1103515245 * state + 12345) % (2**31)
        yield state / (2**31) - 0.5


def _factors(n=300, seed=7):
    gen = _lcg(seed)
    days = DAYS[:n]
    bist, gold, usd = {}, {}, {}
    for d in days:
        bist[d] = next(gen) * 0.04
        gold[d] = next(gen) * 0.02
        usd[d] = next(gen) * 0.01
    return days, {"bist": bist, "gold": gold, "usd": usd}


class TestDailyReturns:
    def test_consecutive_ratio(self):
        assert daily_returns({"2026-01-01": 100, "2026-01-02": 110})["2026-01-02"] == pytest.approx(0.1)

    def test_first_day_has_no_return(self):
        assert "2026-01-01" not in daily_returns({"2026-01-01": 100, "2026-01-02": 110})

    def test_zero_price_is_skipped(self):
        assert daily_returns({"2026-01-01": 0, "2026-01-02": 110}) == {}

    def test_accepts_point_pairs(self):
        assert daily_returns([("2026-01-01", 100), ("2026-01-02", 50)])["2026-01-02"] == pytest.approx(-0.5)


class TestLatestCommonDay:
    def test_uses_intersection_not_per_factor_max(self):
        # Kur serisi borsadan bir gün ileride bitiyor: tahmin iki farklı günün
        # hareketini karıştırmamalı.
        factors = {
            "bist": {"2026-01-01": 0.01, "2026-01-02": 0.02},
            "gold": {"2026-01-01": 0.01, "2026-01-02": 0.02},
            "usd": {"2026-01-01": 0.01, "2026-01-02": 0.02, "2026-01-03": 0.03},
        }
        assert latest_common_day(factors) == "2026-01-02"

    def test_no_overlap_returns_none(self):
        assert latest_common_day({"a": {"2026-01-01": 0.0}, "b": {"2026-02-01": 0.0}}) is None


class TestFitForecast:
    def test_short_history_is_rejected(self):
        days, factors = _factors(n=MIN_HISTORY - 20)
        fund = {d: 0.001 for d in days}
        assert fit_forecast(fund, factors) is None

    def test_no_skill_fund_is_rejected(self):
        """Faktörlerle ilgisiz gürültü -> tahmin yayımlanmamalı."""
        days, factors = _factors()
        noise = _lcg(99)
        fund = {d: next(noise) * 0.03 for d in days}
        assert fit_forecast(fund, factors) is None

    def test_recovers_known_sensitivity(self):
        """Fon = önceki günün BIST'inin 1,5 katı ise tahmin de o olmalı."""
        days, factors = _factors()
        fund = {cur: 1.5 * factors["bist"][prev] for prev, cur in zip(days, days[1:])}
        result = fit_forecast(fund, factors)
        assert result is not None
        as_of = latest_common_day(factors)
        assert result.change == pytest.approx(1.5 * factors["bist"][as_of], abs=1e-6)
        assert result.driver == "bist"
        assert result.as_of == as_of
        assert result.direction_rate > 0.95

    def test_constant_drift_is_attributed_to_carry(self):
        """Para piyasası fonu: getiri piyasadan değil birikimden gelir."""
        days, factors = _factors()
        fund = {d: 0.0022 for d in days[1:]}
        result = fit_forecast(fund, factors)
        assert result is not None
        assert result.driver == "birikim"
        assert result.change == pytest.approx(0.0022, abs=1e-5)

    def test_band_is_non_negative_and_finite(self):
        days, factors = _factors()
        fund = {cur: 0.8 * factors["gold"][prev] + 0.0005 for prev, cur in zip(days, days[1:])}
        result = fit_forecast(fund, factors)
        assert result is not None
        assert result.band >= 0 and math.isfinite(result.band)
        assert 0 <= result.direction_rate <= 1
        assert result.samples >= MIN_HISTORY

    def test_explicit_as_of_is_honoured(self):
        days, factors = _factors()
        fund = {cur: 1.0 * factors["bist"][prev] for prev, cur in zip(days, days[1:])}
        target = days[200]
        result = fit_forecast(fund, factors, as_of=target)
        assert result is not None
        assert result.as_of == target
        assert result.change == pytest.approx(factors["bist"][target], abs=1e-6)
