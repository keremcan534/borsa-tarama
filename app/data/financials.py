"""Çeyreklik finansal özet: satış, brüt kâr, faaliyet kârı, net kâr ve marjlar.

Neden gerekli: tarama saf teknikti; temel tarafta yalnızca tek bir anlık F/K, PD/DD,
ROE vardı. "Bu şirket kâr ediyor mu, satışı büyüyor mu?" sorusuna cevabı yoktu —
oysa rakip platformların TAMAMI bilanço üstüne kurulu. Bu modül tam finansal tablo
altyapısı kurmadan o sorunun cevabını veren asgari veriyi getirir.

## Kapsam bilinçli olarak dar

Yahoo'nun `incomeStatementHistoryQuarterly` modülü BIST hisseleri için **son 4
çeyreği** döndürüyor (ölçüldü: THYAO ve ASELS'te 2026-06'ya kadar dolu geliyor).
Bilanço modülü (`balanceSheetHistoryQuarterly`) BIST'te alanları boş döndürdüğü
için hiç kullanılmıyor: boş bir "özsermaye" kolonu göstermek, veri varmış gibi
görünüp olmamaktan kötüdür.

Dört çeyrek şunları mümkün kılar: son çeyrek rakamları, marjlar, bir önceki çeyreğe
göre değişim ve son 12 ayın (TTM) toplamı. Mümkün KILMAZ: yıllık (YoY) karşılaştırma
— onun için 5. çeyrek gerekir. Bu sınır arayüzde de belirtilmeli, uydurulmamalı.

## Kapsam sınırı (ölçüldü, 2026-08)

652 sembolde veri geldi ama dağılım eşit değil: **S&P 500'de 484/503, BIST'te
yalnızca 168/610.** Yahoo'nun BIST küçük/orta ölçekli şirketler için gelir tablosu
verisi çoğu zaman yok. Bu, özelliğin BIST'te büyük şirketlerde çalışıp diğerlerinde
"veri yok" diyeceği anlamına gelir; arayüz bunu gizlemez.

## Raporlanmayan kalem 0 olarak geliyor

Yahoo, bilmediği kalemi eksik bırakmak yerine `0` döndürebiliyor: THYAO'da
`grossProfit` 327 milyar TL satışa karşılık 0 geliyor. Bunu olduğu gibi saklamak
arayüzde "brüt marj %0" yazdırırdı — bu, veri yokluğunu **ölçülmüş bir gerçek gibi**
gösterir. Bu yüzden brüt kâr / faaliyet kârı / FAVÖK için TAM SIFIR değerler eksik
sayılır. Kural satış ve net kâra uygulanmaz: orada sıfır (ya da negatif) gerçekten
olabilir ve anlamlıdır.

## Neden taramanın içinde değil, ayrı bir script

Finansal veri sembol başına ayrı bir istek demek — 610 sembolde taramaya ~5 dakika
ekler. Oysa bilanço **çeyrekte bir** değişir. Sektör haritasıyla aynı desen izlenir:
`scripts/build_financials.py` üretir, repoya commit'lenir, tarama sadece okur ve
hiç ek istek atmaz.
"""

import json
from functools import lru_cache
from pathlib import Path

from app.data.yahoo_http import YahooHttpClient, raw_value

FINANCIALS_PATH = Path(__file__).resolve().parent / "financials.json"

QUOTE_MODULES = ["incomeStatementHistoryQuarterly"]

# Yahoo alan adı -> bizim alan adımız
INCOME_FIELDS = {
    "totalRevenue": "revenue",
    "grossProfit": "gross_profit",
    "operatingIncome": "operating_income",
    "ebit": "ebit",
    "netIncome": "net_income",
}


# Yahoo'nun raporlamadığı kalemi 0 ile doldurduğu alanlar (bkz. modül başlığı).
# Satış ve net kâr bilinçli olarak DIŞARIDA: orada sıfır gerçek bir sonuç olabilir.
ZERO_MEANS_MISSING = ("gross_profit", "operating_income", "ebit")


