"""Günlük mumlardan haftalık/aylık/çeyreklik mum üretimi.

Neden var: tarama her sembolü zaman dilimi başına ayrı çekiyordu — günlük, haftalık,
aylık, çeyreklik için dört ayrı istek. Oysa uzun periyotların hepsi günlük veriden
türetilebilir. Bu modül türetmeyi yapar, `YFinanceFetcher` de sembol başına tek
`max` günlük istek atıp gerisini buradan üretir: **istek sayısı 4'e bölünür.**

İki tasarım kararı, ikisi de "Yahoo ne döndürürdü?" sorusuna göre alındı — çünkü
üretilen mum, daha önce Yahoo'dan gelen mumun yerine geçiyor ve göstergeler
(EMA/RSI/Stokastik) mumun kendisine değil, mum SERİSİNE bakıyor:

1. **Kova sınırı takvimseldir, kayan pencere değil.** Haftalık mum pazartesi-pazar
   takvim haftasıdır; "son 5 işlem günü" değil. Kayan pencere kullanılsaydı serideki
   mum sayısı işlem günü sayısına bağlı olurdu ve tatil haftaları seriyi kaydırırdı.

2. **Mumun tarihi, kovanın TAKVİM BAŞLANGICIdır — ilk işlem günü değil.** Bu kural
   tahminle değil ölçümle seçildi: THYAO/AKBNK/AAPL'ın 10 yıllık haftalık ve aylık
   mumları Yahoo'dan çekilip karşılaştırıldı. Fark tatillerde ortaya çıkıyor —
   2016-09-05 (Labor Day) pazartesi tatil olduğunda Yahoo haftayı yine 09-05 diye
   etiketliyor, ilk işlem günü olan 09-06 diye değil; aylıkta 2017-01-01 pazar olsa
   bile ay 01-01 etiketli. İlk işlem gününe etiketleseydik 10 yılda haftalıkta 14,
   aylıkta 46 mumun tarihi kayardı. `drop_in_progress_bar` mumun tarihine bakıp
   "bu hafta/ay kapandı mı?" diye karar verdiğinden, kayan etiket sinyali de kaydırırdı.

Hacim toplanır, açılış ilk günün açılışı, kapanış son günün kapanışıdır; yüksek/düşük
kovanın uç değerleridir. Bölünme onarımı (`app/data/repair.py`) GÜNLÜK seride, yani
bu birleştirmeden ÖNCE çalışır: onarım tek mumdaki sıçramayı arar, haftalık mumda o
sıçrama komşu günlerle ortalanıp görünmez hale gelirdi.

## Yahoo ile ölçülen fark (THYAO/AKBNK/AAPL, 10 yıl, 2026-08)

Haftalık ve aylıkta 522 mumun 522'si aynı tarihe oturuyor. Değerler AAPL'da dört
alanda da birebir. BIST'te 522 mumun 7-8'inde açılış/en düşük sapıyor ve sapan
mumların **hepsi tatil ya da işlem durması haftası**: 2020-05-25 ve 2022-05-02
(Ramazan), 2020-08-03 ve 2022-07-11 (Kurban), 2021-08-30 (30 Ağustos),
2024-01-01, 2025-03-31 — yani takvim pazartesisinin tatil olduğu haftalar.
Yahoo o haftalarda mumu yine pazartesiye etiketliyor ama açılışı ilk işlem
gününün açılışından almıyor; bizim değerimiz doğrudan günlük mumdan gelir.

Kapanışta tek istisna 2023-02-06 haftası (AKBNK: bizde 13,70, Yahoo'da 14,70):
borsa 8 Şubat 2023'te deprem nedeniyle seans içinde kapandı, Yahoo o günü haftalık
muma katmıyor. Filtreler kapanışa baktığından pratik etki bu tek muma sınırlı.

**Çeyreklikte bilinçli olarak Yahoo'dan AYRILIYORUZ.** Yahoo'nun `3mo` mumu takvim
çeyreği değil; çapası istenen aralığa göre kayıyor — aynı sembol için `range=5y`
Ağustos/Kasım/Şubat/Mayıs, `range=10y` yine Ağustos ama `max` bambaşka bir ay
üretir. Yani Yahoo'da bir sembolün çeyreklik mumu, o sembolün ilk işlem ayına
bağlıdır ve semboller arasında karşılaştırılamaz. Biz takvim çeyreği kullanıyoruz
(Ocak/Nisan/Temmuz/Ekim): "çeyreklik" kelimesinin anlamı bu ve tüm sembollerde aynı.
"""

