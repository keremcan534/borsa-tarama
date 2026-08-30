"""BIST şirketlerinin web sitesi alan adlarını KAP'tan toplar.

    python scripts/build_company_domains.py            # eksikleri tamamlar
    python scripts/build_company_domains.py --force    # hepsini yeniden çeker

Çıktı: `app/data/company_domains.json` — {"THYAO.IS": "turkishairlines.com", ...}

Neden ayrı ve neden repoya yazılıyor: alan adı yılda bir bile değişmez, ama onu
toplamak 610 HTTP isteği demek. Bir kez toplanıp sürüm kontrolüne konur;
`build_logos.py` ondan sonra ağa yalnızca logo indirmek için çıkar. Şirket adı
-> alan adı eşlemesi ileride (site linki, KAP kısayolu) yeniden kullanılabilir.
"""

import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.data.kap_companies import (
    KAP_COMPANIES_PAGE,
    KAP_COMPANY_SUMMARY,
    KAP_HEADERS,
    domain_of,
    parse_company_oids,
    parse_company_website,
)
from app.data.markets import SYMBOLS_DIR

DOMAINS_PATH = Path(__file__).resolve().parents[1] / "app" / "data" / "company_domains.json"
WORKERS = 8  # KAP'ı yormayacak, 610 sayfayı ~3 dk'da bitirecek denge
RETRIES = 2


def load_bist_symbols() -> list[str]:
    return json.loads((SYMBOLS_DIR / "bist_all.json").read_text(encoding="utf-8"))


def fetch_summary(session: requests.Session, oid: str) -> str | None:
    for attempt in range(RETRIES + 1):
        try:
            response = session.get(KAP_COMPANY_SUMMARY.format(oid=oid), timeout=45)
            if response.status_code != 200:
                return None
            return response.text
        except Exception:
            if attempt == RETRIES:
                return None
            time.sleep(1 + attempt)
    return None


def main() -> int:
    force = "--force" in sys.argv
    session = requests.Session()
    session.headers.update(KAP_HEADERS)

    known: dict[str, str] = {}
    if DOMAINS_PATH.exists() and not force:
        try:
            known = json.loads(DOMAINS_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            known = {}

    symbols = load_bist_symbols()
    todo = [s for s in symbols if force or s not in known]
    if not todo:
        print(f"[DOMAIN] güncel: {len(known)}/{len(symbols)}")
        return 0

    page = session.get(KAP_COMPANIES_PAGE, timeout=60)
    page.raise_for_status()
    oids = parse_company_oids(page.text)
    print(f"[DOMAIN] KAP'ta {len(oids)} şirket kodu; {len(todo)} sembol çekilecek")
    if len(oids) < 300:
        # Sayfa yapısı değiştiyse sessizce yarım eşleme yazmak, logo kapsamını
        # fark edilmeden düşürürdü. Erken ve gürültülü başarısız ol.
        print("[HATA] KAP şirket listesi beklenenden küçük — sayfa değişmiş olabilir.")
        return 1

    def resolve(symbol: str) -> tuple[str, str | None]:
        code = symbol.split(".")[0].upper()
        oid = oids.get(code)
        if not oid:
            return symbol, None
        html = fetch_summary(session, oid)
        if not html:
            return symbol, None
        return symbol, domain_of(parse_company_website(html))

    found = 0
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for i, (symbol, domain) in enumerate(pool.map(resolve, todo), 1):
            if domain:
                known[symbol] = domain
                found += 1
            if i % 50 == 0:
                print(f"[DOMAIN] {i}/{len(todo)} ({found} alan adı)")

    DOMAINS_PATH.write_text(
        json.dumps(dict(sorted(known.items())), ensure_ascii=False, indent=0) + "\n",
        encoding="utf-8",
    )
    covered = sum(1 for s in symbols if s in known)
    print(f"[DOMAIN] tamamlandı: {covered}/{len(symbols)} sembolde alan adı -> {DOMAINS_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
