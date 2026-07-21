"""Makro panel: kur, faiz, emtia ve endekslerin tek ekranda özeti.

Neden gerekli: site hisse/fon tarafında derin ama "BIST neden düşüyor?" sorusunun
cevabı çoğu zaman hissede değil dolarda, tahvil faizinde ya da petroldedir.
Bu modül ~10 enstrümanı tek seferde çeker (tarama başına 10 istek — 600 sembollük
taramanın yanında ihmal edilebilir) ve her biri için:

- son değer + 1g / 1h / 1a / 3a / YBB / 1y değişim (**her yüzde dönemini taşır**),
- 1 yıllık seri (arayüzdeki mini grafik için, haftalık seyreltilmiş),
- BIST 100 ile **90 günlük getiri korelasyonu**.

Korelasyon bilinçli olarak GÜNLÜK GETİRİ üzerinden hesaplanır, fiyat seviyesi
üzerinden değil: iki yükselen seri seviyede neredeyse her zaman yüksek korelasyon
verir (sahte ilişki), getiri korelasyonu ise gerçekten birlikte hareket edip
etmediklerini ölçer.
"""

import pandas as pd

from app.data.fetchers.base import BaseFetcher

GRAMS_PER_OUNCE = 31.1034768

# (anahtar, sembol, TR ad, EN ad, grup, birim)
MACRO_INSTRUMENTS: list[dict] = [
    {"key": "usdtry", "symbol": "USDTRY=X", "name": "Dolar/TL", "name_en": "USD/TRY", "group": "fx", "unit": "₺"},
    {"key": "eurtry", "symbol": "EURTRY=X", "name": "Euro/TL", "name_en": "EUR/TRY", "group": "fx", "unit": "₺"},
    {"key": "dxy", "symbol": "DX-Y.NYB", "name": "Dolar Endeksi", "name_en": "Dollar Index", "group": "fx", "unit": ""},
    {"key": "xu100", "symbol": "XU100.IS", "name": "BIST 100", "name_en": "BIST 100", "group": "index", "unit": ""},
    {"key": "spx", "symbol": "^GSPC", "name": "S&P 500", "name_en": "S&P 500", "group": "index", "unit": ""},
    {"key": "vix", "symbol": "^VIX", "name": "VIX (korku endeksi)", "name_en": "VIX (fear index)", "group": "index", "unit": ""},
    {"key": "us10y", "symbol": "^TNX", "name": "ABD 10Y Faiz", "name_en": "US 10Y Yield", "group": "rate", "unit": "%"},
    {"key": "gold", "symbol": "GC=F", "name": "Altın (ons, $)", "name_en": "Gold (oz, $)", "group": "commodity", "unit": "$"},
    {"key": "brent", "symbol": "BZ=F", "name": "Brent Petrol", "name_en": "Brent Crude", "group": "commodity", "unit": "$"},
    {"key": "btc", "symbol": "BTC-USD", "name": "Bitcoin", "name_en": "Bitcoin", "group": "crypto", "unit": "$"},
]

# Değişim pencereleri: (alan adı, kaç işlem günü geriye). YBB ayrıca hesaplanır.
CHANGE_WINDOWS = [("change_1d", 1), ("change_1w", 5), ("change_1m", 21), ("change_3m", 63), ("change_1y", 252)]

# Korelasyon penceresi (işlem günü). 90 gün ~ bir çeyrek: ilişkinin "şu anki"
# halini yansıtacak kadar kısa, gürültüye boğulmayacak kadar uzun.
CORRELATION_BARS = 90

BIST_KEY = "xu100"


def _pct_change(closes: pd.Series, bars: int) -> float | None:
    if len(closes) <= bars:
        return None
    previous = float(closes.iloc[-1 - bars])
    if previous <= 0:
        return None
    return round(float(closes.iloc[-1]) / previous - 1, 4)


def _ytd_change(closes: pd.Series) -> float | None:
    """Yılbaşından bugüne: yılın İLK işlem gününün kapanışı referans alınır."""
    if closes.empty:
        return None
    year = closes.index[-1].year
    this_year = closes[closes.index.year == year]
    if len(this_year) < 2:
        return None
    first = float(this_year.iloc[0])
    if first <= 0:
        return None
    return round(float(this_year.iloc[-1]) / first - 1, 4)


