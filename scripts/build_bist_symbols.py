"""Borsa İstanbul'da işlem gören TÜM hisselerin sembol listesini üretir.

Neden gerekli: tarama uzun süre yalnızca `bist100.json` ile çalıştı — yani borsanın
~%14'ü. Kullanıcı ilgilendiği hisseyi arayıp bulamıyorsa site onun için yok demektir.
Bu script kapsamı endeksten borsanın tamamına çıkarır.

## Kaynak: KAP, Yahoo değil

Sembol listesi KAP'ın "BIST Şirketleri" sayfasından gelir
(https://www.kap.org.tr/tr/bist-sirketler). Sayfa Next.js ile render ediliyor ve
şirket listesini gömülü JSON olarak taşıyor; `stockCode` alanları oradan okunur.
Yahoo'da "BIST'te işlem gören tüm hisseler" diye sorgulanabilir bir uç yok — Yahoo
sembol DOĞRULAMAK için kullanılır, keşfetmek için değil.

## İki aşama: keşif + doğrulama

KAP listesi ham haliyle taramaya verilemez, üç sebeple:

1. Tek şirketin birden çok kodu olabiliyor ("ALBRK, ALK" gibi) ve bunlardan yalnızca
   biri hisse kodudur; diğeri genelde borçlanma aracı ihraççı kodudur.
2. Liste KAP'a bildirim yapan tüm ihraççıları içerir; bir kısmının hissesi BIST'te
   işlem görmez.
3. Yahoo bazı geçerli BIST kodlarını hiç tanımaz; tarama o sembolde exception'a
   düşüp `[UYARI] ... atlandı` basar. Bir seferlik doğrulama, her taramada tekrar
   tekrar başarısız istek atmaktan ucuzdur.

Bu yüzden her kod Yahoo'nun grafik ucuna sorulur ve **yalnızca gerçekten veri dönen,
hâlâ işlem gören** kodlar listeye girer. Doğrulama `yfinance` yerine doğrudan HTTP
ile yapılır: yfinance bu ortamda TLS taklidi kullanıyor ve proxy arkasında
çalışmıyor; grafik ucu ise düz `requests` ile sorunsuz cevap veriyor.

## Çalıştırma

    python scripts/build_bist_symbols.py

Çıktılar:
- `app/data/symbols/bist_all.json` — tarama için sembol listesi (["THYAO.IS", ...])
- `app/data/symbols/bist_all_names.json` — kod -> şirket adı (hisse sayfaları ve
  arayüzdeki arama için; sembol dosyasının düz liste biçimi bozulmasın diye ayrı)

Endeks bileşenleri değiştikçe (ve yeni halka arzlar geldikçe) yeniden çalıştırılmalı.
"""

import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

KAP_BIST_COMPANIES = "https://www.kap.org.tr/tr/bist-sirketler"
YAHOO_CHART = "https://query2.finance.yahoo.com/v8/finance/chart/{symbol}"
HEADERS = {"User-Agent": "Mozilla/5.0 (borsa-tarama symbol builder)"}

SYMBOLS_DIR = Path(__file__).resolve().parent.parent / "app" / "data" / "symbols"

# Sayfadaki JSON kaçışlı gömülü geliyor ("\"stockCode\":\"THYAO\""), yani doğrudan
# json.loads edilemiyor. Kayıtlar `mkkMemberOid` ile başladığından metni ONA GÖRE
# parçalayıp her parçadan tek ad + tek kod okuyoruz. Adı ve kodu tek regex'le birlikte
# yakalamak riskli: aralarında `relatedMemberTitle` (denetim şirketi) duruyor ve desen
# kayıt sınırını aşarsa adlar bir kayıt kayar — ölçüldü, A1CAP'e komşu şirketin adı düşmüştü.
RECORD_SPLIT_RE = re.compile(r'\\"mkkMemberOid\\":')
TITLE_RE = re.compile(r'\\"kapMemberTitle\\":\\"(.*?)\\"')
CODE_RE = re.compile(r'\\"stockCode\\":\\"(.*?)\\"')

# Yapı değişirse sessizce yarım/kaymış liste üretmemek için bilinen eşleşmeler.
SANITY_CHECKS = {"THYAO": "TÜRK HAVA YOLLARI", "ASELS": "ASELSAN", "AKBNK": "AKBANK"}

# BIST hisse kodu: 3-6 büyük harf/rakam. Bunun dışındakiler (boş, tire içeren) elenir.
VALID_CODE = re.compile(r"^[A-Z0-9]{3,6}$")

