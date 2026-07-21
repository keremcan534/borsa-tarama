from datetime import date, timedelta

from app.data.dividends import build_dividend_payload, summarize_dividends

TODAY = date(2026, 7, 20)


def _d(days_ago: int) -> str:
    return (TODAY - timedelta(days=days_ago)).strftime("%Y-%m-%d")


def test_ttm_yield_uses_only_last_12_months():
    """Verim, GERÇEKTEN son 12 ayda ödenen tutardan hesaplanır (daha eskisi sayılmaz)."""
    payments = [[_d(400), 5.0], [_d(200), 2.0], [_d(30), 3.0]]
    out = summarize_dividends(payments, close=100.0, today=TODAY)

    assert out["ttm"] == 5.0  # 400 gün önceki ödeme HARİÇ
    assert out["yield_ttm"] == 0.05
    assert out["last_date"] == _d(30)
    assert out["last_amount"] == 3.0


def test_no_dividends_and_no_upcoming_returns_none():
    """Temettü ödemeyen şirket takvimde hiç görünmemeli."""
    assert summarize_dividends([], close=100.0, today=TODAY) is None


def test_past_ex_date_is_not_reported_as_upcoming():
    """`.info`'daki ex-tarih geçmiş de olabilir; yalnızca ileri tarihli olan yaklaşandır."""
    past = summarize_dividends([[_d(10), 1.0]], 50.0, {"ex_date": _d(10)}, TODAY)
    assert past["next_ex_date"] is None

    soon = (TODAY + timedelta(days=12)).strftime("%Y-%m-%d")
    ahead = summarize_dividends([[_d(370), 1.0]], 50.0, {"ex_date": soon}, TODAY)
    assert ahead["next_ex_date"] == soon
    assert ahead["days_to_ex"] == 12


def test_old_payer_with_nothing_in_the_last_year_reports_no_ttm():
    """Yıllardır ödeme yapmamış şirkette "0,00 ödendi" yazmak yanlış: alan boş kalır."""
    out = summarize_dividends([[_d(800), 4.0]], close=50.0, today=TODAY)
    assert out is not None  # geçmişi var, takvimde kalır
    assert out["ttm"] is None
    assert out["yield_ttm"] is None


def test_far_future_ex_date_is_outside_the_window():
    far = (TODAY + timedelta(days=200)).strftime("%Y-%m-%d")
    out = summarize_dividends([[_d(30), 1.0]], 50.0, {"ex_date": far}, TODAY)
    assert out["next_ex_date"] is None


def test_upcoming_only_still_produces_an_entry():
    """Henüz ödeme geçmişi görünmese de yaklaşan tarih varsa hisse takvime girer."""
    soon = (TODAY + timedelta(days=5)).strftime("%Y-%m-%d")
    out = summarize_dividends([], 20.0, {"ex_date": soon}, TODAY)
    assert out is not None
    assert out["ttm"] is None and out["yield_ttm"] is None


def test_yield_is_none_without_a_valid_price():
    """Fiyat yoksa yüzde uydurulmaz."""
    out = summarize_dividends([[_d(10), 2.0]], close=0, today=TODAY)
    assert out["ttm"] == 2.0
    assert out["yield_ttm"] is None


def test_by_year_totals_and_years_paid():
    payments = [["2024-03-01", 1.0], ["2024-09-01", 2.0], ["2025-04-01", 4.0]]
    out = summarize_dividends(payments, 100.0, today=TODAY)
    assert out["by_year"] == {"2024": 3.0, "2025": 4.0}
    assert out["years_paid"] == 2


class FakeFetcher:
    def __init__(self, payments, info=None):
        self._payments = payments
        self._info = info or {}

    def fetch_dividends(self, symbol):
        return self._payments.get(symbol, [])

    def fetch_dividend_info(self, symbol):
        return self._info.get(symbol, {})


def test_payload_sorts_by_yield_and_drops_non_payers():
    rows = [
        {"symbol": "AAA.IS", "market": "bist100", "close": 100.0},
        {"symbol": "BBB.IS", "market": "bist100", "close": 100.0},
        {"symbol": "CCC.IS", "market": "bist100", "close": 100.0},
    ]
    fetcher = FakeFetcher(
        {
            "AAA.IS": [[_d(10), 2.0]],  # %2
            "BBB.IS": [[_d(10), 8.0]],  # %8
            "CCC.IS": [],  # temettü yok -> listeye girmemeli
        }
    )

    payload = build_dividend_payload(rows, fetcher, today=TODAY)

    assert [i["symbol"] for i in payload["items"]] == ["BBB.IS", "AAA.IS"]
    assert payload["count"] == 2
    assert payload["upcoming_count"] == 0


def test_payload_survives_a_failing_symbol():
    """Tek sembolün hatası tüm takvimi düşürmemeli."""

    class Broken(FakeFetcher):
        def fetch_dividends(self, symbol):
            if symbol == "BOOM.IS":
                raise RuntimeError("kaynak hatası")
            return super().fetch_dividends(symbol)

    rows = [
        {"symbol": "BOOM.IS", "market": "bist100", "close": 10.0},
        {"symbol": "OK.IS", "market": "bist100", "close": 10.0},
    ]
    payload = build_dividend_payload(rows, Broken({"OK.IS": [[_d(5), 1.0]]}), today=TODAY)

    assert [i["symbol"] for i in payload["items"]] == ["OK.IS"]
