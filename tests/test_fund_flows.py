"""Fon para akışı (net TL giriş/çıkış).

Akışın tanımı "büyüklükteki değişimin fiyatla açıklanamayan kısmı" olduğundan
testlerin çoğu tam olarak bu ayrımı kilitler: fiyat hareketi akış SAYILMAZ.
"""

import pytest

from app.funds.flows import daily_flows, flow_summary, top_flows


def _history(rows: dict) -> dict:
    """{"2026-01-01": {"AFA": (büyüklük, fiyat)}} -> arşiv biçimi."""
    return {
        day: {code: {"size": size, "price": price} for code, (size, price) in funds.items()}
        for day, funds in rows.items()
    }


class TestDailyFlows:
    def test_price_move_alone_is_not_a_flow(self):
        """Fonu %10 yükselten piyasa günü, %10 para girişi gibi görünmemeli."""
        history = _history({"2026-01-01": {"AFA": (100, 1.0)}, "2026-01-02": {"AFA": (110, 1.1)}})
        flows = daily_flows(history, "AFA")
        assert flows[0]["flow"] == pytest.approx(0.0)
        assert flows[0]["pct"] == pytest.approx(0.0)

    def test_inflow_is_the_unexplained_growth(self):
        # Fiyat sabit, büyüklük 100 -> 120: net 20 giriş, dünkü büyüklüğün %20'si
        history = _history({"2026-01-01": {"AFA": (100, 1.0)}, "2026-01-02": {"AFA": (120, 1.0)}})
        flow = daily_flows(history, "AFA")[0]
        assert flow["flow"] == pytest.approx(20)
        assert flow["pct"] == pytest.approx(0.2)

    def test_outflow_is_negative(self):
        history = _history({"2026-01-01": {"AFA": (100, 1.0)}, "2026-01-02": {"AFA": (80, 1.0)}})
        assert daily_flows(history, "AFA")[0]["flow"] == pytest.approx(-20)

    def test_flow_is_measured_against_the_price_adjusted_base(self):
        # Fiyat %10 arttı ama büyüklük yalnızca %5: aslında para ÇIKMIŞ
        history = _history({"2026-01-01": {"AFA": (100, 1.0)}, "2026-01-02": {"AFA": (105, 1.1)}})
        flow = daily_flows(history, "AFA")[0]
        assert flow["flow"] == pytest.approx(-5)

    def test_each_flow_records_which_two_days_it_compares(self):
        """Tarama hafta sonu çalışmaz; araya gün girdiğinde akış o boşluğu kapsar."""
        history = _history({"2026-01-02": {"AFA": (100, 1.0)}, "2026-01-05": {"AFA": (130, 1.0)}})
        flow = daily_flows(history, "AFA")[0]
        assert flow["date"] == "2026-01-05"
        assert flow["from_date"] == "2026-01-02"

    def test_first_day_has_no_flow(self):
        history = _history({"2026-01-01": {"AFA": (100, 1.0)}})
        assert daily_flows(history, "AFA") == []

    def test_implausible_jump_is_dropped(self):
        """TEFAS bazen büyüklüğü sıfır/eksik yayımlıyor; onu '%100 çıktı' diye
        göstermek listenin tepesini çöple doldururdu."""
        history = _history({"2026-01-01": {"AFA": (100, 1.0)}, "2026-01-02": {"AFA": (100_000, 1.0)}})
        assert daily_flows(history, "AFA") == []

    def test_legacy_integer_records_are_skipped_not_zeroed(self):
        """Eski arşiv yalnızca yatırımcı sayısı taşıyordu; ondan akış ÇIKARILAMAZ."""
        history = {"2026-01-01": {"AFA": 4200}, "2026-01-02": {"AFA": {"size": 100, "price": 1.0}}}
        assert daily_flows(history, "AFA") == []

    def test_missing_price_breaks_the_chain_without_crashing(self):
        history = {
            "2026-01-01": {"AFA": {"size": 100, "price": 1.0}},
            "2026-01-02": {"AFA": {"size": 110, "price": None}},
            "2026-01-03": {"AFA": {"size": 120, "price": 1.0}},
        }
        flows = daily_flows(history, "AFA")
        # 01-02 zinciri kırar; 01-03 bir öncekiyle (01-02) kıyaslanamaz
        assert [f["date"] for f in flows] == []


class TestSummary:
    def test_total_percentage_uses_the_period_start_size(self):
        """Günlük yüzdeler farklı tabanlara göre; toplamları matematiksel olarak yanlış."""
        history = _history(
            {
                "2026-01-01": {"AFA": (100, 1.0)},
                "2026-01-02": {"AFA": (150, 1.0)},  # +50, dünkü büyüklüğün %50'si
                "2026-01-03": {"AFA": (200, 1.0)},  # +50, dünkü büyüklüğün %33'ü
            }
        )
        summary = flow_summary(history, "AFA", days=2)
        assert summary["total"] == pytest.approx(100)
        # Dönem başı 100 -> toplam %100. Günlük yüzdelerin toplamı (%83) DEĞİL.
        assert summary["total_pct"] == pytest.approx(1.0)

    def test_window_limits_the_days(self):
        history = _history({f"2026-01-{d:02d}": {"AFA": (100 + d, 1.0)} for d in range(1, 11)})
        assert len(flow_summary(history, "AFA", days=3)["days"]) == 3

    def test_none_when_no_flow_can_be_computed(self):
        assert flow_summary({}, "AFA") is None


class TestTopFlows:
    def test_ranked_by_absolute_lira_not_percentage(self):
        """Yüzde sıralaması küçük fonları tepeye taşır ve 'para nereye gitti?'
        sorusunu cevaplamaz."""
        history = _history(
            {
                "2026-01-01": {"BIG": (1_000_000, 1.0), "SMALL": (100, 1.0)},
                "2026-01-02": {"BIG": (1_050_000, 1.0), "SMALL": (150, 1.0)},
            }
        )
        ranked = top_flows(history, ["BIG", "SMALL"], days=1)
        assert [r["symbol"] for r in ranked] == ["BIG", "SMALL"]
        # Küçük fonun YÜZDESİ çok daha büyük — sıralama ona bakmıyor
        assert ranked[1]["total_pct"] > ranked[0]["total_pct"]

    def test_outflows_rank_alongside_inflows(self):
        history = _history(
            {
                "2026-01-01": {"IN": (1000, 1.0), "OUT": (1000, 1.0)},
                "2026-01-02": {"IN": (1100, 1.0), "OUT": (700, 1.0)},
            }
        )
        ranked = top_flows(history, ["IN", "OUT"], days=1)
        assert ranked[0]["symbol"] == "OUT"  # -300, mutlak değerce daha büyük
        assert ranked[0]["total"] < 0

    def test_limit_is_respected(self):
        history = _history(
            {
                "2026-01-01": {f"F{i}": (1000, 1.0) for i in range(20)},
                "2026-01-02": {f"F{i}": (1000 + i * 10, 1.0) for i in range(20)},
            }
        )
        assert len(top_flows(history, [f"F{i}" for i in range(20)], days=1, limit=5)) == 5
