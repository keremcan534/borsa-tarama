"""Temettü takvimi: geçmiş ödemeler + yaklaşan temettü tarihleri.

Neden ayrı bir sayfa: site bugüne kadar saf teknikti; oysa BIST yatırımcısının
en çok baktığı rakamlardan biri temettü verimidir. Teknik olarak güçlü bir hisse
temettü de ödüyorsa bu ek bir bilgidir, filtre değildir.

**Ek veri maliyeti YOK.** Ödemeler günlük fiyat isteğiyle aynı yanıtta geliyor
(`YFinanceFetcher.fetch_ohlcv` cache'liyor), yaklaşan ex-tarih ise temel oranlar
için zaten yapılan `.info` çağrısından düşüyor. Bu modül yalnızca hesap yapar.

**Verim burada YENİDEN hesaplanır**, yfinance'in `dividendYield` alanı olduğu
gibi alınmaz: kaynağın alanı bazen bayat ya da yıllıklandırılmış tahmindir.
Son 12 ayda GERÇEKTEN ödenen tutarın güncel fiyata oranı, kullanıcının
doğrulayabileceği tek tanımdır (ödeme listesi de yanında gösterilir).
"""

from datetime import date, datetime, timedelta

from app.data.fetchers.base import BaseFetcher

# Yaklaşan temettü penceresi: bundan uzaktaki bir ex-tarih "takvim" değil tahmindir.
UPCOMING_WINDOW_DAYS = 90


def _parse(day: str) -> date | None:
    try:
        return datetime.strptime(day, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def summarize_dividends(
    payments: list[list],
    close: float | None,
    info: dict | None = None,
    today: date | None = None,
) -> dict | None:
    """Tek bir sembolün ödeme listesinden temettü özetini çıkarır.

    Hiç ödeme yoksa ve yaklaşan bir tarih de yoksa None döner — temettü ödemeyen
    şirket takvimde hiç görünmemeli (boş satır bilgi değil, gürültüdür).
    """
    today = today or date.today()
    info = info or {}

    parsed = [(_parse(d), float(a)) for d, a in (payments or [])]
    parsed = [(d, a) for d, a in parsed if d is not None and a > 0]
    parsed.sort(key=lambda x: x[0])

    ex_date = info.get("ex_date")
    ex_parsed = _parse(ex_date) if ex_date else None
    # `.info`'daki ex-tarih GEÇMİŞ de olabilir (son ödeme). Yalnızca ileri tarihli
    # ve makul pencere içindekini "yaklaşan" sayarız.
    upcoming = None
    if ex_parsed and today <= ex_parsed <= today + timedelta(days=UPCOMING_WINDOW_DAYS):
        upcoming = ex_parsed.strftime("%Y-%m-%d")

    if not parsed and not upcoming:
        return None

    year_ago = today - timedelta(days=365)
    ttm = sum(a for d, a in parsed if d >= year_ago)

    by_year: dict[str, float] = {}
    for d, a in parsed:
        key = str(d.year)
        by_year[key] = round(by_year.get(key, 0.0) + a, 6)

    last_date, last_amount = parsed[-1] if parsed else (None, None)

    return {
        # 12 ay içinde ödeme yoksa 0 değil None: tabloda "0,00" görmek, sıfır lira
        # ödendiği anlamına gelir; oysa gerçek durum "bu dönemde ödeme yok"tur.
        "ttm": round(ttm, 6) if ttm > 0 else None,
        # Verim yalnızca fiyat varken hesaplanır; fiyatsız bir "%" uydurmaktansa boş bırakılır.
        "yield_ttm": round(ttm / close, 6) if (parsed and close and close > 0 and ttm > 0) else None,
        "last_date": last_date.strftime("%Y-%m-%d") if last_date else None,
        "last_amount": round(last_amount, 6) if last_amount is not None else None,
        "next_ex_date": upcoming,
        "days_to_ex": (ex_parsed - today).days if upcoming else None,
        "payout_ratio": info.get("payout_ratio"),
        "years_paid": len(by_year),
        "by_year": dict(sorted(by_year.items())[-6:]),
        "payments": [[d.strftime("%Y-%m-%d"), round(a, 6)] for d, a in parsed[-24:]],
    }


def build_dividend_payload(
    rows: list[dict],
    fetcher: BaseFetcher,
    today: date | None = None,
) -> dict:
    """Taranan hisselerden temettü takvimi payload'ı üretir.

    `rows`: günlük taramanın çıktısı ({"symbol", "market", "close", "name"?}).
    Temettü ödemeyen semboller listeye hiç girmez.
    """
    today = today or date.today()
    items: list[dict] = []

    for row in rows:
        symbol = row.get("symbol")
        if not symbol:
            continue
        try:
            payments = fetcher.fetch_dividends(symbol)
            info = fetcher.fetch_dividend_info(symbol)
        except Exception as e:  # tek sembol yüzünden takvim tamamen düşmesin
            print(f"[TEMETTÜ] {symbol} atlandı: {e}")
            continue

        summary = summarize_dividends(payments, row.get("close"), info, today)
        if summary is None:
            continue

        items.append(
            {
                "symbol": symbol,
                "market": row.get("market"),
                "close": row.get("close"),
                "sector": row.get("sector"),
                **summary,
            }
        )

    # Sıralama verime göre: takvimin ana sorusu "hangisi ne kadar ödüyor".
    items.sort(key=lambda x: (x["yield_ttm"] is None, -(x["yield_ttm"] or 0)))

    upcoming = sorted(
        (i for i in items if i["next_ex_date"]),
        key=lambda x: x["next_ex_date"],
    )

    return {
        "count": len(items),
        "upcoming_count": len(upcoming),
        "items": items,
        # Arayüz "yaklaşanlar" şeridini bundan çizer; aynı kayıtlara referans.
        "upcoming": [i["symbol"] for i in upcoming],
    }
