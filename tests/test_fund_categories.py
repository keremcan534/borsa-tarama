"""Fon kategori kurallarının regresyon testleri.

Kural üç tüketiciyi birden besliyor (Fon Ligi, kategori SEO sayfaları, arayüz
filtresi); sessizce kayması aynı fonun iki yerde farklı kategoride görünmesi
demek. Buradaki örnekler gerçek TEFAS adlarından alınmıştır.
"""

import pytest

from app.funds.categories import BY_KEY, FUND_CATEGORIES, OTHER, categorize


@pytest.mark.parametrize(
    "name,expected",
    [
        # Gümüş, altından AYRI bir lig: TEFAS'ta 13 halka açık gümüş fonu var ve
        # gümüş yatırımcısı kendi ligini görebilmeli.
        ("AK PORTFÖY GÜMÜŞ FON SEPETI FONU", "silver"),
        ("İŞ PORTFÖY GÜMÜŞ SERBEST FON", "silver"),
        ("GARANTİ PORTFÖY GÜMÜŞ KATILIM SERBEST FON", "silver"),
        ("KUVEYT TÜRK PORTFÖY GÜMÜŞ KATILIM FON SEPETİ FONU", "silver"),
        ("AK PORTFÖY ALTIN FONU", "gold"),
        ("QNB PORTFÖY KIYMETLİ MADENLER FONU", "gold"),
        ("TERA PORTFÖY PARA PİYASASI (TL) FONU", "money"),
        ("PUSULA PORTFÖY HİSSE SENEDİ FONU", "equity"),
        ("YAPI KREDİ PORTFÖY BIST TEKNOLOJİ ENDEKSİ FONU", "index"),
        ("ATLAS PORTFÖY SERBEST FON", "hedge"),
        ("PARDUS PORTFÖY İKİNCİ DEĞİŞKEN FON", "mixed"),
        ("KUVEYT TÜRK PORTFÖY KATILIM FONU", "participation"),
        ("İŞ PORTFÖY EUROBOND BORÇLANMA ARAÇLARI FONU", "foreign"),
        ("AK PORTFÖY BORÇLANMA ARAÇLARI FONU", "bond"),
        ("ROTA PORTFÖY FON SEPETİ FONU", "basket"),
    ],
)
def test_categorize_real_fund_names(name, expected):
    assert categorize(name) == expected


@pytest.mark.parametrize(
    "name,expected",
    [
        # TEFAS adları çoğunlukla Türkçe karakterli geliyor ama ASCII'ye
        # düşürülmüş bir ad da doğru kategoriye oturmalı: aksi halde sessizce
        # "diğer"e düşer. ("hisse".upper() ASCII'de "HISSE", Türkçede "HİSSE".)
        ("AK PORTFOY GUMUS FON SEPETI FONU", "silver"),
        ("IS PORTFOY LIKIT FON", "money"),
        ("QNB PORTFOY DEGISKEN FON", "mixed"),
        ("AK PORTFOY HISSE SENEDI FONU", "equity"),
        ("AK PORTFOY BORCLANMA ARACLARI FONU", "bond"),
    ],
)
def test_categorize_is_insensitive_to_turkish_characters(name, expected):
    assert categorize(name) == expected


def test_metal_wins_over_wrapper_category():
    """Sıra anlamlıdır: "GÜMÜŞ FON SEPETİ" hem gümüş hem sepet; doğrusu gümüş."""
    assert categorize("AK PORTFÖY GÜMÜŞ FON SEPETİ FONU") == "silver"
    assert categorize("İŞ PORTFÖY ALTIN SERBEST FON") == "gold"


def test_unknown_name_falls_back_to_other():
    assert categorize("XYZ PORTFÖY BİLİNMEYEN FON") == OTHER.key
    assert categorize(None) == OTHER.key
    assert categorize("") == OTHER.key


def test_slugs_and_keys_are_unique():
    """Slug URL'e giriyor; çakışma iki kategorinin aynı sayfayı ezmesi demek."""
    cats = (*FUND_CATEGORIES, OTHER)
    assert len({c.key for c in cats}) == len(cats)
    assert len({c.slug for c in cats}) == len(cats)
    assert all(c.key in BY_KEY for c in cats)
