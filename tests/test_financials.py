"""Çeyreklik finansal özet ayrıştırma ve türetilmiş alanlar.

Fixture Yahoo'nun gerçek `incomeStatementHistoryQuarterly` yanıtının yapısından
(THYAO.IS, 2026-08) kopyalandı: sayılar `{"raw": ..., "fmt": ...}` sarmalıyla gelir
ve çeyrekler YENİDEN ESKİYE sıralıdır.
"""

import pytest

from app.data.financials import parse_quarters, summarize


def _statement(period: str, revenue, net_income, gross=None, operating=None):
    def wrap(value):
        return None if value is None else {"raw": value, "fmt": str(value)}

    return {
        "endDate": {"fmt": period},
        "totalRevenue": wrap(revenue),
        "grossProfit": wrap(gross),
        "operatingIncome": wrap(operating),
        "ebit": wrap(operating),
        "netIncome": wrap(net_income),
    }


def _payload(statements):
    return {"incomeStatementHistoryQuarterly": {"incomeStatementHistory": statements}}


FOUR_QUARTERS = _payload(
    [
        _statement("2026-06-30", 400, 40, gross=100, operating=60),
        _statement("2026-03-31", 300, 30),
        _statement("2025-12-31", 200, -10),
        _statement("2025-09-30", 100, 10),
    ]
)


class TestParseQuarters:
    def test_orders_oldest_to_newest(self):
        """Yahoo yeniden eskiye döner; grafik ve 'önceki çeyreğe göre' kronolojik ister."""
        quarters = parse_quarters(FOUR_QUARTERS)
        assert [q["period"] for q in quarters] == [
            "2025-09-30",
            "2025-12-31",
            "2026-03-31",
            "2026-06-30",
        ]

    def test_unwraps_raw_values(self):
        assert parse_quarters(FOUR_QUARTERS)[-1]["revenue"] == 400

    def test_computes_margins(self):
        latest = parse_quarters(FOUR_QUARTERS)[-1]
        assert latest["gross_margin"] == pytest.approx(0.25)
        assert latest["operating_margin"] == pytest.approx(0.15)
        assert latest["net_margin"] == pytest.approx(0.10)

    def test_margin_is_none_when_revenue_is_missing_or_zero(self):
        quarters = parse_quarters(_payload([_statement("2026-06-30", 0, 40, gross=10)]))
        assert quarters[0]["gross_margin"] is None

    def test_entirely_empty_quarter_is_dropped(self):
        """Yalnızca dönem etiketi taşıyan çeyrek, veri varmış izlenimi verirdi."""
        quarters = parse_quarters(_payload([_statement("2026-06-30", None, None)]))
        assert quarters == []

    def test_missing_payload_yields_no_quarters(self):
        assert parse_quarters(None) == []
        assert parse_quarters({}) == []


class TestSummarize:
    def test_reports_latest_quarter(self):
        summary = summarize(parse_quarters(FOUR_QUARTERS))
        assert summary["period"] == "2026-06-30"
        assert summary["revenue"] == 400

    def test_quarter_over_quarter_change(self):
        summary = summarize(parse_quarters(FOUR_QUARTERS))
        # Payload alanları 4 haneye yuvarlanır (JSON boyutu 610 sembolde önemli)
        assert summary["revenue_change_qoq"] == pytest.approx((400 - 300) / 300, abs=1e-4)

    def test_change_from_loss_to_profit_keeps_direction(self):
        """Zarardan kâra geçişte negatif bölen işareti ters çevirirdi."""
        quarters = parse_quarters(
            _payload([_statement("2026-06-30", 200, 50), _statement("2026-03-31", 100, -50)])
        )
        assert summarize(quarters)["net_income_change_qoq"] == pytest.approx(2.0)

    def test_ttm_needs_four_complete_quarters(self):
        summary = summarize(parse_quarters(FOUR_QUARTERS))
        assert summary["ttm_revenue"] == 1000
        assert summary["ttm_net_income"] == 70

        three = summarize(
            parse_quarters(
                _payload(
                    [
                        _statement("2026-06-30", 400, 40),
                        _statement("2026-03-31", 300, 30),
                        _statement("2025-12-31", 200, 20),
                    ]
                )
            )
        )
        assert three["ttm_revenue"] is None  # 3 çeyrekle "son 12 ay" demek küçük gösterirdi

    def test_empty_input_yields_empty_summary(self):
        assert summarize([]) == {}


class TestZeroMeansMissing:
    """Yahoo raporlamadığı kalemi 0 döndürebiliyor (ölçüldü: THYAO'nun brüt kârı
    327 milyar TL satışa karşılık 0 geliyor). Bunu saklamak "brüt marj %0" yazdırır
    ve veri yokluğunu ölçülmüş bir gerçek gibi gösterirdi."""

    def test_zero_gross_profit_is_treated_as_missing(self):
        quarters = parse_quarters(_payload([_statement("2026-06-30", 1000, 50, gross=0)]))
        assert quarters[0]["gross_profit"] is None
        assert quarters[0]["gross_margin"] is None

    def test_zero_revenue_and_net_income_are_kept(self):
        """Satış/net kârda sıfır gerçek bir sonuç olabilir — silinmemeli."""
        quarters = parse_quarters(_payload([_statement("2026-06-30", 1000, 0, gross=200)]))
        assert quarters[0]["net_income"] == 0
        assert quarters[0]["net_margin"] == 0.0
