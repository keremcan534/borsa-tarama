"""KAP şirket rehberi ayrıştırıcıları — logo boru hattının girdisi.

Bu üç fonksiyon 610 BIST sembolünün alan adını üretiyor; bir regex sessizce
kayarsa logo kapsamı fark edilmeden düşer (daha önce %14'e düşmüştü). Testler
kayıt sınırı kayması, Türkçe karakter ve çok adresli alanlar üzerine.
"""

from app.data.kap_companies import (
    domain_of,
    parse_company_oids,
    parse_company_website,
)

# KAP sayfasındaki gömülü JSON KAÇIŞLI gelir; testte de öyle olmalı.
EMBEDDED = (
    r'{\"mkkMemberOid\":\"4028e4a140f2ed720140f376bebb01a7\",'
    r'\"kapMemberTitle\":\"TÜRK HAVA YOLLARI A.O.\",'
    r'\"relatedMemberTitle\":\"PwC BAĞIMSIZ DENETİM A.Ş\",'
    r'\"stockCode\":\"THYAO\",\"cityName\":\"İSTANBUL\"},'
    r'{\"mkkMemberOid\":\"8acae2c469cee2a4016a77942be766cf\",'
    r'\"kapMemberTitle\":\"ALBARAKA TÜRK KATILIM BANKASI A.Ş.\",'
    r'\"stockCode\":\"ALBRK, ALK\",\"cityName\":\"İSTANBUL\"}'
)


class TestParseCompanyOids:
    def test_reads_code_to_oid(self):
        assert parse_company_oids(EMBEDDED)["THYAO"] == "4028e4a140f2ed720140f376bebb01a7"

    def test_multi_code_company_maps_every_code_to_same_oid(self):
        oids = parse_company_oids(EMBEDDED)
        assert oids["ALBRK"] == oids["ALK"] == "8acae2c469cee2a4016a77942be766cf"

    def test_ignores_invalid_codes(self):
        # 2 harflik ya da tireli kodlar BIST hisse kodu değil.
        html = r'{\"mkkMemberOid\":\"4028e4a140f2ed720140f376bebb01a7\",\"stockCode\":\"AB, X-Y\"}'
        assert parse_company_oids(html) == {}

    def test_empty_input(self):
        assert parse_company_oids("") == {}


class TestParseCompanyWebsite:
    def test_reads_internet_address_row(self):
        html = (
            '<div><h3 class="text-sm">İnternet Adresi</h3>'
            '<p class="text-text-color">www.turkishairlines.com</p></div>'
        )
        assert parse_company_website(html) == "www.turkishairlines.com"

    def test_strips_nested_markup(self):
        html = (
            '<h3>İnternet Adresi</h3><p><a href="#">www.aselsan.com</a><br>ek</p>'
        )
        assert parse_company_website(html) == "www.aselsan.com ek"

    def test_missing_row_returns_none(self):
        assert parse_company_website("<h3>Adres</h3><p>İstanbul</p>") is None


class TestDomainOf:
    def test_strips_scheme_www_and_path(self):
        assert domain_of("https://www.aselsan.com/tr") == "aselsan.com"

    def test_takes_first_of_multiple_addresses(self):
        # KAP bazı şirketlerde ana site + yatırımcı sitesini "/" ile ayırıp veriyor.
        value = "www.turkishairlines.com / http://investor.turkishairlines.com"
        assert domain_of(value) == "turkishairlines.com"

    def test_comma_separated(self):
        assert domain_of("koc.com.tr, kocholding.com.tr") == "koc.com.tr"

    def test_placeholder_values_are_not_domains(self):
        for value in ("-", "", "Yoktur", "bulunmamaktadır", None):
            assert domain_of(value) is None

    def test_keeps_subdomain_when_it_is_the_site(self):
        assert domain_of("https://yatirimci.sirket.com.tr/") == "yatirimci.sirket.com.tr"
