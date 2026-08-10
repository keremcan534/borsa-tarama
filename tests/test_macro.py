from scripts.scan_to_json import GRAM_PER_OUNCE, build_macro_payload


def _bm(points):
    return {"points": points}


def _sample():
    return {
        "USDTRY=X": _bm([["2026-07-16", 41.20], ["2026-07-17", 41.55]]),
        "EURTRY=X": _bm([["2026-07-16", 48.10], ["2026-07-17", 48.02]]),
        "GC=F": _bm([["2026-07-16", 3320.0], ["2026-07-17", 3355.5]]),
    }


def _by_key(payload):
    return {item["key"]: item for item in payload["items"]}


def test_macro_reports_value_and_daily_change():
    items = _by_key(build_macro_payload(_sample()))

    assert items["USDTRY"]["value"] == 41.55
    assert items["USDTRY"]["change"] == round(41.55 / 41.20 - 1, 6)
    # Düşen kur negatif değişim vermeli (işaret karışmasın)
    assert items["EURTRY"]["change"] < 0


def test_gram_gold_is_derived_from_ounce_and_usdtry():
    """Gram altının piyasada doğrudan sembolü yok; ons x kur / 31.1 ile türetilir."""
    items = _by_key(build_macro_payload(_sample()))

    expected = 3355.5 * 41.55 / GRAM_PER_OUNCE
    assert items["XAUTRY"]["value"] == round(expected, 4)
    # Kur ve ons birlikte yükseldiyse gram altın ikisinden de fazla artar
    assert items["XAUTRY"]["change"] > items["XAUUSD"]["change"]


def test_indexes_are_excluded_from_the_strip():
    """BIST/S&P "Piyasa nabzı" kartlarında; şeritte tekrar etmemeli."""
    benchmarks = _sample()
    benchmarks["XU100.IS"] = _bm([["2026-07-16", 10250.0], ["2026-07-17", 10410.5]])

    keys = _by_key(build_macro_payload(benchmarks))

    assert "XU100" not in keys
    assert set(keys) == {"USDTRY", "EURTRY", "XAUTRY", "XAUUSD"}


def test_missing_or_short_series_are_skipped_not_crashed():
    # Hiç veri yok
    assert build_macro_payload({})["items"] == []
    # Tek noktalı seri değişim hesaplayamaz -> atlanır
    assert build_macro_payload({"USDTRY=X": _bm([["2026-07-17", 41.55]])})["items"] == []
    # Kur yoksa gram altın üretilemez ama ons altın yine gelir
    keys = _by_key(build_macro_payload({"GC=F": _sample()["GC=F"]}))
    assert "XAUTRY" not in keys
    assert "XAUUSD" in keys


def test_nonpositive_prices_are_rejected():
    """Bozuk veride 0/negatif fiyat, sonsuz veya saçma yüzdeye dönüşmemeli."""
    payload = build_macro_payload({"USDTRY=X": _bm([["2026-07-16", 0.0], ["2026-07-17", 41.55]])})

    assert payload["items"] == []
