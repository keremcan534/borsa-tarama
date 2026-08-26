"""KAP bildirim ayrıştırma.

Ağa çıkmaz: `parse_disclosures` saf fonksiyondur, fixture KAP'ın gerçek yanıtından
(2026-08-26) alanları birebir kopyalanarak üretildi.
"""

from datetime import date
from unittest.mock import MagicMock

from app.data.kap import fetch_disclosures, parse_disclosures

# KAP'ın gerçek yanıtından alınmış kayıtlar (alan adları ve biçimleri birebir).
RAW = [
    {
        "publishDate": "26.08.2026 13:52:33",
        "fundCode": None,
        "kapTitle": "İŞ GAYRİMENKUL YATIRIM ORTAKLIĞI A.Ş.",
        "disclosureClass": "ODA",
        "disclosureCategory": "ODA",
        "summary": "Kredi Derecelendirme Notunun Teyidi",
        "subject": "Kredi Derecelendirmesi",
        "stockCodes": "ISGYO",
        "disclosureIndex": 1655070,
        "isLate": False,
    },
    {
        "publishDate": "26.08.2026 14:01:04",
        "kapTitle": "İNFO YATIRIM MENKUL DEĞERLER A.Ş.",
        "disclosureClass": "DG",
        "disclosureCategory": None,
        "summary": None,
        "subject": "İzahname-Sermaye Piyasası Aracı Notu",
        "stockCodes": "INFO, IYF",
        "disclosureIndex": 1655077,
        "isLate": True,
    },
    {
        # stockCodes boş: fon/ihraççı bildirimi, hisseye bağlanamaz
        "publishDate": "26.08.2026 09:10:00",
        "kapTitle": "BİR PORTFÖY YÖNETİMİ A.Ş.",
        "disclosureClass": "FR",
        "disclosureCategory": "FR",
        "summary": "Fon bildirimi",
        "subject": "Finansal Rapor",
        "stockCodes": None,
        "disclosureIndex": 1655001,
        "isLate": False,
    },
]


def test_rows_are_flattened_per_stock_code():
    """Tek bildirim iki koda aitse iki satır olur — arayüz hisse altında gösteriyor."""
    rows = parse_disclosures(RAW)
    symbols = [r["symbol"] for r in rows]
    assert symbols.count("INFO.IS") == 1
    assert symbols.count("IYF.IS") == 1
    assert "ISGYO.IS" in symbols


def test_disclosures_without_stock_code_are_dropped():
    rows = parse_disclosures(RAW)
    assert all(r["symbol"] for r in rows)
    assert not [r for r in rows if r["company"] == "BİR PORTFÖY YÖNETİMİ A.Ş."]


def test_symbol_filter_limits_to_scanned_universe():
    rows = parse_disclosures(RAW, symbols={"ISGYO.IS"})
    assert [r["symbol"] for r in rows] == ["ISGYO.IS"]


def test_publish_date_carries_turkish_offset():
    """KAP saati TR'dir ve dilim bilgisi taşımaz; naive bırakılsa yurt dışında kayardı."""
    rows = parse_disclosures(RAW, symbols={"ISGYO.IS"})
    assert rows[0]["published_at"] == "2026-08-26T13:52:33+03:00"


def test_rows_are_sorted_newest_first():
    rows = parse_disclosures(RAW)
    dates = [r["published_at"] for r in rows]
    assert dates == sorted(dates, reverse=True)


def test_link_points_to_permanent_kap_page():
    rows = parse_disclosures(RAW, symbols={"ISGYO.IS"})
    assert rows[0]["link"] == "https://www.kap.org.tr/tr/Bildirim/1655070"


def test_category_falls_back_to_class_when_category_is_null():
    """KAP kayıtlarının bir kısmında `disclosureCategory` boş geliyor (ölçüldü: 113/546).

    O durumda `disclosureClass` kullanılır; ikisi de tanınmıyorsa etiket None kalır
    ve arayüz rozetsiz gösterir — uydurma bir kategori atamaktan iyidir.
    """
    rows = parse_disclosures(RAW)
    isgyo = next(r for r in rows if r["symbol"] == "ISGYO.IS")
    info = next(r for r in rows if r["symbol"] == "INFO.IS")
    assert isgyo["category_label"] == "Özel Durum"
    assert info["category"] == "DG" and info["category_label"] == "Diğer"

    unknown = parse_disclosures([{**RAW[0], "disclosureCategory": "ZZZ", "disclosureClass": "ZZZ"}])
    assert unknown[0]["category_label"] is None


def test_is_late_flag_survives():
    rows = parse_disclosures(RAW, symbols={"INFO.IS"})
    assert rows[0]["is_late"] is True


def test_malformed_date_becomes_none_instead_of_raising():
    rows = parse_disclosures([{**RAW[0], "publishDate": "dün"}])
    assert rows[0]["published_at"] is None


def test_fetch_returns_empty_list_when_kap_is_down():
    """KAP çökerse tarama devam etmeli — haber toplama da böyle davranıyor."""
    session = MagicMock()
    session.post.side_effect = RuntimeError("bağlantı yok")
    assert fetch_disclosures(session=session) == []


def test_fetch_uses_requested_window():
    session = MagicMock()
    session.post.return_value = MagicMock(json=lambda: RAW, raise_for_status=lambda: None)

    rows = fetch_disclosures(session=session, window_days=3, today=date(2026, 8, 26))

    body = session.post.call_args.kwargs["json"]
    assert body["fromDate"] == "2026-08-23"
    assert body["toDate"] == "2026-08-26"
    assert body["mkkMemberOidList"] == [] and body["subjectList"] == []
    assert len(rows) == 3  # ISGYO + INFO + IYF (stockCodes'suz olan elendi)


def test_fetch_rejects_unexpected_payload_shape():
    session = MagicMock()
    session.post.return_value = MagicMock(json=lambda: {"error": "nope"}, raise_for_status=lambda: None)
    assert fetch_disclosures(session=session) == []