import re
import warnings

import pandas as pd

# Yahoo interval kodu -> pandas dönem frekansı.
# "W-SUN": pazartesi-pazar takvim haftası (pandas'ın haftalık dönemi pazar biter).
INTERVAL_TO_PERIOD_FREQ: dict[str, str] = {
    "1wk": "W-SUN",
    "1mo": "M",
    "3mo": "Q",
}

OHLCV_AGG = {"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"}

# "5y", "10y", "6mo", "250d" gibi Yahoo periyot kodları
_PERIOD_RE = re.compile(r"^(\d+)(d|wk|mo|y)$")

_PERIOD_UNIT_DAYS = {"d": 1, "wk": 7, "mo": 30.44, "y": 365.25}


def resample_ohlcv(df: pd.DataFrame, interval: str) -> pd.DataFrame:
    """Günlük OHLCV'yi hedef `interval`'a (1wk/1mo/3mo) birleştirir.

    `interval="1d"` verilirse veri olduğu gibi döner. Bilinmeyen bir interval
    ValueError atar: sessizce günlük döndürmek, çağıranın haftalık sandığı bir
    seriyle gösterge hesaplamasına yol açardı.
    """
    if interval == "1d":
        return df
    if interval not in INTERVAL_TO_PERIOD_FREQ:
        raise ValueError(f"desteklenmeyen interval: {interval}")
    if df.empty:
        return df

    freq = INTERVAL_TO_PERIOD_FREQ[interval]
    # to_period tz bilgisini düşürür ve uyarır; sorun değil çünkü index'i aşağıda
    # ORİJİNAL (tz'li) tarihlerden yeniden kuruyoruz. Uyarı bastırılmazsa tarama
    # logunda sembol x zaman dilimi kadar (binlerce) satır üretir.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        keys = df.index.to_period(freq)

    columns = [c for c in OHLCV_AGG if c in df.columns]
    out = df.groupby(keys, sort=True).agg({c: OHLCV_AGG[c] for c in columns})

    # Kovanın takvim başlangıcı (ilk işlem günü değil) — bkz. modül başlığı 2. madde.
    out.index = pd.DatetimeIndex(out.index.start_time, name=df.index.name)
    tz = getattr(df.index, "tz", None)
    if tz is not None:
        out.index = out.index.tz_localize(tz)

    return out.dropna(subset=["close"]) if "close" in out.columns else out


def period_to_days(period: str) -> float | None:
    """Yahoo periyot kodunu güne çevirir. "max" ve tanınmayan kodlar için None."""
    if period == "max":
        return None
    match = _PERIOD_RE.match(period)
    if not match:
        return None
    amount, unit = match.groups()
    return int(amount) * _PERIOD_UNIT_DAYS[unit]


def slice_period(df: pd.DataFrame, period: str, now: pd.Timestamp | None = None) -> pd.DataFrame:
    """`max` günlük veriyi istenen periyoda kırpar (Yahoo `period=` karşılığı).

    Kırpma BUGÜNden geriye yapılır, serinin son mumundan değil — Yahoo da böyle
    davranır. Uzun süredir işlem görmeyen bir sembolde son mumdan geriye saymak
    istenenden fazla veri döndürürdü.
    """
    days = period_to_days(period)
    if days is None or df.empty:
        return df

    tz = getattr(df.index, "tz", None)
    if now is None:
        now = pd.Timestamp.now(tz=tz) if tz is not None else pd.Timestamp.now()
    return df[df.index >= now - pd.Timedelta(days=days)]
