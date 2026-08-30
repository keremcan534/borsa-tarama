"""Şirket logolarını indirir (`frontend/public/logos/`) + manifest üretir.

Neden ayrı bir script ve statik dosya — `build_sectors.py` ile aynı gerekçe:
logo, şirketin `website` alanından türetiliyor (yfinance `.info`), bu da sembol
başına ~0,5 sn + rate-limit riski. Bir şirketin logosu neredeyse hiç değişmez;
bir kez indirilip repoya konur, ÇALIŞMA ANINDA sıfır harici istek olur (hız +
kullanıcı gizliliği: kimse "hangi hisseye baktığını" üçüncü bir sunucuya sızdırmaz).

Kaynak: Google'ın favicon servisi (`s2/favicons?domain=...&sz=128`). Fizibilite
test edildi — BIST ve ABD şirketlerinin çoğu için gerçek logo dönüyor; bilinmeyen
alan adı 404 veriyor (yani tespit edilebilir, çöp görsel kaydedilmez).

## Alan adı nereden geliyor

BIST'te **KAP** birincil kaynak: `app/data/company_domains.json` (bkz.
`scripts/build_company_domains.py`) borsaya bildirilen resmî İnternet Adresi'ni
taşır. Önce bu okunur, yalnızca orada olmayan sembol için yfinance `.info`
alanına düşülür. Bunun sebebi ölçülmüş bir eksiklikti: yfinance BIST
şirketlerinin çoğunda `website` alanını hiç doldurmuyor ve 610 sembollük evrende
yalnızca 83 logo (%14) üretilebilmişti — kullanıcının gördüğü "çoğu şirketin
logosu yok" tablosu buydu. KAP 610 sembolün 588'i için alan adı veriyor.

## Logo iki kaynaktan

Önce Google favicon servisi. Google bazı gerçek şirketleri (Koç Holding dahil)
hiç tanımadığından, boş dönen alan adları için şirketin KENDİ ana sayfasındaki
`<link rel="icon">` / `apple-touch-icon` okunur; bu ikinci geçiş Google'ın
boş bıraktığı 110 BIST şirketinin ~%40'ını kurtarıyor.

Logosu bulunamayan sembol manifestte yer almaz; arayüz o sembol için nötr harf
rozetine düşer (mevcut TickerLogo davranışı).

    python scripts/build_logos.py                 # tüm hisse marketleri, eksikleri tamamlar
    python scripts/build_logos.py bist            # yalnızca BIST
    python scripts/build_logos.py --force         # hepsini yeniden indirir

Yeniden çalıştırmak gerekir: sembol listeleri endeks revizyonuyla değişince.
"""

import io
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

import requests
import yfinance as yf

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.data.markets import MARKET_FILES, SYMBOLS_DIR
from app.data.price_files import price_file_name

ROOT = Path(__file__).resolve().parents[1]
LOGOS_DIR = ROOT / "frontend" / "public" / "logos"
MANIFEST_PATH = LOGOS_DIR / "index.json"
DOMAINS_PATH = ROOT / "app" / "data" / "company_domains.json"

# Google favicon servisi; sz=128 makul çözünürlük (tabloda 26px, retina için yeter).
FAVICON_URL = "https://www.google.com/s2/favicons?domain={domain}&sz=128"

# Gerçek ayraç HTTP DURUM KODUdur: Google bilinmeyen alan adına 404 döner, bilinene
# 200 + görsel. İlk sürümde ek olarak bir byte eşiği vardı ama YANLIŞTI — Tüpraş gibi
# yalnızca küçük (16x16, ~230 bayt) faviconu olan şirketlerin geçerli logosunu eliyordu
# (100 sembolde 48'i boşuna atlanmış). Bu eşik yalnızca tamamen boş/bozuk yanıtı eler.
MIN_LOGO_BYTES = 70

# Google'ın bilmediği alan adları için ikinci kaynak: şirketin kendi sayfasındaki
# <link rel="icon"> / apple-touch-icon. Ölçüldü — Google'ın boş döndüğü 110 BIST
# şirketinin ~%40'ında (Koç Holding dahil) bu yolla gerçek logo geliyor.
# Bazı siteler "bot" görünen isteklere 403 verdiğinden gerçekçi bir tarayıcı
# User-Agent'ı gerekiyor.
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}
_LINK_TAG_RE = re.compile(r"<link\b[^>]*>", re.I)
_REL_RE = re.compile(r"rel\s*=\s*[\"\']([^\"\']+)", re.I)
_HREF_RE = re.compile(r"href\s*=\s*[\"\']([^\"\']+)", re.I)
_SIZES_RE = re.compile(r"sizes\s*=\s*[\"\']?(\d+)", re.I)
# Ana sayfadan en fazla bu kadar ikon adayı denenir (en büyükten küçüğe).
MAX_ICON_CANDIDATES = 3

# Yalnızca hisse marketleri: emtia/kripto/ETF'nin şirket web sitesi yok.
# "bist" borsanın tamamı (610); "bist100" onun alt kümesi olduğundan ayrıca
# taranmasına gerek yok — tarama zaten "bist" listesiyle çalışıyor.
LOGO_MARKETS = ("bist", "sp500")


