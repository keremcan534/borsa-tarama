"""Makro panelinin rate-limit dayanıklılığı.

Gerçek olay (2026-07-22): makro istekleri taramanın SONUNDA duruyordu; 600+
sembolden sonra yfinance rate-limit'e geçti ve 11 isteğin hepsi 429 aldı — panel
canlıda bomboş yayınlandı. İki savunma eklendi: istekler artık taramanın başında
atılıyor ve eksik kalan gösterge yayındaki son veriden `stale` işaretiyle
tamamlanıyor. Bu dosya ikinci savunmayı kilitler.
"""

from scripts.scan_to_json import merge_with_previous_macro

PREVIOUS = {
    "generated_at": "2026-07-21T22:00:00+00:00",
    "correlation_bars": 90,
    "items": [
        {"key": "usdtry", "last": 47.0, "change_1d": 0.001},
        {"key": "xu100", "last": 14000.0, "change_1d": 0.004},
        {"key": "btc", "last": 66000.0, "change_1d": -0.01},
    ],
}


def test_missing_instruments_are_filled_from_the_last_published_payload():
    fresh = {"count": 1, "correlation_bars": 90, "items": [{"key": "usdtry", "last": 47.2}]}

    merged = merge_with_previous_macro(fresh, PREVIOUS)

    keys = [i["key"] for i in merged["items"]]
    assert keys == ["usdtry", "xu100", "btc"]
    assert merged["count"] == 3


def test_filled_instruments_are_flagged_stale_with_their_date():
    """Eski veriyi etiketsiz göstermek, bugünün rakamı sanılmasına yol açardı."""
    merged = merge_with_previous_macro({"count": 0, "items": []}, PREVIOUS)

    for item in merged["items"]:
        assert item["stale"] is True
        assert item["as_of"] == PREVIOUS["generated_at"]


def test_fresh_data_always_wins_over_previous():
    fresh = {"count": 1, "items": [{"key": "usdtry", "last": 99.9}]}

    merged = merge_with_previous_macro(fresh, PREVIOUS)
    usdtry = next(i for i in merged["items"] if i["key"] == "usdtry")

    assert usdtry["last"] == 99.9
    assert "stale" not in usdtry  # taze veri eski diye işaretlenmemeli


def test_already_stale_entry_keeps_its_original_date():
    """İki koşu üst üste başarısız olursa tarih 'dünmüş gibi' kaymamalı."""
    previous = {
        "generated_at": "2026-07-22T06:00:00+00:00",
        "items": [{"key": "vix", "last": 17.0, "stale": True, "as_of": "2026-07-20T22:00:00+00:00"}],
    }

    merged = merge_with_previous_macro({"count": 0, "items": []}, previous)

    assert merged["items"][0]["as_of"] == "2026-07-20T22:00:00+00:00"


def test_without_a_previous_payload_fresh_is_returned_untouched():
    fresh = {"count": 1, "correlation_bars": 90, "items": [{"key": "usdtry", "last": 47.2}]}
    assert merge_with_previous_macro(fresh, {}) is fresh
