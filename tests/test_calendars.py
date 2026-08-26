"""Ekonomik takvim."""

from datetime import date

from app.data.calendars import build_calendar_payload, load_events, upcoming_events


def test_shipped_calendar_has_both_regions():
    events = load_events()["events"]
    assert any(e["region"] == "tr" for e in events)
    assert any(e["region"] == "us" for e in events)


def test_every_shipped_event_has_a_parseable_date_and_title():
    """Bozuk bir kayıt sessizce elenir; dosyada hiç bulunmaması gerekiyor."""
    for event in load_events()["events"]:
        assert date.fromisoformat(event["date"])
        assert event["title"] and event["title_en"]
        assert event["kind"] in {"rate", "report"}


def test_sources_are_recorded():
    """Kullanıcı tarihi doğrulamak isterse bizim sayfamıza değil kaynağa gitmeli."""
    sources = load_events()["sources"]
    assert "tcmb.gov.tr" in sources["tcmb_ppk"]
    assert "federalreserve.gov" in sources["fomc"]


class TestUpcoming:
    def test_past_events_are_dropped(self):
        events = upcoming_events(today=date(2026, 8, 26))
        assert all(e["date"] >= "2026-08-26" for e in events)
        assert not any(e["date"] == "2026-07-23" for e in events)

    def test_sorted_and_carries_days_until(self):
        events = upcoming_events(today=date(2026, 8, 26))
        assert [e["date"] for e in events] == sorted(e["date"] for e in events)
        first = events[0]
        assert first["days_until"] == (date.fromisoformat(first["date"]) - date(2026, 8, 26)).days

    def test_next_tr_rate_decision_after_august_is_september(self):
        events = upcoming_events(today=date(2026, 8, 26))
        tr_rates = [e for e in events if e["region"] == "tr" and e["kind"] == "rate"]
        assert tr_rates[0]["date"] == "2026-09-10"

    def test_window_limits_how_far_ahead_we_look(self):
        events = upcoming_events(today=date(2026, 8, 26), window_days=30)
        assert all(e["days_until"] <= 30 for e in events)

    def test_limit_is_respected(self):
        assert len(upcoming_events(today=date(2026, 8, 26), limit=3)) == 3


def test_payload_shape():
    payload = build_calendar_payload(today=date(2026, 8, 26))
    assert payload["count"] == len(payload["events"])
    assert payload["sources"]
    assert payload["updated"]