def _margin(numerator: float | None, denominator: float | None) -> float | None:
    """Marj oranı. Satış sıfır/negatifse None — bölme sonucu anlamsız olurdu."""
    if numerator is None or not denominator or denominator <= 0:
        return None
    return round(numerator / denominator, 4)


def parse_quarters(payload: dict | None) -> list[dict]:
    """quoteSummary yanıtından çeyrek listesi (eskiden yeniye sıralı).

    Yahoo çeyrekleri yeniden eskiye döndürüyor; burada ters çevrilir çünkü hem
    grafik hem "önceki çeyreğe göre" hesabı kronolojik sıra bekler.
    """
    statements = ((payload or {}).get("incomeStatementHistoryQuarterly") or {}).get(
        "incomeStatementHistory"
    ) or []

    quarters: list[dict] = []
    for statement in statements:
        period = (statement.get("endDate") or {}).get("fmt")
        if not period:
            continue
        row = {"period": period}
        for source_field, target_field in INCOME_FIELDS.items():
            value = raw_value(statement.get(source_field))
            if value == 0 and target_field in ZERO_MEANS_MISSING:
                value = None
            row[target_field] = value
        if all(row[field] is None for field in INCOME_FIELDS.values()):
            continue  # tamamen boş çeyrek: dönem etiketinden ibaret, taşımanın anlamı yok
        row["gross_margin"] = _margin(row["gross_profit"], row["revenue"])
        row["operating_margin"] = _margin(row["operating_income"], row["revenue"])
        row["net_margin"] = _margin(row["net_income"], row["revenue"])
        quarters.append(row)

    quarters.sort(key=lambda q: q["period"])
    return quarters


def summarize(quarters: list[dict]) -> dict:
    """Çeyrek listesinden özet: son çeyrek, çeyreklik değişim ve TTM toplamları.

    TTM yalnızca DÖRT çeyrek varsa hesaplanır. Üç çeyrekle "son 12 ay" demek
    rakamı olduğundan küçük gösterirdi; eksikse alan None kalır.
    """
    if not quarters:
        return {}

    latest = quarters[-1]
    previous = quarters[-2] if len(quarters) > 1 else None

    def change(field: str) -> float | None:
        if not previous:
            return None
        old, new = previous.get(field), latest.get(field)
        if old is None or new is None or old == 0:
            return None
        # Zarardan kâra geçişte yüzde değişim işaret hatası verir (negatif bölen),
        # mutlak değere bölünerek yön korunur.
        return round((new - old) / abs(old), 4)

    complete = len(quarters) >= 4 and all(q.get("revenue") is not None for q in quarters[-4:])
    ttm_revenue = sum(q["revenue"] for q in quarters[-4:]) if complete else None
    ttm_net = (
        sum(q["net_income"] for q in quarters[-4:])
        if len(quarters) >= 4 and all(q.get("net_income") is not None for q in quarters[-4:])
        else None
    )

    return {
        "period": latest["period"],
        "revenue": latest.get("revenue"),
        "net_income": latest.get("net_income"),
        "gross_margin": latest.get("gross_margin"),
        "operating_margin": latest.get("operating_margin"),
        "net_margin": latest.get("net_margin"),
        "revenue_change_qoq": change("revenue"),
        "net_income_change_qoq": change("net_income"),
        "ttm_revenue": ttm_revenue,
        "ttm_net_income": ttm_net,
        "quarters": quarters,
    }


def fetch_financials(symbol: str, client: YahooHttpClient) -> dict:
    """Tek sembolün finansal özeti. Veri yoksa boş sözlük."""
    return summarize(parse_quarters(client.quote_summary(symbol, QUOTE_MODULES)))


@lru_cache(maxsize=1)
def load_financials() -> dict:
    """Repodaki statik finansal özet haritası. Dosya yoksa boş döner."""
    if not FINANCIALS_PATH.exists():
        print(f"[FİNANSAL] {FINANCIALS_PATH} yok; finansal alanlar boş kalacak")
        return {}
    try:
        return json.loads(FINANCIALS_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"[FİNANSAL] okunamadı ({e}); finansal alanlar boş kalacak")
        return {}


def financials_of(symbol: str) -> dict | None:
    return (load_financials().get("symbols") or {}).get(symbol)