def load_known_domains() -> dict[str, str]:
    """KAP'tan toplanmış {sembol: alan adı} eşlemesi; dosya yoksa boş."""
    if not DOMAINS_PATH.exists():
        return {}
    try:
        return json.loads(DOMAINS_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def domain_of(website: str | None) -> str | None:
    """`https://www.aselsan.com/tr` -> `aselsan.com` (şema, www ve yol atılır)."""
    if not website:
        return None
    host = website.split("//")[-1].split("/")[0].strip().lower()
    if host.startswith("www."):
        host = host[4:]
    return host or None


def fetch_website(symbol: str) -> str | None:
    try:
        info = yf.Ticker(symbol).info or {}
    except Exception as e:
        print(f"[LOGO] {symbol}: .info alınamadı ({e})")
        return None
    return info.get("website")


def download_logo(domain: str) -> bytes | None:
    """Alan adının logosunu indirir; gerçek bir görsel değilse None."""
    try:
        resp = requests.get(FAVICON_URL.format(domain=domain), timeout=15)
    except Exception as e:
        print(f"[LOGO] {domain}: indirilemedi ({e})")
        return None
    # 404'te Google 16x16 jenerik ikon döndürür; boyut eşiği bunu eler.
    if resp.status_code != 200 or len(resp.content) < MIN_LOGO_BYTES:
        return None
    if not resp.headers.get("content-type", "").startswith("image/"):
        return None
    return resp.content


def icon_candidates(html: str, base_url: str) -> list[str]:
    """Sayfadaki ikon bağlantıları, BÜYÜKTEN küçüğe (tablo 26px'te net görünsün).

    `sizes` verilmemişse apple-touch-icon 180 sayılır (fiilî standart boyut),
    diğerleri 32 — yani boyutu bilinmeyen apple ikonu klasik favicon'a yeğlenir.
    """
    found: list[tuple[int, str]] = []
    for tag in _LINK_TAG_RE.findall(html):
        rel = _REL_RE.search(tag)
        href = _HREF_RE.search(tag)
        if not rel or not href or "icon" not in rel.group(1).lower():
            continue
        sizes = _SIZES_RE.search(tag)
        size = int(sizes.group(1)) if sizes else (180 if "apple" in rel.group(1).lower() else 32)
        found.append((size, urljoin(base_url, href.group(1))))
    found.sort(key=lambda item: -item[0])
    return [url for _, url in found]


def download_site_icon(domain: str) -> bytes | None:
    """Şirketin kendi sayfasındaki ikonu indirir (Google boş dönerse ikinci şans)."""
    for base in (f"https://www.{domain}/", f"https://{domain}/"):
        try:
            page = requests.get(base, headers=BROWSER_HEADERS, timeout=15)
        except Exception:
            continue
        if page.status_code != 200:
            continue
        for url in icon_candidates(page.text, page.url)[:MAX_ICON_CANDIDATES]:
            try:
                resp = requests.get(url, headers=BROWSER_HEADERS, timeout=15)
            except Exception:
                continue
            if (
                resp.status_code == 200
                and len(resp.content) >= MIN_LOGO_BYTES
                and resp.headers.get("content-type", "").startswith("image/")
            ):
                return resp.content
        return None
    return None


def normalize_png(raw: bytes) -> bytes | None:
    """Görseli 128x128 PNG'ye çevirir (JPEG/ICO da gelebiliyor). Pillow yoksa ham bırakır."""
    try:
        from PIL import Image
    except ImportError:
        return raw  # Pillow yoksa olduğu gibi kaydet (favicon zaten çoğu zaman PNG)
    try:
        img = Image.open(io.BytesIO(raw)).convert("RGBA")
        if img.width > 128 or img.height > 128:
            img.thumbnail((128, 128), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    except Exception as e:
        print(f"[LOGO] görsel işlenemedi ({e}); ham kaydediliyor")
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

    # Komut satırında market adı verilmişse yalnızca onu işle (bist100 gibi).
    arg_markets = [a for a in sys.argv[1:] if not a.startswith("--")]
    markets = [m for m in arg_markets if m in LOGO_MARKETS] or list(LOGO_MARKETS)

    symbols: list[str] = []
    seen: set[str] = set()
    for market in markets:
        filename = MARKET_FILES.get(market)
        if not filename:
            continue
        path = SYMBOLS_DIR / filename
        if not path.exists():
            continue
        for symbol in json.loads(path.read_text(encoding="utf-8")):
            # bist100, bist'in alt kümesi: aynı sembolü iki kez indirmeye çalışma.
            if symbol not in seen:
                seen.add(symbol)
                symbols.append(symbol)

    known_domains = load_known_domains()

    found = 0
    for i, symbol in enumerate(symbols, 1):
        # Zaten logosu olan sembol tekrar çekilmez (force hariç): bu script
        # kaldığı yerden devam edebilir, rate-limit'e takılırsa yeniden koşulur.
        if not force and symbol in manifest:
            existing = LOGOS_DIR / manifest[symbol]
            if existing.exists():
                found += 1
                continue

        # KAP'tan gelen alan adı varsa ağa hiç çıkma; yoksa yfinance'e düş.
        domain = known_domains.get(symbol) or domain_of(fetch_website(symbol))
        if not domain:
            print(f"[LOGO] {symbol}: web sitesi yok, atlandı")
            continue

        raw = download_logo(domain) or download_site_icon(domain)
        if raw is None:
            print(f"[LOGO] {symbol} ({domain}): logo bulunamadı")
            continue

        png = normalize_png(raw)
        if png is None:
            continue

        filename = f"{price_file_name(symbol)}.png"
        (LOGOS_DIR / filename).write_bytes(png)
        manifest[symbol] = filename
        found += 1
        print(f"[LOGO] {symbol} ({domain}) -> {filename} ({len(png)} bayt)")

        time.sleep(0.2)  # nazik davran: iki istek arası kısa bekleme
        if i % 50 == 0:
            print(f"[LOGO] ilerleme: {i}/{len(symbols)} ({found} logo)")

    # Manifest yalnızca dosyası GERÇEKTEN var olan sembolleri taşır.
    manifest = {s: f for s, f in manifest.items() if (LOGOS_DIR / f).exists()}
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"[LOGO] tamamlandı: {found}/{len(symbols)} sembolde logo -> {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
