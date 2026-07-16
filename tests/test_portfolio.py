import pandas as pd

from app.backtest.engine import Benchmark
from app.backtest.portfolio import simulate, simulate_many


def _trade(symbol, entry, exit_, ret, horizon=20) -> dict:
    return {
        "symbol": symbol,
        "signal_date": entry,
        "entry_date": entry,
        "entry_price": 100.0,
        "returns": {str(horizon): ret},
        "exit_dates": {str(horizon): exit_},
        "benchmark_returns": {},
        "max_drawdown": 0.0,
    }


def test_single_trade_compounds_capital():
    # Tek slot, tek işlem: 1000 -> +%50 -> 1500
    trades = [_trade("A", "2024-01-01", "2024-02-01", 0.5)]
    result = simulate(trades, horizon=20, initial_capital=1000, max_positions=1)

    assert result["final_value"] == 1500.0
    assert result["total_return"] == 0.5
    assert result["trades_taken"] == 1
    assert result["signals_skipped"] == 0


def test_sequential_trades_compound():
    # Tek slot: 1000 -> +%10 -> 1100 -> +%10 -> 1210 (bileşik)
    trades = [
        _trade("A", "2024-01-01", "2024-02-01", 0.1),
        _trade("B", "2024-03-01", "2024-04-01", 0.1),
    ]
    result = simulate(trades, horizon=20, initial_capital=1000, max_positions=1)

    assert result["final_value"] == 1210.0
    assert result["trades_taken"] == 2


def test_signal_is_skipped_when_all_position_slots_are_full():
    # Tek slot ve ilk pozisyon hâlâ açıkken gelen sinyal alınamaz —
    # özet istatistiklerin aksine gerçek portföyün kapasitesi sınırlıdır.
    trades = [
        _trade("A", "2024-01-01", "2024-06-01", 0.1),
        _trade("B", "2024-02-01", "2024-03-01", 5.0),  # kaçırılan büyük kazanan
    ]
    result = simulate(trades, horizon=20, initial_capital=1000, max_positions=1)

    assert result["trades_taken"] == 1
    assert result["signals_skipped"] == 1
    assert result["final_value"] == 1100.0  # B'nin +%500'ü portföye girmedi


def test_capital_is_split_across_free_slots():
    # 2 slot, aynı anda 2 sinyal: her birine 500 gider.
    # A +%100 -> 1000, B -%100 -> 0  => toplam 1000 (başa baş)
    trades = [
        _trade("A", "2024-01-01", "2024-02-01", 1.0),
        _trade("B", "2024-01-01", "2024-02-01", -1.0),
    ]
    result = simulate(trades, horizon=20, initial_capital=1000, max_positions=2)

    assert result["trades_taken"] == 2
    assert result["final_value"] == 1000.0
    assert result["total_return"] == 0.0


def test_freed_slot_is_reused_after_position_closes():
    trades = [
        _trade("A", "2024-01-01", "2024-02-01", 0.0),
        _trade("B", "2024-03-01", "2024-04-01", 0.0),
        _trade("C", "2024-05-01", "2024-06-01", 0.0),
    ]
    result = simulate(trades, horizon=20, initial_capital=1000, max_positions=1)
    assert result["trades_taken"] == 3  # slot her kapanışta yeniden kullanılır
    assert result["signals_skipped"] == 0


def test_max_drawdown_is_measured_from_the_peak():
    # 1000 -> +%100 (2000, tepe) -> -%50 (1000) => tepeden düşüş -%50
    trades = [
        _trade("A", "2024-01-01", "2024-02-01", 1.0),
        _trade("B", "2024-03-01", "2024-04-01", -0.5),
    ]
    result = simulate(trades, horizon=20, initial_capital=1000, max_positions=1)
    assert result["max_drawdown"] == -0.5


def test_curve_dates_are_ordered_and_end_at_final_value():
    trades = [
        _trade("A", "2024-01-01", "2024-02-01", 0.1),
        _trade("B", "2024-03-01", "2024-04-01", 0.1),
    ]
    result = simulate(trades, horizon=20, initial_capital=1000, max_positions=1)
    dates = [p["date"] for p in result["curve"]]

    assert dates == sorted(dates)
    assert result["curve"][-1]["value"] == result["final_value"]


def test_trades_without_the_requested_horizon_are_ignored():
    trades = [_trade("A", "2024-01-01", "2024-02-01", 0.1, horizon=20)]
    assert simulate(trades, horizon=60) is None


