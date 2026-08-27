"""KAP aylık portföy raporlarından hisse-fon pozisyon matrisi üretir.

Varsayılan kullanım önceki ayın raporlarını işler ve yayındaki geçmiş JSON ile
birleştirir. Ayın 15'inde çalıştırılması güncel rapor eksiklerini azaltır.
"""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
import time
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import requests
from pypdf import PdfReader

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.funds.positions import build_position_payload

KAP = "https://www.kap.org.tr"
SUBJECT_OID = "8aca490d502e34b801502e380044002b"
DEFAULT_SITE = "https://keremcan534.github.io/borsa-tarama/data"
HEADERS = {
    # Tam tarayıcı UA: KAP, bot görünümlü UA'lara/datacenter IP'lerine zaman
    # zaman 500 döndürüyor; gerçekçi kimlik bu filtreye takılma ihtimalini azaltır.
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Referer": f"{KAP}/tr/bildirim-sorgu",
}

# Nominal, alış fiyatı, tarih, günlük fiyat, toplam değer, FPD%, grup%, TL,
# opsiyonel borsa no, FTD%, ISIN.
_STOCK_TAIL = re.compile(
    r"(-?[\d.]+,\d{2})\s+"
    r"-?[\d.]+,\d+\s+\d{2}/\d{2}/\d{2}\s+"
    r"-?[\d.]+,\d+\s+-?[\d.]+,\d{2}\s+"
    r"-?[\d.]+,\d{2}\s+-?[\d.]+,\d{2}\s*TL"
    r"(?:\s+\d+)?\s+(-?[\d.]+,\d{2})\s*"
    r"(TR[A-Z0-9]{10})",
    re.DOTALL,
)
_NON_SYMBOLS = {
    "TOPLAM", "GRUP", "DEGER", "GUNLUK", "NOMINAL", "VADE", "TARIHI",
    "IHRACCI", "KURUM", "MENKUL", "KIYMET", "DOVIZ", "BORSA", "FAIZ",
    "ODEME", "SAYISI", "ISIN", "KODU", "SANAYI", "TICARET", "ELEKTRONIK",
    "HIZMETLERI", "HOLDING", "YATIRIM", "ORTAKLIGI", "BANKASI", "TURKIYE",
}


def _tr_number(value: str) -> float:
    return float(value.replace(".", "").replace(",", "."))


def _ascii_token(value: str) -> str:
    return (
        value.upper()
        .translate(str.maketrans("ÇĞİÖŞÜ", "CGIOSU"))
        .replace("�", "")
    )


def _symbol_from_prefix(prefix: str, fund_code: str) -> str | None:
    for raw_line in prefix.splitlines():
        line = _ascii_token(raw_line.strip())
        match = re.match(r"^([A-Z][A-Z0-9]{2,7})(?:\s|$)", line)
        if not match:
            continue
        candidate = match.group(1)
        if candidate == fund_code or candidate in _NON_SYMBOLS:
            continue
        if candidate.startswith(("HISSE", "FON", "PORTFOY")):
            continue
        return candidate
    return None


def unwrap_kap_pdf(content: bytes) -> bytes:
    """KAP download bazen Java serialization sarmalayıcısı içinde PDF döner."""
    pdf_start = content.find(b"%PDF")
    if pdf_start < 0:
        return content
    content = content[pdf_start:]
    eof = content.rfind(b"%%EOF")
    if eof > 0:
        content = content[: eof + 5]
    return content


def parse_portfolio_text(text: str, fund_code: str, fund_name: str, month: str) -> list[dict]:
    """PDR metnindeki Hisse Senetleri tablosunu satırlara çevirir (FTD ağırlığı)."""
    starts = [text.find("HİSSE SENETLERİ"), text.find("H�SSE SENETLER�")]
    start = max(starts)
    if start < 0:
        return []
    end = text.find("GRUP TOPLAMI", start)
    section = text[start : end if end > start else len(text)]

    aggregated: dict[str, dict[str, float]] = defaultdict(
        lambda: {"weight": 0.0, "shares": 0.0}
    )
    previous_end = 0
    for match in _STOCK_TAIL.finditer(section):
        nominal, weight, _isin = match.groups()
        symbol = _symbol_from_prefix(section[previous_end : match.start()], fund_code)
        previous_end = match.end()
        if not symbol:
            continue
        aggregated[symbol]["shares"] += _tr_number(nominal)
        aggregated[symbol]["weight"] += _tr_number(weight)

    return [
        {
            "fund_code": fund_code,
            "fund_name": fund_name,
            "symbol": symbol,
            "month": month,
            "weight": round(values["weight"], 4),
            "shares": round(values["shares"], 2),
        }
        for symbol, values in aggregated.items()
        if values["shares"] > 0 and values["weight"] >= 0
    ]


