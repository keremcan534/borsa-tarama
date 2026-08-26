"""Endeks üyelik bayrakları."""

from app.data.indices import index_flags


def test_index_member_is_flagged():
    assert index_flags("THYAO.IS")["in_bist100"] is True


def test_non_member_bist_stock_gets_an_explicit_false():
    """Bayrağın hep var olması gerekiyor: "üye değil" ile "bilinmiyor" ayrı şeyler."""
    flags = index_flags("ACSEL.IS")
    assert "in_bist100" in flags
    assert flags["in_bist100"] is False


def test_non_bist_symbols_get_no_flag_at_all():
    """S&P/emtia sembolünde BIST 100 üyeliği anlamsız — alan hiç eklenmemeli."""
    assert index_flags("AAPL") == {}
    assert index_flags("GC=F") == {}
