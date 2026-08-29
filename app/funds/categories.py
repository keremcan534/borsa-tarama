"""Fon kategorileri: tek kaynak.

Kategori üç yerde gerekiyordu — Fon Ligi (arayüz), kategori kotası (tarama) ve
kategori SEO sayfaları — ve kural arayüzde ayrı, backend'de ayrı duruyordu
(`screen.py` içindeki para piyasası regex'i arayüzdekinin kopyasıydı). İkisi
ayrışırsa aynı fon iki yerde farklı kategoride görünür; bu yüzden kural burada
tek yerde durur, tarama sonuca `category` alanını yazar ve arayüz onu okur.

## Gümüş neden altından ayrı?

Kural eskiden `KIYMETLİ MADEN|ALTIN|GÜMÜŞ` idi, yani tek "Kıymetli Madenler"
ligi. Oysa TEFAS'ta 13 halka açık gümüş fonu var (GTZ 13,2 milyar TL / 62 bin
yatırımcı, YZG, GUM, IOG…) ve gümüş yatırımcısı altın fonlarının arasında
kendi ligini göremiyordu. Rakip sitelerin ayrı bir "gümüş fonları" sayfası
olmasının sebebi de bu: bu ayrı bir arama niyeti.

## Sıra ANLAMLIDIR

İlk eşleşen kural kazanır. "AK PORTFÖY GÜMÜŞ FON SEPETİ FONU" hem gümüş hem
fon sepeti; doğru cevap gümüştür — bu yüzden madenler sepet/serbest'ten ÖNCE
gelir. Aynı şekilde "GARANTİ PORTFÖY GÜMÜŞ KATILIM SERBEST FON" da gümüştür.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class FundCategory:
    key: str
    slug: str  # URL parçası (SEO sayfası): /fon-kategori/<slug>.html
    label: str
    label_en: str
    pattern: str
    # Kategoriyi arayan kişinin sorusu; SEO sayfasının açıklama cümlesi.
    blurb: str


# Sıra = eşleşme önceliği (yukarıdaki "Sıra ANLAMLIDIR" notu).
FUND_CATEGORIES: tuple[FundCategory, ...] = (
    FundCategory(
        "money", "para-piyasasi-fonlari", "Para Piyasası", "Money Market",
        r"PARA PIYASASI|LIKIT",
        "Kısa vadeli borçlanma araçlarında değerlenen, düşük oynaklıklı fonlar.",
    ),
    FundCategory(
        "silver", "gumus-fonlari", "Gümüş", "Silver",
        r"GUMUS",
        "Fiziki gümüş ve gümüşe dayalı araçlarda değerlenen fonlar.",
    ),
    FundCategory(
        "gold", "altin-fonlari", "Altın ve Kıymetli Maden", "Gold & Precious Metals",
        r"KIYMETLI MADEN|ALTIN",
        "Fiziki altın ve kıymetli madenlere dayalı araçlarda değerlenen fonlar.",
    ),
    FundCategory(
        "basket", "fon-sepeti-fonlari", "Fon Sepeti", "Fund Basket",
        r"FON SEPETI|SEPET FONU",
        "Portföyünü tek tek menkul kıymetler yerine başka fonlardan kuran fonlar.",
    ),
    FundCategory(
        "hedge", "serbest-fonlar", "Serbest", "Hedge",
        r"SERBEST",
        "Yatırım sınırları esnek, stratejisi serbest bırakılmış fonlar.",
    ),
    FundCategory(
        "foreign", "yabanci-eurobond-fonlari", "Yabancı ve Eurobond", "Foreign & Eurobond",
        r"EUROBOND|YABANCI|DOVIZ",
        "Yurt dışı varlıklara veya döviz cinsi borçlanma araçlarına yatırım yapan fonlar.",
    ),
    FundCategory(
        "participation", "katilim-fonlari", "Katılım", "Participation",
        r"KATILIM",
        "Faizsiz (katılım) esaslarına göre yönetilen fonlar.",
    ),
    FundCategory(
        "bond", "borclanma-araclari-fonlari", "Borçlanma Araçları", "Fixed Income",
        r"BORCLANMA ARACLARI|TAHVIL|BONO|BORCLANMA",
        "Devlet ve özel sektör tahvil/bonolarında değerlenen fonlar.",
    ),
    FundCategory(
        "index", "endeks-fonlari", "Endeks", "Index",
        r"ENDEKS",
        "Bir endeksi takip etmeyi hedefleyen pasif fonlar.",
    ),
    FundCategory(
        "equity", "hisse-senedi-fonlari", "Hisse Senedi", "Equity",
        r"HISSE SENEDI|HISSE",
        "Portföyünün ağırlığını hisse senedinde tutan fonlar.",
    ),
    FundCategory(
        "mixed", "karma-degisken-fonlari", "Karma ve Değişken", "Mixed & Variable",
        r"KARMA|DEGISKEN",
        "Varlık dağılımını piyasa koşullarına göre değiştirebilen fonlar.",
    ),
)

OTHER = FundCategory(
    "other", "diger-fonlar", "Diğer", "Other", r"", "Diğer kategorilere girmeyen fonlar."
)

# Ad ASCII'ye katlanıp kalıplar da ASCII yazılır. İki ayrı tuzağı birden kapatır:
# (1) i/I — TEFAS adları bazen "LİKİT" bazen "LIKIT"; ayrıca "hisse".upper()
# ASCII'de "HISSE", Türkçe kuralda "HİSSE" verir. (2) Türkçe karakteri hiç
# kullanmayan adlar ("DEGISKEN"), aksi halde hiçbir kurala uymayıp "diğer"e düşerdi.
_ASCII_FOLD = str.maketrans({
    "İ": "I", "ı": "I", "i": "I", "Ğ": "G", "ğ": "G", "Ş": "S", "ş": "S",
    "Ü": "U", "ü": "U", "Ö": "O", "ö": "O", "Ç": "C", "ç": "C",
})

_COMPILED = tuple((c, re.compile(c.pattern)) for c in FUND_CATEGORIES)
BY_KEY: dict[str, FundCategory] = {c.key: c for c in (*FUND_CATEGORIES, OTHER)}


def categorize(name: str | None) -> str:
    """Fon adından kategori anahtarı. Eşleşme yoksa 'other'."""
    upper = (name or "").translate(_ASCII_FOLD).upper()
    for category, pattern in _COMPILED:
        if pattern.search(upper):
            return category.key
    return OTHER.key