def parse_portfolio_pdf(content: bytes, fund_code: str, fund_name: str, month: str) -> list[dict]:
    """Bir KAP portföy PDF'indeki Hisse Senetleri grubunu ayrıştırır."""
    reader = PdfReader(io.BytesIO(unwrap_kap_pdf(content)), strict=False)
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    return parse_portfolio_text(text, fund_code, fund_name, month)


def _request_json(session: requests.Session, method: str, url: str, **kwargs):
    for attempt in range(4):
        try:
            response = session.request(method, url, timeout=45, **kwargs)
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, ValueError):
            if attempt == 3:
                raise
            time.sleep(2**attempt)


def _previous_month(today: date) -> tuple[int, int]:
    first = today.replace(day=1)
    previous = first - timedelta(days=1)
    return previous.year, previous.month


def fetch_fund_oid_map(session: requests.Session) -> dict[str, str]:
    """KAP YF fon kodu → fundOid eşlemesi (kap-client Fund.oid burada boş kalır)."""
    rows = _request_json(session, "GET", f"{KAP}/tr/api/fund/criteria/YF/Y")
    mapping: dict[str, str] = {}
    for row in rows:
        code = str(row.get("fundCode") or "").upper()
        oid = str(row.get("fundOid") or "")
        if code and oid:
            mapping[code] = oid
    return mapping


def _disclosure_window(year: int, month: int) -> tuple[str, str]:
    # Aylık raporlar çoğunlukla izleyen ayın ilk 10–20 gününde yayımlanır.
    report_month_end = date(year, month, 28) + timedelta(days=4)
    report_month_end -= timedelta(days=report_month_end.day)
    start = report_month_end + timedelta(days=1)
    end = start + timedelta(days=20)
    return start.isoformat(), end.isoformat()


def fetch_disclosures(
    session: requests.Session,
    year: int,
    month: int,
    fund_oids: list[str] | None = None,
    *,
    batch_size: int = 40,
) -> list[dict]:
    """Portföy dağılım bildirimlerini getirir; fundOidList ile 2000 satır tavanından kaçın."""
    from_date, to_date = _disclosure_window(year, month)
    body_base = {
        "fromDate": from_date,
        "toDate": to_date,
        "fundTypeList": [],
        "mkkMemberOidList": [],
        "passiveFundOidList": [],
        "disclosureClass": "",
        "isLate": "",
        "subjectList": [SUBJECT_OID],
        "discIndex": [],
        "fromSrc": False,
        "srcCategory": "",
    }
    oids = fund_oids or []
    batches = [oids[i : i + batch_size] for i in range(0, len(oids), batch_size)] or [[]]
    rows: list[dict] = []
    for batch in batches:
        body = {**body_base, "fundOidList": batch}
        rows.extend(
            _request_json(
                session,
                "POST",
                f"{KAP}/tr/api/disclosure/funds/byCriteria",
                json=body,
            )
        )
        time.sleep(0.1)
    return [
        row
        for row in rows
        if int(row.get("year") or 0) == year and int(row.get("period") or 0) == month
    ]


def _disclosure_rank(row: dict) -> tuple[int, int]:
    status = str(row.get("modifyStatus") or "").upper()
    if status == "DUZELTILMIS":
        bonus = 3
    elif status == "DUZELTME":
        bonus = 2
    else:
        bonus = 1
    return bonus, int(row["disclosureIndex"])


def pick_latest_disclosures(rows: list[dict], allowed_codes: set[str]) -> dict[str, dict]:
    latest_by_fund: dict[str, dict] = {}
    for row in rows:
        code = str(row.get("fundCode") or "").upper()
        if code not in allowed_codes:
            continue
        previous = latest_by_fund.get(code)
        if previous is None or _disclosure_rank(row) > _disclosure_rank(previous):
            latest_by_fund[code] = row
    return latest_by_fund


def _pick_pdr_attachment(attachments: list[dict]) -> dict | None:
    pdfs = [
        item
        for item in attachments
        if str(item.get("fileExtension", "")).lower() == "pdf"
    ]
    if not pdfs:
        return None

    def score(item: dict) -> tuple[int, str]:
        name = str(item.get("fileName") or "").lower()
        points = 0
        if any(token in name for token in ("portfo", "dagil", "dağılım", "pdr")):
            points += 10
        if "risk" in name:
            points -= 5
        return points, name

    return max(pdfs, key=score)


