"""TEFAS portföy yönetim şirketlerinin logolarını indirir + manifest üretir.

`build_logos.py` (hisse) ile aynı felsefe ama farklı anahtar: bir fonun kendi
logosu yoktur, onu YÖNETEN portföy şirketinin logosu vardır. "PUSULA PORTFÖY
BİRİNCİ DEĞİŞKEN FON" ve "PUSULA PORTFÖY HİSSE FONU" ikisi de Pusula Portföy'ün
logosunu gösterir — tıpkı bir bankanın tüm fonlarının banka logosunu göstermesi gibi.

Bu yüzden manifest FON KODU değil ŞİRKET ÇEKİRDEĞİ (slug) ile anahtarlanır:
`{ "pusulaportfoy": "pusulaportfoy.png", ... }`. Arayüz fon adından şirketi çıkarıp
(bkz. frontend fundCompanySlug) bu slug ile logoya ulaşır. Böylece 120 fon için
yalnızca ~41 logo iner ve yeni bir fon eklendiğinde şirketi zaten biliniyorsa
otomatik logo alır.

Domain tahmini: TEFAS şirketleri neredeyse istisnasız `{çekirdek}.com.tr` ya da
`{çekirdek}.com` (ör. isportfoy.com.tr, teraportfoy.com). Çekirdek = şirket adının
Türkçe karakterleri sadeleştirilmiş, boşluksuz hali. Google favicon servisinden
(redirect takip edilir — kritik, yoksa 301 HTML gelir) indirilir.

    python scripts/build_fund_logos.py                 # canlı fon listesinden
    python scripts/build_fund_logos.py path/to/funds.json   # verilen listeden
    python scripts/build_fund_logos.py --force

Yeniden çalıştır: fon evreni yeni bir portföy şirketi getirince.
"""

import io
import json
import re
import sys
import time
import unicodedata
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

LOGOS_DIR = Path(__file__).resolve().parents[1] / "frontend" / "public" / "fund-logos"
MANIFEST_PATH = LOGOS_DIR / "index.json"

FAVICON_URL = "https://www.google.com/s2/favicons?domain={domain}&sz=128"
MIN_LOGO_BYTES = 70  # yalnızca boş/bozuk yanıtı eler (bkz. build_logos.py notu)

# Domaini tahmin kalıbına uymayan şirketler. Marka değişimi/satın alma yüzünden
# site adı şirket adından farklı olabiliyor (Garanti Portföy -> garantibbvaportfoy).
DOMAIN_OVERRIDES = {
    "garantiportfoy": "garantibbvaportfoy.com.tr",
}

# Fon adının başındaki "X PORTFÖY" kalıbı yönetim şirketini verir.
COMPANY_RE = re.compile(r"^(.*?PORTF[ÖO]Y)\b", re.IGNORECASE)


def company_of(fund_name: str) -> str | None:
    m = COMPANY_RE.match(fund_name or "")
    return m.group(1).strip() if m else None


def company_slug(name: str) -> str:
    """`İş Portföy` -> `isportfoy`. Türkçe karakterler sadeleşir, boşluk/simge atılır.

    Bu fonksiyonun AYNISI arayüzde de var (frontend fundCompanySlug); biri değişirse
    diğeri de değişmeli, yoksa fon logosu bulunamaz.
    """
    s = name
    for a, b in (("İ", "i"), ("I", "i"), ("ı", "i"), ("Ş", "s"), ("ş", "s"),
                 ("Ğ", "g"), ("ğ", "g"), ("Ü", "u"), ("ü", "u"),
                 ("Ö", "o"), ("ö", "o"), ("Ç", "c"), ("ç", "c")):
        s = s.replace(a, b)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", s.lower())


def load_fund_names(argv: list[str]) -> list[str]:
    """Fon adlarını verilen JSON'dan ya da canlı taramadan alır."""
    paths = [a for a in argv if not a.startswith("--")]
    if paths:
        data = json.loads(Path(paths[0]).read_text(encoding="utf-8"))
        return [f.get("name", "") for f in data.get("results", [])]
    # Argüman yoksa: fon tarayıcısını çalıştır (birkaç dk sürebilir, TEFAS rate-limit)
    from app.funds.screen import run_fund_screener

    results, _ = run_fund_screener(include_series=False)
    return [f.get("name", "") for f in results]


def download_logo(domain: str) -> bytes | None:
    try:
        resp = requests.get(FAVICON_URL.format(domain=domain), timeout=15)  # redirect takip edilir
    except Exception as e:
        print(f"[FON-LOGO] {domain}: indirilemedi ({e})")
        return None
    if resp.status_code != 200 or len(resp.content) < MIN_LOGO_BYTES:
        return None
    if not resp.headers.get("content-type", "").startswith("image/"):
        return None
    return resp.content


def normalize_png(raw: bytes) -> bytes | None:
    try:
        from PIL import Image
    except ImportError:
        return raw
    try:
        img = Image.open(io.BytesIO(raw)).convert("RGBA")
        if img.width > 128 or img.height > 128:
            img.thumbnail((128, 128), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    except Exception as e:
        print(f"[FON-LOGO] görsel işlenemedi ({e}); ham kaydediliyor")
        return raw


def main() -> None:
    force = "--force" in sys.argv
    LOGOS_DIR.mkdir(parents=True, exist_ok=True)

    manifest: dict[str, str] = {}
    if MANIFEST_PATH.exists():
        try:
            manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            manifest = {}

    names = load_fund_names(sys.argv[1:])
    # Şirket -> slug (aynı şirket 3-8 fonla tekrar eder; tek logo yeter)
    companies: dict[str, str] = {}
    for name in names:
        company = company_of(name)
        if company:
            companies[company_slug(company)] = company

    print(f"[FON-LOGO] {len(names)} fon -> {len(companies)} portföy şirketi")

    found = 0
    for slug, company in sorted(companies.items()):
        if not force and slug in manifest and (LOGOS_DIR / manifest[slug]).exists():
            found += 1
            continue

        raw = None
        used = None
        override = DOMAIN_OVERRIDES.get(slug)
        adaylar = [override] if override else [f"{slug}.com.tr", f"{slug}.com"]
        for domain in adaylar:
            raw = download_logo(domain)
            if raw is not None:
                used = domain
                break

        if raw is None:
            print(f"[FON-LOGO] {company}: logo bulunamadı ({slug}.com.tr/.com)")
            continue

        png = normalize_png(raw)
        if png is None:
            continue
        filename = f"{slug}.png"
        (LOGOS_DIR / filename).write_bytes(png)
        manifest[slug] = filename
        found += 1
        print(f"[FON-LOGO] {company} ({used}) -> {filename} ({len(png)} bayt)")
        time.sleep(0.2)

    manifest = {s: f for s, f in manifest.items() if (LOGOS_DIR / f).exists()}
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"[FON-LOGO] tamamlandı: {found}/{len(companies)} şirkette logo -> {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
