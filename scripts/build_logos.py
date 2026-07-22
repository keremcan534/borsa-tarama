"""Şirket logolarını indirir (`frontend/public/logos/`) + manifest üretir.

Neden ayrı bir script ve statik dosya — `build_sectors.py` ile aynı gerekçe:
logo, şirketin `website` alanından türetiliyor (yfinance `.info`), bu da sembol
başına ~0,5 sn + rate-limit riski. Bir şirketin logosu neredeyse hiç değişmez;
bir kez indirilip repoya konur, ÇALIŞMA ANINDA sıfır harici istek olur (hız +
kullanıcı gizliliği: kimse "hangi hisseye baktığını" üçüncü bir sunucuya sızdırmaz).

Kaynak: Google'ın favicon servisi (`s2/favicons?domain=...&sz=128`). Fizibilite
test edildi — BIST ve ABD şirketlerinin çoğu için gerçek logo dönüyor; bilinmeyen
alan adı 404 veriyor (yani tespit edilebilir, çöp görsel kaydedilmez).

Logosu bulunamayan sembol manifestte yer almaz; arayüz o sembol için nötr harf
rozetine düşer (mevcut TickerLogo davranışı).

    python scripts/build_logos.py                 # tüm hisse marketleri, eksikleri tamamlar
    python scripts/build_logos.py bist100         # yalnızca BIST 100
    python scripts/build_logos.py --force         # hepsini yeniden indirir

Yeniden çalıştırmak gerekir: sembol listeleri endeks revizyonuyla değişince.
"""

import io
import json
import sys
import time
from pathlib import Path

import requests
import yfinance as yf

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.data.markets import MARKET_FILES, SYMBOLS_DIR
from app.data.price_files import price_file_name

LOGOS_DIR = Path(__file__).resolve().parents[1] / "frontend" / "public" / "logos"
MANIFEST_PATH = LOGOS_DIR / "index.json"

# Google favicon servisi; sz=128 makul çözünürlük (tabloda 26px, retina için yeter).
FAVICON_URL = "https://www.google.com/s2/favicons?domain={domain}&sz=128"

# Gerçek ayraç HTTP DURUM KODUdur: Google bilinmeyen alan adına 404 döner, bilinene
# 200 + görsel. İlk sürümde ek olarak bir byte eşiği vardı ama YANLIŞTI — Tüpraş gibi
# yalnızca küçük (16x16, ~230 bayt) faviconu olan şirketlerin geçerli logosunu eliyordu
# (100 sembolde 48'i boşuna atlanmış). Bu eşik yalnızca tamamen boş/bozuk yanıtı eler.
MIN_LOGO_BYTES = 70

# Yalnızca hisse marketleri: emtia/kripto/ETF'nin şirket web sitesi yok.
LOGO_MARKETS = ("bist100", "sp500")


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
    for market in markets:
        filename = MARKET_FILES.get(market)
        if not filename:
            continue
        path = SYMBOLS_DIR / filename
        if path.exists():
            symbols.extend(json.loads(path.read_text(encoding="utf-8")))

    found = 0
    for i, symbol in enumerate(symbols, 1):
        # Zaten logosu olan sembol tekrar çekilmez (force hariç): bu script
        # kaldığı yerden devam edebilir, rate-limit'e takılırsa yeniden koşulur.
        if not force and symbol in manifest:
            existing = LOGOS_DIR / manifest[symbol]
            if existing.exists():
                found += 1
                continue

        website = fetch_website(symbol)
        domain = domain_of(website)
        if not domain:
            print(f"[LOGO] {symbol}: web sitesi yok, atlandı")
            continue

        raw = download_logo(domain)
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
