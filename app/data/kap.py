"""KAP (Kamuyu Aydınlatma Platformu) şirket bildirimleri.

Neden gerekli: sitenin haber tarafı Google News/Yahoo üzerinden çalışıyordu — yani
**ikincil** kaynak. Bir şirketin bilançosu, pay alım-satımı, sermaye artırımı ya da
özel durum açıklaması önce KAP'ta yayımlanır; haber siteleri onu saatler sonra ve
yorumlayarak aktarır. Birincil kaynağın hiç olmaması, sitenin en görünür eksiğiydi.

## Uç

`POST https://www.kap.org.tr/tr/api/disclosure/members/byCriteria`, gövdede
`{"fromDate", "toDate", "mkkMemberOidList": [], "subjectList": []}` (boş listeler =
tüm şirketler, tüm konular). `Referer` başlığı zorunlu: KAP'ın Next.js arayüzü
isteği bu başlıkla atıyor, başlıksız istek asılı kalıyor. Yanıt en fazla 2000 kayıt
döndürür — bu yüzden pencere gün ölçeğinde tutulur, ay ölçeğinde değil.

Ölçüldü (2026-08): 3 günlük pencere 546 bildirim getiriyor, yani 2000 sınırına
~11 günde varılır. Varsayılan pencere 3 gün: tarama günde iki kez çalıştığından
fazlasıyla yeterli, sınırdan da uzak.

## Hangi bildirimler alınır

- `stockCodes` boş olanlar elenir (154/546): bunlar fon/ihraççı bildirimleri olup
  bir hisseye bağlanamaz, arayüzde hangi hissenin altında gösterileceği belirsizdir.
- Bir bildirim birden çok koda ait olabilir ("INFO, IYF") — her kod için ayrı satır
  üretilir, tıpkı haber akışında olduğu gibi.
- Taranan sembol listesi verilirse yalnızca o hisselerin bildirimleri kalır: 610
  sembollük taramada KAP'ın tüm ihraççı evrenini taşımanın anlamı yok.

Yalnızca KAP'ın kendi meta alanları (konu başlığı, özet, tarih, link) saklanır;
bildirimin gövdesi/eki hiç indirilmez. Bu hem telif hem boyut kararıdır — arayüz
başlığı gösterip kullanıcıyı KAP'taki asıl bildirime yollar.
"""

from datetime import date, datetime, timedelta, timezone

import requests

KAP_DISCLOSURE_API = "https://www.kap.org.tr/tr/api/disclosure/members/byCriteria"
KAP_DISCLOSURE_LINK = "https://www.kap.org.tr/tr/Bildirim/{index}"

# Referer olmadan istek cevapsız asılı kalıyor (60 sn'de 0 bayt ölçüldü).
HEADERS = {
    "User-Agent": "Mozilla/5.0 (borsa-tarama KAP reader)",
    "Referer": "https://www.kap.org.tr/tr/bildirim-sorgu",
    "Content-Type": "application/json",
}

DEFAULT_WINDOW_DAYS = 3
REQUEST_TIMEOUT = 90

# KAP'ın bildirim sınıfları. Arayüz bunlara göre rozet/renk verir.
CATEGORY_LABELS = {
    "FR": "Finansal Rapor",
    "ODA": "Özel Durum",
    "DG": "Diğer",
    "DKB": "Düzenleyici",
    "STT": "Pay Alım Satım",
}


def _parse_publish_date(value: str | None) -> str | None:
    """KAP'ın "26.08.2026 14:01:04" biçimini ISO 8601'e çevirir (TR saati, UTC+3).

    KAP saatleri Türkiye saatiyle yayımlar ve zaman dilimi bilgisi taşımaz. Naive
    bırakılsaydı arayüz bunları tarayıcının yerel diliminde yorumlar, yurt dışındaki
    bir kullanıcıda bildirimler saatlerce kaymış görünürdü.
    """
    if not value:
        return None
    try:
        naive = datetime.strptime(value.strip(), "%d.%m.%Y %H:%M:%S")
    except (ValueError, AttributeError):
        return None
    return naive.replace(tzinfo=timezone(timedelta(hours=3))).isoformat()


def _split_stock_codes(value: str | None) -> list[str]:
    if not value:
        return []
    return [code.strip().upper() for code in value.split(",") if code.strip()]


def parse_disclosures(raw: list[dict], symbols: set[str] | None = None) -> list[dict]:
    """Ham KAP kayıtlarını arayüzün beklediği düz satırlara çevirir.

    `symbols` verilirse (".IS" ekli, taranan sembol listesi) yalnızca o hisselere
    ait bildirimler döner. Sonuç tarihe göre yeniden eskiye sıralıdır.
    """
    rows: list[dict] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        codes = _split_stock_codes(item.get("stockCodes"))
        if not codes:
            continue  # hisseye bağlanamayan (fon/ihraççı) bildirim

        published_at = _parse_publish_date(item.get("publishDate"))
        index = item.get("disclosureIndex")
        category = item.get("disclosureCategory") or item.get("disclosureClass")

        for code in codes:
            symbol = f"{code}.IS"
            if symbols is not None and symbol not in symbols:
                continue
            rows.append(
                {
                    "symbol": symbol,
                    "company": item.get("kapTitle"),
                    "subject": item.get("subject"),
                    "summary": item.get("summary") or None,
                    "category": category,
                    "category_label": CATEGORY_LABELS.get(category or "", None),
                    "published_at": published_at,
                    "link": KAP_DISCLOSURE_LINK.format(index=index) if index else None,
                    # Geç bildirim: KAP'ın kendi işareti, yatırımcı için anlamlı bir sinyal
                    "is_late": bool(item.get("isLate")),
                }
            )

    rows.sort(key=lambda r: r["published_at"] or "", reverse=True)
    return rows


def fetch_disclosures(
    symbols: set[str] | None = None,
    window_days: int = DEFAULT_WINDOW_DAYS,
    session: requests.Session | None = None,
    today: date | None = None,
) -> list[dict]:
    """Son `window_days` günün KAP bildirimleri. Hata olursa BOŞ liste döner.

    Sessizce boş dönmesi bilinçli: KAP erişilemezse tarama durmamalı, yalnızca
    bildirim bölümü boş kalmalı — haber toplama da aynı şekilde davranıyor.
    """
    session = session or requests.Session()
    today = today or date.today()
    body = {
        "fromDate": str(today - timedelta(days=window_days)),
        "toDate": str(today),
        "mkkMemberOidList": [],
        "subjectList": [],
    }

    try:
        response = session.post(KAP_DISCLOSURE_API, json=body, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        raw = response.json()
    except Exception as e:
        print(f"[KAP] bildirimler alınamadı ({e})")
        return []

    if not isinstance(raw, list):
        print(f"[KAP] beklenmeyen yanıt biçimi: {type(raw).__name__}")
        return []

    rows = parse_disclosures(raw, symbols)
    print(f"[KAP] {len(raw)} ham bildirim -> {len(rows)} satır ({window_days} günlük pencere)")
    return rows