def download_report(session: requests.Session, disclosure_index: int) -> bytes | None:
    detail = _request_json(
        session,
        "GET",
        f"{KAP}/tr/api/notification/attachment-detail/{disclosure_index}",
    )
    if isinstance(detail, list):
        detail = detail[0] if detail else {}
    attachments = detail.get("attachments") or []
    pdf = _pick_pdr_attachment(attachments)
    if not pdf:
        return None
    response = session.get(
        f"{KAP}/tr/api/file/download/{pdf['objId']}",
        timeout=60,
        headers={**HEADERS, "Referer": f"{KAP}/tr/Bildirim/{disclosure_index}"},
    )
    response.raise_for_status()
    return response.content


def load_remote_json(session: requests.Session, url: str) -> dict:
    try:
        response = session.get(url, timeout=30)
        response.raise_for_status()
        return response.json()
    except (requests.RequestException, ValueError):
        return {}


def payload_to_records(payload: dict) -> list[dict]:
    records = []
    for symbol, stock in (payload.get("stocks") or {}).items():
        for fund in stock.get("funds") or []:
            for month, point in (fund.get("positions") or {}).items():
                records.append(
                    {
                        "fund_code": fund.get("fund_code"),
                        "fund_name": fund.get("fund_name"),
                        "symbol": symbol,
                        "month": month,
                        "weight": point.get("weight"),
                        "shares": point.get("shares"),
                    }
                )
    return records


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int)
    parser.add_argument("--month", type=int)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("frontend/public/data/fund_stock_positions.json"),
    )
    parser.add_argument("--site-data-url", default=DEFAULT_SITE)
    parser.add_argument("--max-funds", type=int, default=150)
    args = parser.parse_args()

    default_year, default_month = _previous_month(date.today())
    year = args.year or default_year
    month = args.month or default_month
    month_key = f"{year:04d}-{month:02d}"

    session = requests.Session()
    session.headers.update(HEADERS)
    funds_payload = load_remote_json(session, f"{args.site_data_url}/funds.json")
    fund_results = funds_payload.get("results") or []
    selected_codes = {
        str(fund.get("symbol", "")).upper()
        for fund in fund_results[: args.max_funds]
        if fund.get("symbol")
    }
    if not selected_codes:
        raise SystemExit("Yayındaki funds.json okunamadı veya fon listesi boş")

    oid_map = fetch_fund_oid_map(session)
    target_oids = [
        oid_map[code] for code in sorted(selected_codes) if code in oid_map
    ]
    disclosures = fetch_disclosures(session, year, month, target_oids)
    latest_by_fund = pick_latest_disclosures(disclosures, selected_codes)

    records: list[dict] = []
    failures = 0
    for index, (code, row) in enumerate(sorted(latest_by_fund.items()), 1):
        try:
            content = download_report(session, int(row["disclosureIndex"]))
            parsed = (
                parse_portfolio_pdf(content, code, row.get("kapTitle") or code, month_key)
                if content
                else []
            )
            records.extend(parsed)
            print(f"[KAP {index}/{len(latest_by_fund)}] {code}: {len(parsed)} hisse")
        except Exception as exc:
            failures += 1
            print(f"[KAP] {code} atlandı: {exc}")
        time.sleep(0.15)

    previous = load_remote_json(
        session, f"{args.site_data_url}/fund_stock_positions.json"
    )
    merged = [
        row for row in payload_to_records(previous) if row.get("month") != month_key
    ]
    merged.extend(records)
    payload = build_position_payload(
        merged,
        max_months=12,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
    # Doğrulama YAZIMDAN ÖNCE: boş sonuç önce dosyaya yazılıp sonra hata
    # veriliyordu — başarısız bir koşu, elde ne varsa boş iskeletle eziyordu.
    if not records and not payload.get("stocks"):
        raise SystemExit("Hiç hisse pozisyonu ayrıştırılamadı; mevcut dosyaya dokunulmadı")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(
        f"[KAP] {month_key}: {len(latest_by_fund)} rapor, {len(records)} pozisyon, "
        f"{failures} hata -> {args.output}"
    )
    if not records:
        print("[KAP] Bu ay için yeni pozisyon yok; önceki geçmiş korundu.")


if __name__ == "__main__":
    main()
