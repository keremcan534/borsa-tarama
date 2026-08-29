"""Fon taraması başarısız olduğunda yayındaki listenin korunması.

Yaşanmış olay (2026-08-29): TEFAS, GitHub runner'ından 6 denemenin altısında da
ReadTimeout verdi; tarama boş payload yazdı ve yayındaki fon listesi 0'a düştü.
Tek bir ağ hatasının siteden bir bölümü tümden silmemesi gerekir — makro
panelde `merge_with_previous_macro` ile çözülen sorunun fon karşılığı.
"""

import json

import pytest

from scripts.scan_to_json import write_fund_category_pages


def _fund(symbol, name, **over):
    base = {
        "symbol": symbol,
        "name": name,
        "score": 70,
        "return_1y": 0.9,
        "return_ytd": 0.02,
        "volatility": 0.5,
        "sharpe": 1.1,
        "portfolio_size": 1e9,
        "investor_count": 1000,
        "tefas_url": f"https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod={symbol}",
    }
    base.update(over)
    return base


def test_category_pages_written_for_each_populated_category(tmp_path):
    funds = [
        _fund("GTZ", "GARANTİ PORTFÖY GÜMÜŞ FON SEPETİ FONU", category="silver"),
        _fund("AKU", "AK PORTFÖY ALTIN FONU", category="gold"),
    ]
    write_fund_category_pages(tmp_path, funds, "2026-08-29T00:00:00+00:00")

    assert (tmp_path / "fon-kategori" / "gumus-fonlari.html").exists()
    assert (tmp_path / "fon-kategori" / "altin-fonlari.html").exists()
    # Fonu olmayan kategorinin sayfası hiç basılmaz
    assert not (tmp_path / "fon-kategori" / "hisse-senedi-fonlari.html").exists()

    manifest = json.loads((tmp_path / "fon-kategori" / "index.json").read_text())
    assert len(manifest["urls"]) == 2
    assert manifest["generated_at"] == "2026-08-29T00:00:00+00:00"


def test_category_derived_from_name_when_field_missing(tmp_path):
    """Kurtarılan eski liste `category` taşımayabilir; ad yedeği devreye girmeli."""
    funds = [_fund("GTZ", "GARANTİ PORTFÖY GÜMÜŞ FON SEPETİ FONU")]  # category YOK
    write_fund_category_pages(tmp_path, funds, "2026-08-29T00:00:00+00:00")

    page = tmp_path / "fon-kategori" / "gumus-fonlari.html"
    assert page.exists(), "kategori alanı yoksa ad üzerinden türetilmeliydi"
    assert "GTZ" in page.read_text(encoding="utf-8")


def test_empty_fund_list_writes_no_pages(tmp_path):
    """Fon yoksa boş kategori sayfası basmak "içerik var" yalanı olurdu."""
    write_fund_category_pages(tmp_path, [], "2026-08-29T00:00:00+00:00")
    assert not (tmp_path / "fon-kategori").exists()


@pytest.mark.parametrize("stale", [True, False])
def test_stale_flag_does_not_change_page_generation(tmp_path, stale):
    """Korunan liste de tam sayfa üretmeli: bayrak yalnızca arayüz içindir."""
    funds = [_fund("GTZ", "GARANTİ PORTFÖY GÜMÜŞ FON SEPETİ FONU", category="silver")]
    write_fund_category_pages(tmp_path, funds, "2026-08-28T00:00:00+00:00")
    assert (tmp_path / "fon-kategori" / "gumus-fonlari.html").exists()