def _thin_series(closes: pd.Series, max_points: int = 120) -> list[list]:
    """1 yıllık günlük seriyi mini grafik için seyreltir (payload'ı şişirmemek için)."""
    if closes.empty:
        return []
    step = max(1, len(closes) // max_points)
    thinned = closes.iloc[::step]
    # Son nokta her zaman korunmalı: grafiğin ucu güncel değeri göstermeli.
    if thinned.index[-1] != closes.index[-1]:
        thinned = pd.concat([thinned, closes.iloc[[-1]]])
    return [[ts.strftime("%Y-%m-%d"), round(float(v), 4)] for ts, v in thinned.items()]


def _gram_gold(gold_usd: pd.Series, usdtry: pd.Series) -> pd.Series | None:
    """Gram altın (TL) = ons altın ($) x kur / 31,1035.

    İki seri farklı takvimlerde (BIST tatili / ABD tatili) olabildiğinden ortak
    tarihlerde hizalanır; eksik günü son bilinen değerle doldurmak, tatilde
    olmayan bir fiyat hareketi uydururdu.
    """
    if gold_usd is None or usdtry is None or gold_usd.empty or usdtry.empty:
        return None
    gold = gold_usd.copy()
    fx = usdtry.copy()
    gold.index = gold.index.tz_localize(None) if gold.index.tz is not None else gold.index
    fx.index = fx.index.tz_localize(None) if fx.index.tz is not None else fx.index
    gold.index = gold.index.normalize()
    fx.index = fx.index.normalize()
    common = gold.index.intersection(fx.index)
    if len(common) < 30:
        return None
    return (gold.loc[common] * fx.loc[common] / GRAMS_PER_OUNCE).sort_index()


def _correlation(a: pd.Series, b: pd.Series, bars: int = CORRELATION_BARS) -> float | None:
    """İki serinin son `bars` günlük GETİRİ korelasyonu (seviye değil, getiri)."""
    if a is None or b is None or a.empty or b.empty:
        return None
    x, y = a.copy(), b.copy()
    for s in (x, y):
        if s.index.tz is not None:
            s.index = s.index.tz_localize(None)
    x.index, y.index = x.index.normalize(), y.index.normalize()
    common = x.index.intersection(y.index)
    if len(common) < 30:
        return None
    rx = x.loc[common].pct_change().dropna().tail(bars)
    ry = y.loc[common].pct_change().dropna().tail(bars)
    if len(rx) < 20 or len(ry) < 20:
        return None
    value = rx.corr(ry)
    return None if pd.isna(value) else round(float(value), 3)


# Grafik penceresi: kartlardaki mini grafik son ~1 yılı gösterir. Veri bundan
# UZUN çekilir (aşağıdaki period) çünkü "1 yıllık değişim" 252 işlem günü geriye
# bakar; tam 1 yıl çekilse o alan sınırda kalıp çoğu enstrümanda boş dönüyordu.
CHART_BARS = 252


def build_macro_payload(fetcher: BaseFetcher, period: str = "2y") -> dict:
    """Tüm makro enstrümanları çeker ve panel payload'ını üretir.

    Bir enstrüman çekilemezse yalnızca o kart düşer; panel yine yayınlanır
    (eksik veriyi sessizce uydurmaktansa göstermemek doğru davranıştır).
    """
    closes: dict[str, pd.Series] = {}

    for inst in MACRO_INSTRUMENTS:
        try:
            df = fetcher.fetch_ohlcv(inst["symbol"], period=period, interval="1d")
            series = df["close"].dropna()
            if len(series) >= 30:
                closes[inst["key"]] = series
            else:
                print(f"[MAKRO] {inst['symbol']} yetersiz veri ({len(series)} bar); atlandı")
        except Exception as e:
            print(f"[MAKRO] {inst['symbol']} çekilemedi ({e}); kart gösterilmeyecek")

    instruments = list(MACRO_INSTRUMENTS)

    # Gram altın türetilmiş bir seridir (ayrı istek yok): TL yatırımcısının altını
    # onstan değil gramdan takip etmesi yüzünden panelde ayrı kart hak ediyor.
    gram = _gram_gold(closes.get("gold"), closes.get("usdtry"))
    if gram is not None:
        closes["gramgold"] = gram
        instruments.insert(
            3,
            {
                "key": "gramgold",
                "symbol": "GRAMALTIN",
                "name": "Gram Altın",
                "name_en": "Gram Gold (TRY)",
                "group": "commodity",
                "unit": "₺",
                "derived": True,
            },
        )

    bist = closes.get(BIST_KEY)
    items = []

    for inst in instruments:
        series = closes.get(inst["key"])
        if series is None or series.empty:
            continue
        item = {
            **{k: v for k, v in inst.items() if k != "symbol"},
            "symbol": inst["symbol"],
            "last": round(float(series.iloc[-1]), 4),
            "ytd": _ytd_change(series),
            "series": _thin_series(series.tail(CHART_BARS)),
            # Kendisiyle korelasyon 1.0'dır; anlamsız olduğu için hiç yazılmaz.
            "corr_bist": None if inst["key"] == BIST_KEY else _correlation(series, bist),
        }
        for field, bars in CHANGE_WINDOWS:
            item[field] = _pct_change(series, bars)
        items.append(item)

    return {
        "count": len(items),
        "correlation_bars": CORRELATION_BARS,
        "items": items,
    }
