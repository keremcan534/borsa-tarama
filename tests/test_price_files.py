import pytest

from app.data.price_files import assert_unique_file_names, price_file_name


def test_symbol_characters_that_are_illegal_in_file_names_are_replaced():
    assert price_file_name("THYAO.IS") == "THYAO_IS"
    assert price_file_name("GC=F") == "GC_F"
    assert price_file_name("^GSPC") == "_GSPC"
    assert price_file_name("BTC-USD") == "BTC-USD"  # tire güvenli, korunur
    assert price_file_name("AAPL") == "AAPL"


def test_real_symbol_set_produces_unique_names():
    """Üretimde kullanılan sembol biçimlerinin hiçbiri aynı dosyaya düşmemeli."""
    assert_unique_file_names(
        ["THYAO.IS", "XU100.IS", "AAPL", "BRK-B", "GC=F", "BTC-USD", "^GSPC", "^VIX"]
    )


def test_collision_raises_instead_of_silently_overwriting():
    """İki sembol aynı dosyaya düşerse bir hissenin grafiğinde BAŞKA bir hissenin
    fiyatı görünürdü; bu sessiz hata yerine tarama patlamalı."""
    with pytest.raises(ValueError, match="çakışması"):
        assert_unique_file_names(["A.B", "A=B"])


def test_same_symbol_twice_is_not_a_collision():
    assert_unique_file_names(["THYAO.IS", "THYAO.IS"])
