"""Fon kategorisi SEO sayfalarının testleri."""

import json

import pytest

from app.funds.categories import FUND_CATEGORIES
from app.reports.fund_category_pages import (
    MAX_ROWS,
    build_category_index,
    build_category_page,
    category_url,
)
from app.reports.generate import build_sitemap


def _fund(symbol="GTZ", **over):
    base = {
        "symbol": symbol,
        "name": "GARANTİ PORTFÖY GÜMÜŞ FON SEPETİ FONU",
        "category": "silver",
        "score": 67,
        "return_1y": 0.9287,
        "return_ytd": -0.008,
        "volatility": 0.55,
        "sharpe": 1.09,
        "portfolio_size": 13.2e9,
        "investor_count": 62478,
        "tefas_url": "https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod=GTZ",
    }
    base.update(over)
    return base


def test_page_contains_fund_row_and_metrics():
    html = build_category_page("silver", [_fund()], generated_at="2026-08-29T00:00:00")
    assert "GTZ" in html
    assert "GARANTİ PORTFÖY GÜMÜŞ FON SEPETİ FONU" in html
    assert "+92,9%" in html  # 1 yıllık getiri, Türkçe ondalık
    assert "13,2 mlr ₺" in html
    assert "62.478" in html  # yatırımcı sayısı binlik ayraçlı


def test_page_has_seo_essentials():
    html = build_category_page("silver", [_fund()])
    assert "<title>Gümüş Fonları" in html
    assert '<link rel="canonical" href="' + category_url("gumus-fonlari") in html
    assert 'name="description"' in html
    # Ölü uç olmasın: uygulamaya ve diğer kategorilere bağlantı
    assert "?v=funds" in html
    assert "altin-fonlari.html" in html
    # Sayfa tek başına dolaştığı için uyarı sayfanın kendisinde olmalı
    assert "yatırım tavsiyesi" in html


def test_missing_metrics_render_as_dash_not_zero():
    """Yeni fonda 1 yıllık getiri yok; "0,0%" yazmak ölçülmemiş bir sonuç uydururdu."""
    html = build_category_page("silver", [_fund(return_1y=None, sharpe=None, investor_count=None)])
    assert "—" in html
    assert "+0,0%" not in html


def test_row_count_is_capped_but_total_is_stated():
    funds = [_fund(symbol=f"F{i:03d}", score=90 - i) for i in range(MAX_ROWS + 20)]
    html = build_category_page("silver", funds)
    assert html.count("<tr>") == MAX_ROWS + 1  # +1 başlık satırı
    assert str(len(funds)) in html  # toplam sayı gizlenmez


def test_index_lists_only_categories_with_funds():
    html = build_category_index({"silver": 13, "gold": 42})
    assert "gumus-fonlari.html" in html
    assert "altin-fonlari.html" in html
    # Fonu olmayan kategori sayfası basılmadığı için dizinde de yer almamalı
    assert "hisse-senedi-fonlari.html" not in html


@pytest.mark.parametrize("category", [c.key for c in FUND_CATEGORIES])
def test_every_category_renders(category):
    html = build_category_page(category, [_fund(category=category)])
    assert "<h1>" in html and "</html>" in html


def test_sitemap_includes_category_pages_and_their_index():
    urls = [category_url("gumus-fonlari")]
    xml = build_sitemap(["2026-08-29"], [], urls)
    assert category_url("gumus-fonlari") in xml
    assert "fon-kategori/</loc>" in xml


def test_sitemap_omits_category_index_when_no_pages():
    """Var olmayan bir dizin URL'ini haritaya yazmak tarayıcıya 404 verdirir."""
    xml = build_sitemap(["2026-08-29"], [], [])
    assert "fon-kategori" not in xml


def test_manifest_shape_is_json_serialisable():
    payload = {"generated_at": "2026-08-29T00:00:00", "urls": [category_url("gumus-fonlari")]}
    assert json.loads(json.dumps(payload))["urls"][0].endswith("gumus-fonlari.html")
