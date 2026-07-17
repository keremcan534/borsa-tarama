from scripts.kap_fund_positions import (
    _disclosure_rank,
    _pick_pdr_attachment,
    parse_portfolio_text,
    pick_latest_disclosures,
)

SAMPLE_SECTION = """
HİSSE SENETLERİ
Hisse Türk
THYAO TÜRK HAVA YOLLARI A.O.
1.580,00 288,650646 07/01/26 304,000000 480.320,00 5,66 5,18 TL 80100511 5,20 TRATHYAO91M5
GARAN TÜRKİYE GARANTİ BANKASI A.Ş.
2.700,00 120,492593 17/11/25 161,300000 435.510,00 5,13 4,70 TL 80100517 4,72 TRAGARAN91N1
GRUP TOPLAMI
"""


def test_parse_portfolio_text_extracts_ftd_weight_and_shares():
    rows = parse_portfolio_text(SAMPLE_SECTION, "THD", "Test Fon", "2026-01")
    by_symbol = {row["symbol"]: row for row in rows}
    assert by_symbol["THYAO"]["weight"] == 5.2
    assert by_symbol["THYAO"]["shares"] == 1580.0
    assert by_symbol["GARAN"]["weight"] == 4.72


def test_pick_latest_disclosures_prefers_correction():
    rows = [
        {"fundCode": "PHE", "disclosureIndex": 100, "modifyStatus": None},
        {"fundCode": "PHE", "disclosureIndex": 99, "modifyStatus": "DUZELTILMIS"},
    ]
    picked = pick_latest_disclosures(rows, {"PHE"})
    assert picked["PHE"]["disclosureIndex"] == 99
    assert _disclosure_rank(picked["PHE"]) > _disclosure_rank(rows[0])


def test_pick_pdr_attachment_prefers_portfolio_pdf():
    attachments = [
        {"fileName": "risk_report.pdf", "fileExtension": "pdf"},
        {"fileName": "PHE_2026.06_portfoy_dagilim.pdf", "fileExtension": "pdf"},
    ]
    picked = _pick_pdr_attachment(attachments)
    assert picked["fileName"].startswith("PHE")