# Doğrulama eşikleri
MIN_BARS = 60  # bu kadar günlük mumu olmayan sembol taramada zaten elenir
MAX_STALE_DAYS = 20  # son işlemi bundan eskiyse borsada aktif değil sayılır
WORKERS = 6  # Yahoo'yu yormamak için düşük tutuldu
RETRIES = 2


def parse_kap_companies(html: str) -> dict[str, str]:
    """Gömülü JSON'dan {hisse kodu: şirket adı}. Çok kodlu şirketlerde her kod ayrı girer."""
    out: dict[str, str] = {}
    for chunk in RECORD_SPLIT_RE.split(html)[1:]:
        title_match = TITLE_RE.search(chunk)
        code_match = CODE_RE.search(chunk)
        if not title_match or not code_match:
            continue
        title = title_match.group(1).strip()
        # "ALBRK, ALK" gibi çok kodlu alanlar: hepsi aday, doğrulama ayıklayacak
        for code in re.split(r"[,\s]+", code_match.group(1)):
            code = code.strip().upper()
            if VALID_CODE.match(code):
                out.setdefault(code, title)
    return out


def fetch_kap_companies(session: requests.Session) -> dict[str, str]:
    """KAP'tan {hisse kodu: şirket adı}; yapı değiştiyse üretmeden hata verir."""
    response = session.get(KAP_BIST_COMPANIES, timeout=60)
    response.raise_for_status()
    companies = parse_kap_companies(response.text)

    for code, expected in SANITY_CHECKS.items():
        actual = companies.get(code, "")
        if not actual.startswith(expected):
            raise RuntimeError(
                f"KAP sayfasının yapısı değişmiş olabilir: {code} -> {actual!r} "
                f"(beklenen: {expected!r} ile başlamalı). Liste üretilmedi."
            )
    return companies


def verify_symbol(session: requests.Session, symbol: str) -> dict | None:
    """Yahoo'da gerçekten veri var mı? Varsa {"bars", "last_ts"}, yoksa None."""
    for attempt in range(RETRIES + 1):
        try:
            response = session.get(
                YAHOO_CHART.format(symbol=symbol),
                params={"range": "6mo", "interval": "1d"},
                timeout=30,
            )
            if response.status_code == 429:
                time.sleep(2 * (attempt + 1))  # rate-limit: geri çekil ve tekrar dene
                continue
            if response.status_code != 200:
                return None
            result = (response.json().get("chart") or {}).get("result")
            if not result:
                return None
            timestamps = result[0].get("timestamp") or []
            if len(timestamps) < MIN_BARS:
                return None
            return {"bars": len(timestamps), "last_ts": timestamps[-1]}
        except Exception:
            if attempt == RETRIES:
                return None
            time.sleep(1)
    return None


def main() -> int:
    session = requests.Session()
    session.headers.update(HEADERS)

    companies = fetch_kap_companies(session)
    print(f"[KAP] {len(companies)} aday hisse kodu bulundu")
    if len(companies) < 300:
        # KAP sayfasının yapısı değiştiyse sessizce yarım liste üretmek, taramanın
        # kapsamını fark edilmeden daraltırdı. Erken ve gürültülü başarısız ol.
        print("[HATA] Aday sayısı beklenenin çok altında — KAP sayfası değişmiş olabilir.")
        return 1

    now = time.time()
    verified: list[str] = []
    names: dict[str, str] = {}
    stale, missing = 0, 0

    def check(code: str) -> tuple[str, dict | None]:
        return code, verify_symbol(session, f"{code}.IS")

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for index, (code, info) in enumerate(pool.map(check, sorted(companies)), start=1):
            if index % 100 == 0:
                print(f"[DOĞRULAMA] {index}/{len(companies)}...")
            if info is None:
                missing += 1
                continue
            if (now - info["last_ts"]) > MAX_STALE_DAYS * 86400:
                stale += 1
                continue
            verified.append(f"{code}.IS")
            names[code] = companies[code]

    verified.sort()
    print(
        f"[SONUÇ] {len(verified)} sembol doğrulandı "
        f"({missing} Yahoo'da yok/veri yetersiz, {stale} işlem görmüyor)"
    )
    if len(verified) < 300:
        print("[HATA] Doğrulanan sembol sayısı beklenenin altında — liste yazılmadı.")
        return 1

    (SYMBOLS_DIR / "bist_all.json").write_text(
        json.dumps(verified, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (SYMBOLS_DIR / "bist_all_names.json").write_text(
        json.dumps(dict(sorted(names.items())), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"[YAZILDI] {SYMBOLS_DIR / 'bist_all.json'} ve bist_all_names.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
