"""Tahminin tarama çıktısına bağlanması.

Kritik davranış: kalite kapısını geçemeyen fona `next_day` alanı HİÇ
yazılmamalı. Boş/None yazılsaydı arayüz "tahmin var ama değeri yok" durumunu
ayrıca ele almak zorunda kalırdı; alanın yokluğu tek ve net sinyal.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.scan_to_json import attach_fund_forecasts

DAYS = [f"2026-{m:02d}-{d:02d}" for m in range(1, 13) for d in range(1, 26)][:300]


def _lcg(seed):
    state = seed
    while True:
        state = (1103515245 * state + 12345) % (2**31)
        yield state / (2**31) - 0.5


def _benchmarks():
    gen = _lcg(11)
    bist, gold, usd = [], [], []
    for d in DAYS:
        bist.append([d, 1000 * (1 + next(gen) * 0.02)])
        gold.append([d, 2000 * (1 + next(gen) * 0.01)])
        usd.append([d, 40 * (1 + next(gen) * 0.005)])
    return {
        "XU100.IS": {"name": "BIST 100", "points": bist},
        "GC=F": {"name": "Altın", "points": gold},
        "USDTRY=X": {"name": "USD/TRY", "points": usd},
    }


def _tracking_series(benchmarks, beta=1.0):
    """BİR ÖNCEKİ günün BIST hareketini beta katıyla yansıtan sentetik fon.

    Gecikme kasıtlı: TEFAS fiyatı bir gün geriden yayımlıyor, model tam da
    bunu arıyor. Aynı günü yansıtan bir seri kapıdan geçmez (ve geçmemeli).
    """
    bist = {d: p for d, p in benchmarks["XU100.IS"]["points"]}
    days = sorted(bist)
    bist_ret = {cur: bist[cur] / bist[prev] - 1 for prev, cur in zip(days, days[1:])}
    price, points = 100.0, [[days[1], 100.0]]
    for i in range(2, len(days)):
        price *= 1 + beta * bist_ret[days[i - 1]]
        points.append([days[i], price])
    return points


class TestAttachFundForecasts:
    def test_tracking_fund_gets_forecast(self):
        benchmarks = _benchmarks()
        results = [{"symbol": "AAA"}]
        series = {"AAA": _tracking_series(benchmarks)}
        made, as_of = attach_fund_forecasts(results, series, benchmarks)
        assert made == 1 and as_of
        forecast = results[0]["next_day"]
        assert forecast["driver"] == "bist"
        assert forecast["direction_rate"] >= 0.6
        assert forecast["as_of"] == as_of
        assert forecast["samples"] > 0

    def test_noise_fund_gets_no_field(self):
        benchmarks = _benchmarks()
        gen = _lcg(4242)
        price, points = 100.0, []
        for d in DAYS[1:]:
            price *= 1 + next(gen) * 0.03
            points.append([d, price])
        results = [{"symbol": "ZZZ"}]
        made, _ = attach_fund_forecasts(results, {"ZZZ": points}, benchmarks)
        assert made == 0
        assert "next_day" not in results[0]

    def test_missing_benchmark_disables_forecasts(self):
        benchmarks = _benchmarks()
        del benchmarks["GC=F"]
        results = [{"symbol": "AAA"}]
        made, as_of = attach_fund_forecasts(results, {"AAA": _tracking_series(_benchmarks())}, benchmarks)
        assert made == 0 and as_of is None
        assert "next_day" not in results[0]

    def test_fund_without_series_is_skipped(self):
        results = [{"symbol": "NOPE"}]
        made, _ = attach_fund_forecasts(results, {}, _benchmarks())
        assert made == 0
        assert "next_day" not in results[0]

    def test_values_are_json_safe(self):
        import json

        benchmarks = _benchmarks()
        results = [{"symbol": "AAA"}]
        attach_fund_forecasts(results, {"AAA": _tracking_series(benchmarks)}, benchmarks)
        # allow_nan=False: NaN sızarsa tarayıcıda TÜM dosya parse edilemez olurdu.
        json.dumps(results, allow_nan=False)
