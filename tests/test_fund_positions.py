from app.funds.positions import build_position_payload, normalize_month, normalize_symbol


def test_normalizers():
    assert normalize_symbol("thyao.e") == "THYAO"
    assert normalize_symbol(" GARAN.IS ") == "GARAN"
    assert normalize_month("2026-7-31") == "2026-07"


def test_build_position_payload_creates_reverse_index():
    records = [
        {
            "fund_code": "PHE",
            "fund_name": "Pusula",
            "symbol": "THYAO.E",
            "month": "2026-05",
            "weight": "4,10",
            "shares": "1.000.000",
        },
        {
            "fund_code": "PHE",
            "fund_name": "Pusula",
            "symbol": "THYAO",
            "month": "2026-06",
            "weight": 4.75,
            "shares": 1_250_000,
        },
        {
            "fund_code": "TLY",
            "symbol": "GARAN",
            "month": "2026-06",
            "weight": 2.5,
        },
    ]
    payload = build_position_payload(
        records,
        stock_names={"THYAO": "Türk Hava Yolları"},
        generated_at="2026-07-17T00:00:00+00:00",
    )

    assert payload["months"] == ["2026-05", "2026-06"]
    thy = payload["stocks"]["THYAO"]
    assert thy["name"] == "Türk Hava Yolları"
    assert thy["funds"][0]["fund_code"] == "PHE"
    assert thy["funds"][0]["positions"]["2026-06"]["weight"] == 4.75
    assert thy["funds"][0]["positions"]["2026-05"]["shares"] == 1_000_000


def test_build_position_payload_limits_to_latest_months():
    records = [
        {
            "fund_code": "AAA",
            "symbol": "THYAO",
            "month": f"2025-{month:02d}",
            "weight": month,
        }
        for month in range(1, 13)
    ]
    payload = build_position_payload(records, max_months=3)
    assert payload["months"] == ["2025-10", "2025-11", "2025-12"]