def test_empty_trades_returns_none():
    assert simulate([], horizon=20) is None


def test_benchmark_buy_and_hold_is_computed_over_the_same_window():
    idx = pd.date_range("2024-01-01", periods=120, freq="D")
    # Endeks 100'den 200'e: al-tut 1000 -> 2000
    bench_df = pd.DataFrame({"close": [100 + i * 100 / 119 for i in range(120)]}, index=idx)
    trades = [_trade("A", "2024-01-01", "2024-04-29", 0.1)]

    result = simulate(trades, horizon=20, initial_capital=1000, max_positions=1, benchmark=Benchmark(bench_df))

    assert result["final_value"] == 1100.0  # strateji +%10
    assert result["benchmark_final_value"] == 2000.0  # endeks +%100
    # Karşılaştırma olmadan "1000 -> 1100" iyi görünürdü; endeks onu ikiye katlamış.
    assert result["benchmark_total_return"] > result["total_return"]


def test_no_benchmark_yields_no_benchmark_fields():
    trades = [_trade("A", "2024-01-01", "2024-02-01", 0.1)]
    result = simulate(trades, horizon=20, benchmark=Benchmark(None))
    assert "benchmark_final_value" not in result


def test_simulate_many_reports_the_spread_caused_by_which_signal_gets_picked():
    # Tek slot, aynı gün gelen iki sinyalden biri +%400 diğeri 0: hangisinin
    # seçildiğine göre sonuç 5000 ya da 1000. Tek koşu bu şansı gizler.
    trades = [
        _trade("A", "2024-01-01", "2024-02-01", 4.0),
        _trade("B", "2024-01-01", "2024-02-01", 0.0),
    ]
    result = simulate_many(trades, horizon=20, trials=20, initial_capital=1000, max_positions=1)
    dist = result["distribution"]

    assert dist["trials"] == 20
    assert dist["min_final_value"] == 1000.0
    assert dist["max_final_value"] == 5000.0
    assert dist["min_final_value"] < dist["median_final_value"] <= dist["max_final_value"]


def test_simulate_many_is_deterministic_for_a_given_seed():
    trades = [
        _trade("A", "2024-01-01", "2024-02-01", 4.0),
        _trade("B", "2024-01-01", "2024-02-01", 0.0),
    ]
    a = simulate_many(trades, horizon=20, trials=10, seed=7, max_positions=1)
    b = simulate_many(trades, horizon=20, trials=10, seed=7, max_positions=1)
    assert a["final_value"] == b["final_value"]


def test_simulate_many_counts_how_many_trials_beat_the_benchmark():
    idx = pd.date_range("2024-01-01", periods=60, freq="D")
    bench_df = pd.DataFrame({"close": [100.0] * 60}, index=idx)  # endeks yatay: al-tut 1000
    trades = [_trade("A", "2024-01-01", "2024-02-01", 0.5)]

    result = simulate_many(
        trades, horizon=20, trials=5, max_positions=1, benchmark=Benchmark(bench_df)
    )
    # her koşu 1500 > 1000: yön güvenilir
    assert result["distribution"]["beat_benchmark_trials"] == 5


def test_simulate_many_without_benchmark_reports_no_beat_count():
    trades = [_trade("A", "2024-01-01", "2024-02-01", 0.1)]
    result = simulate_many(trades, horizon=20, trials=3, max_positions=1)
    assert result["distribution"]["beat_benchmark_trials"] is None


def test_simulate_many_returns_none_when_no_usable_trades():
    assert simulate_many([], horizon=20) is None


def test_random_tie_break_can_change_the_outcome():
    import random as _random

    trades = [
        _trade("A", "2024-01-01", "2024-02-01", 4.0),
        _trade("B", "2024-01-01", "2024-02-01", 0.0),
    ]
    outcomes = {
        simulate(trades, 20, max_positions=1, rng=_random.Random(s))["final_value"] for s in range(20)
    }
    assert outcomes == {1000.0, 5000.0}  # seçim gerçekten sonucu değiştiriyor


def test_curve_is_thinned_for_json_size_but_keeps_the_last_point():
    trades = [
        _trade(f"S{i}", f"2024-01-01", f"2025-{(i % 12) + 1:02d}-01", 0.0) for i in range(600)
    ]
    result = simulate(trades, horizon=20, initial_capital=1000, max_positions=600)
    assert len(result["curve"]) <= 401
    assert result["curve"][-1]["value"] == result["final_value"]
