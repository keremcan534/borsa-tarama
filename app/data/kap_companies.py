"""KAP şirket rehberi — hisse kodu -> şirket web sitesi.

Neden gerekli: `scripts/build_logos.py` şirket alan adını yfinance `.info`
alanından çıkarıyordu. Bu iki nedenle BIST'te tıkandı — sembol başına ~1 sn +
rate-limit, ve Yahoo BIST şirketlerinin çoğu için `website` alanını hiç
doldurmuyor. Sonuç: 610 sembollük BIST evreninde yalnızca 83 logo (%14);
kullanıcının gördüğü "çoğu şirketin logosu yok" tablosu buydu.

KAP birincil kaynak: her şirketin "Genel Bilgiler" sayfasında **İnternet Adresi**
alanı var ve bu alan borsaya bildirilen resmî adres. Sayfa Next.js ile
render ediliyor; alan hem gömülü JSON'da hem düz HTML'de geçiyor, düz HTML'den
okumak daha dayanıklı.

İki aşama:
1. `https://www.kap.org.tr/tr/bist-sirketler` -> {hisse kodu: mkkMemberOid}
2. `https://www.kap.org.tr/tr/sirket-bilgileri/ozet/{oid}` -> İnternet Adresi

Buradaki fonksiyonlar SAF ayrıştırıcıdır (ağ yok) — HTTP tarafı
`scripts/build_company_domains.py` içinde, böylece ayrıştırma test edilebilir
kalır.
"""

import re

KAP_COMPANIES_PAGE = "https://www.kap.org.tr/tr/bist-sirketler"
KAP_COMPANY_SUMMARY = "https://www.kap.org.tr/tr/sirket-bilgileri/ozet/{oid}"

# Referer olmadan KAP istekleri cevapsız asılı kalıyor (bkz. app/data/kap.py).
KAP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (borsa-tarama company directory)",
    "Referer": "https://www.kap.org.tr/tr/bist-sirketler",
}

# Kayıtlar gömülü JSON'da KAÇIŞLI geliyor (\"stockCode\":\"THYAO\"), yani doğrudan
# json.loads edilemiyor. `mkkMemberOid` sınırından parçalayıp her parçadan tek oid +
# tek kod okuyoruz — tek regex'le ikisini birden yakalamak kayıt sınırını aşıp
# şirketleri kaydırabiliyor (bkz. scripts/build_bist_symbols.py'deki aynı not).
_RECORD_SPLIT_RE = re.compile(r'\\"mkkMemberOid\\":')
_OID_RE = re.compile(r'\\"([0-9a-fA-F]{16,})\\"')
_CODE_RE = re.compile(r'\\"stockCode\\":\\"(.*?)\\"')
_VALID_CODE = re.compile(r"^[A-Z0-9]{3,6}$")

# "İnternet Adresi" satırı: <h3 ...>İnternet Adresi</h3><p ...>www.thy.com / ...</p>
_WEBSITE_RE = re.compile(
    r"İnternet\s+Adresi\s*</h3>\s*<p[^>]*>(.*?)</p>", re.IGNORECASE | re.DOTALL
)

# Alan adı olmayan ya da logo aramaya değmeyecek yanıtlar ("-", "yoktur", boş).
_EMPTY_VALUES = {"", "-", "--", "yok", "yoktur", "bulunmamaktadir", "bulunmamaktadır"}


def parse_company_oids(html: str) -> dict[str, str]:
    """BIST şirketler sayfasından {hisse kodu: mkkMemberOid}.

    Çok kodlu şirketlerde (\"ALBRK, ALK\") her kod aynı oid'e bağlanır; hangisinin
    gerçekten hisse olduğunu sembol listesi zaten belirlemiş durumda.
    """
    out: dict[str, str] = {}
    for chunk in _RECORD_SPLIT_RE.split(html)[1:]:
        oid_match = _OID_RE.search(chunk)
        code_match = _CODE_RE.search(chunk)
        if not oid_match or not code_match:
            continue
        oid = oid_match.group(1)
        for code in re.split(r"[,\s]+", code_match.group(1)):
            code = code.strip().upper()
            if _VALID_CODE.match(code):
                out.setdefault(code, oid)
    return out


def parse_company_website(html: str) -> str | None:
    """Şirket özet sayfasından İnternet Adresi alanının ham metni."""
    match = _WEBSITE_RE.search(html)
    if not match:
        return None
    # Alan içinde <a>/<br> gibi etiketler geçebiliyor; düz metne indir.
    text = re.sub(r"<[^>]+>", " ", match.group(1))
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def domain_of(website: str | None) -> str | None:
    """`www.thy.com / http://investor.thy.com` -> `thy.com`.

    KAP alanı çoğu zaman tek adres taşır ama "/" veya "," ile ayrılmış birden çok
    adres de geliyor; ilki şirketin ana sitesi oluyor. Şema, `www.` ve yol atılır.
    """
    if not website:
        return None
    first = re.split(r"[\s,;|]|(?<![:/])/(?!/)", website.strip())
    for candidate in first:
        host = candidate.strip().strip(".").lower()
        if not host or host in _EMPTY_VALUES:
            continue
        host = host.split("//")[-1].split("/")[0].split("?")[0]
        if host.startswith("www."):
            host = host[4:]
        # En az bir nokta ve geçerli bir uzantı: "yoktur" gibi metinleri eler.
        if re.fullmatch(r"[a-z0-9.\-]+\.[a-z]{2,}", host):
            return host
    return None
