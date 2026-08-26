"""Hisse başına statik HTML sayfası.

Bu sayfalar sitenin arama motoru içerik eksenidir; testler iki şeyi kilitler:
(1) veri yokken uydurma içerik BASILMAZ, (2) sayfa tek başına ayakta durur
(başlık, canonical, uyarı, uygulamaya dönüş bağlantısı).
"""

from app.reports.generate import build_sitemap
from app.reports.symbol_pages import (
    build_symbol_index,
    build_symbol_page,
    symbol_slug,
    symbol_url,
)

STOCK = {
    "symbol": "THYAO.IS",
    "close": 300.0,
    "change": 0.021,
    "rsi": 55.4,
    "macd_line": 1.234,
    "stoch_k": 61.2,
    "stoch_rsi_k": 48.0,
    "ema_9": 295.0,
    "ema_21": 290.0,
    "ema_50": 280.0,
    "ema_200": 320.0,
    "market_cap": 414_000_000_000,
    "pe": 3.6,
    "pb": 1.2,
    "dividend_yield": 0.021,
    "roe": 0.18,
    "target_price": 463.54,
    "analyst_count": 13,
    "recommendation": "buy",
}


def test_slug_and_url():
    assert symbol_slug("THYAO.IS") == "THYAO"
    assert symbol_url("THYAO.IS").endswith("/hisse/THYAO.html")


class TestPageContent:
    def test_carries_code_name_and_price(self):
        html = build_symbol_page("THYAO.IS", STOCK, name="TÜRK HAVA YOLLARI A.O.")
        assert "THYAO" in html
        assert "TÜRK HAVA YOLLARI A.O." in html
        assert "300,00" in html

    def test_has_title_description_and_canonical(self):
        """Sayfa tek başına dolaşıyor: arama motorunun ihtiyacı olan üç şey."""
        html = build_symbol_page("THYAO.IS", STOCK)
        assert "<title>THYAO Hisse Analizi" in html
        assert '<meta name="description"' in html
        assert 'rel="canonical" href="https://' in html

    def test_states_it_is_not_investment_advice(self):
        html = build_symbol_page("THYAO.IS", STOCK)
        assert "yatırım tavsiyesi değildir" in html

    def test_links_back_into_the_app(self):
        """Sayfa bir açılış kapısıdır; ziyaretçiyi ölü uçta bırakmamalı."""
        html = build_symbol_page("THYAO.IS", STOCK)
        assert "v=screener&amp;s=THYAO.IS" in html

    def test_ema_position_is_stated_relative_to_price(self):
        html = build_symbol_page("THYAO.IS", STOCK)
        assert "EMA 9" in html and "fiyat üstünde" in html
        assert "fiyat altında" in html  # EMA200 fiyatın üstünde

    def test_analyst_upside_is_computed_from_current_price(self):
        html = build_symbol_page("THYAO.IS", STOCK)
        assert "463,54" in html
        assert "+54,5%" in html  # 463.54 / 300 - 1


class TestEmptyDataIsNotFaked:
    def test_blocks_without_data_are_omitted_entirely(self):
        """Boş bir "F/K: —" tablosu içerik varmış izlenimi verirdi."""
        bare = {"symbol": "XXXX.IS", "close": 10.0}
        html = build_symbol_page("XXXX.IS", bare)
        assert "Temel oranlar" not in html
        assert "Analist konsensüsü" not in html
        assert "Finansallar" not in html
        assert "Son KAP bildirimleri" not in html
        # Ama sayfa yine ayakta: başlık, fiyat, uyarı
        assert "XXXX" in html and "yatırım tavsiyesi değildir" in html

    def test_analyst_block_needs_a_price_to_compare_against(self):
        html = build_symbol_page("XXXX.IS", {"symbol": "XXXX.IS", "close": 0, "target_price": 5})
        assert "Analist konsensüsü" not in html

    def test_financials_block_appears_when_data_exists(self):
        html = build_symbol_page(
            "THYAO.IS",
            STOCK,
            financials={"period": "2026-06-30", "revenue": 327_108_000_000, "net_margin": 0.0274},
        )
        assert "Finansallar" in html
        assert "327,1 mlr" in html
        assert "yıllık karşılaştırma yapılamıyor" in html

    def test_kap_block_lists_recent_disclosures(self):
        html = build_symbol_page(
            "THYAO.IS",
            STOCK,
            kap_items=[
                {
                    "subject": "Özel Durum Açıklaması",
                    "link": "https://www.kap.org.tr/tr/Bildirim/1",
                    "published_at": "2026-08-26T13:52:33+03:00",
                }
            ],
        )
        assert "Son KAP bildirimleri" in html
        assert "Özel Durum Açıklaması" in html
        assert "2026-08-26" in html


class TestIndexAndSitemap:
    def test_index_lists_every_symbol(self):
        html = build_symbol_index([("THYAO.IS", "TÜRK HAVA YOLLARI"), ("ASELS.IS", None)])
        assert "THYAO.html" in html and "ASELS.html" in html
        assert "2 hisse" in html

    def test_sitemap_includes_symbol_pages(self):
        xml = build_sitemap(["2026-08-26"], [symbol_url("THYAO.IS")])
        assert "/hisse/THYAO.html" in xml
        assert "/hisse/</loc>" in xml  # dizin sayfası da haritada

    def test_sitemap_without_symbols_stays_valid(self):
        """Tarama henüz koşmamışsa harita eski haliyle üretilmeli, hiç yazılmamalı değil."""
        xml = build_sitemap(["2026-08-26"])
        assert "/rapor/2026-08-26.html" in xml
        assert "/hisse/" not in xml
