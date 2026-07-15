from app.reports.generate import build_archive_index, build_report_html, build_robots, build_sitemap
from app.screener.diff import mark_new_signals


def _payloads():
    return {
        "bist100": {
            "daily": {
                "count": 2,
                "scanned": 100,
                "results": [
                    {"symbol": "EREGL.IS", "close": 41.0, "rsi": 55.1, "macd_line": 0.5, "stoch_k": 40.0, "is_new": True},
                    {"symbol": "ASTOR.IS", "close": 318.0, "rsi": 54.6, "macd_line": 4.9, "stoch_k": 69.0, "is_new": False},
                ],
            },
            "weekly": {"count": 1, "results": [{"symbol": "TUPRS.IS", "is_new": False}]},
            "monthly": {"count": 0, "results": []},
        },
        "sp500": {
            "daily": {"count": 1, "scanned": 503, "results": [{"symbol": "JPM", "close": 342.0, "rsi": 59.4, "macd_line": 6.3, "stoch_k": 65.5, "is_new": False}]},
        },
    }


def test_report_html_contains_symbols_counts_and_new_badge():
    html = build_report_html("2026-07-15", _payloads())
    assert "15 Temmuz 2026" in html
    assert "EREGL" in html and "ASTOR" in html and "JPM" in html
    assert "TUPRS" in html  # haftalık liste
    assert "YENİ" in html  # is_new etiketi
    assert "yatırım tavsiyesi değildir" in html.lower()
    assert 'lang="tr"' in html
    assert "canonical" in html


def test_report_description_mentions_new_signals():
    html = build_report_html("2026-07-15", _payloads())
    assert "1 yeni: EREGL" in html


def test_archive_index_lists_dates_newest_first():
    html = build_archive_index(["2026-07-14", "2026-07-15"])
    assert html.index("2026-07-15") < html.index("2026-07-14")


def test_sitemap_and_robots():
    sitemap = build_sitemap(["2026-07-15"])
    assert "rapor/2026-07-15.html" in sitemap
    assert sitemap.startswith("<?xml")
    robots = build_robots()
    assert "Sitemap:" in robots


def test_mark_new_signals_flags_and_counts():
    stocks = [{"symbol": "A"}, {"symbol": "B"}, {"symbol": "C"}]
    count = mark_new_signals(stocks, previous_symbols={"A", "B"})
    assert count == 1
    assert [s["is_new"] for s in stocks] == [False, False, True]


def test_mark_new_signals_without_previous_marks_none():
    stocks = [{"symbol": "A"}]
    assert mark_new_signals(stocks, previous_symbols=None) == 0
    assert stocks[0]["is_new"] is False
