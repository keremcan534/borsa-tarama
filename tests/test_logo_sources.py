"""Logo boru hattının ikinci kaynağı: şirketin kendi sayfasındaki ikon bağlantısı.

Google'ın favicon servisi BIST şirketlerinin bir kısmını (Koç Holding dahil)
tanımıyor. O durumda şirketin ana sayfasındaki <link rel="icon"> okunuyor.
Sıralama önemli: tabloda 26 pikselde net görünsün diye EN BÜYÜK ikon seçilmeli.
"""

import importlib.util
from pathlib import Path

_SPEC = importlib.util.spec_from_file_location(
    "build_logos", Path(__file__).resolve().parents[1] / "scripts" / "build_logos.py"
)
build_logos = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(build_logos)

icon_candidates = build_logos.icon_candidates
domain_of = build_logos.domain_of


class TestIconCandidates:
    def test_prefers_largest_declared_size(self):
        html = (
            '<link rel="icon" sizes="32x32" href="/small.png">'
            '<link rel="icon" sizes="192x192" href="/big.png">'
        )
        assert icon_candidates(html, "https://ex.com/")[0] == "https://ex.com/big.png"

    def test_apple_touch_icon_outranks_plain_favicon(self):
        # apple-touch-icon boyutsuz gelse de fiilen 180px'tir; 32'lik favicon'a yeğlenir.
        html = (
            '<link rel="shortcut icon" href="/favicon.ico">'
            '<link rel="apple-touch-icon" href="/touch.png">'
        )
        assert icon_candidates(html, "https://ex.com/") == [
            "https://ex.com/touch.png",
            "https://ex.com/favicon.ico",
        ]

    def test_resolves_relative_and_protocol_relative_urls(self):
        html = '<link rel="icon" href="assets/i.png">'
        assert icon_candidates(html, "https://ex.com/tr/") == ["https://ex.com/tr/assets/i.png"]

    def test_ignores_non_icon_links(self):
        html = '<link rel="stylesheet" href="/a.css"><link rel="canonical" href="/">'
        assert icon_candidates(html, "https://ex.com/") == []

    def test_link_without_href_is_skipped(self):
        assert icon_candidates('<link rel="icon">', "https://ex.com/") == []


class TestDomainOf:
    """build_logos kendi domain_of'unu yfinance `website` alanı için kullanıyor."""

    def test_strips_scheme_and_www(self):
        assert domain_of("https://www.apple.com/") == "apple.com"

    def test_none_website(self):
        assert domain_of(None) is None
