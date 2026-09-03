"""Fonun ERTESİ GÜN yayımlanacak getirisinin tahmini.

## Neden mümkün — mekanizma

TEFAS fon fiyatını BİR GÜN GECİKMELİ yayımlar: bugün piyasada olan hareket,
fonun yarın açıklanacak fiyatına yansır. Bu bir varsayım değil, veriyle
ölçüldü (674 fon, ~250 işlem günü):

    BIST 100 ile korelasyon      aynı gün      bir gün gecikmeli
    hisse senedi fonları           -0,00              +0,90
    endeks fonları                 +0,00              +0,94

Aynı günkü korelasyonun sıfır olması gecikmenin TAM olduğunu gösterir. Yani
"yarınki fon getirisi" tahmini bir kehanet değil, bugün zaten gerçekleşmiş
piyasa hareketinin fona ne kadar geçeceğinin hesabı.

## Yöntem

Fonun kendi geçmişinden, gecikmeli faktörlere doğrusal regresyon:

    getiri[t] ≈ α + β1·BIST[t-1] + β2·ALTIN_TL[t-1] + β3·USD[t-1]

Katsayılar fonun kendi verisinden çıkar; hiçbir fon için elle kural yazılmaz.

Altın ONS (USD) olarak girer, TL'ye çevrilmiş olarak değil: TL altın zaten
USD kurunu içerdiğinden iki faktör birbirine geçiyor ve katsayılar
yorumlanamaz hale geliyordu (ölçüldü — bir gümüş fonunda USD katsayısı
-3,66 çıkıyordu, çünkü TL-altının içindeki kuru geri çıkarıyordu). Ons +
kur ayrı verilince katsayılar anlamını koruyor; doğruluk birebir aynı
(medyan kazanç %32,3, medyan yön %81, kapıyı geçen 386 fon — iki kurulumda
da aynı).

## Neden her fona tahmin YAZILMAZ

Model her kategoride çalışmıyor ve bunu gizlemek yerine ölçüp eliyoruz.
Örneklem dışı (son %20 gün) ölçüm:

    endeks   MAE %0,51  "değişmez" tabanına göre %46 iyi   yön %87
    para p.  MAE %0,05                              %67    yön %100
    hisse    MAE %0,53                              %37    yön %79
    yabancı  MAE %0,24                               %0    yön %64   <- beceri YOK
    serbest                                         %20    R2 -0,04  <- beceri YOK

Yabancı fonlar yurt dışı endeksleri izliyor, serbest fonların stratejisi
açıklanmıyor; ikisi de bu üç faktörle açıklanamıyor. Bu fonlara tahmin
BASILMAZ. Rakiplerin yaptığı gibi her fona dört ondalıklı bir sayı yazmak
(örn. "-11,5853%") ölçülmemiş bir kesinlik iddiasıdır.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

# Tahmin yayımlanması için asgari geçmiş (işlem günü).
MIN_HISTORY = 120

# Örneklem dışı ölçüm için ayrılan kuyruk oranı.
HOLDOUT = 0.2

# Kalite kapısı: tahmin, "hiç değişmeyecek" demeye göre en az bu kadar daha
# isabetli olmalı (ortalama mutlak hata cinsinden) VE yönü bu oranda tutmalı.
MIN_MAE_GAIN = 0.25
MIN_DIRECTION = 0.60

FACTORS = ("bist", "gold", "usd")


@dataclass(frozen=True)
class FundForecast:
    """Tek fonun ertesi gün tahmini ve o tahminin ölçülmüş kalitesi."""

    change: float           # beklenen getiri (oran, 0.0075 = %0,75)
    band: float             # ± belirsizlik (örneklem dışı ortalama mutlak hata)
    direction_rate: float   # örneklem dışı yön isabeti (0-1)
    mae_gain: float         # tabana göre iyileşme (0-1)
    samples: int            # modelin kurulduğu gün sayısı
    driver: str             # en baskın etken (arayüzde "neden" cevabı)
    as_of: str              # tahminin dayandığı piyasa günü


def daily_returns(points: list[tuple[str, float]] | dict[str, float]) -> dict[str, float]:
    """{tarih: kapanış} -> {tarih: o güne ait getiri}."""
    series = dict(points) if not isinstance(points, dict) else points
    days = sorted(series)
    out: dict[str, float] = {}
    for prev, cur in zip(days, days[1:]):
        base = series[prev]
        if base:
            out[cur] = series[cur] / base - 1
    return out


def latest_common_day(factor_ret: dict[str, dict[str, float]]) -> str | None:
    """Tüm faktörlerin birlikte bulunduğu en son gün.

    Faktör başına ayrı ayrı "en son gün" almak yanlış olurdu: kur serisi
    borsadan bir gün ileride bitebiliyor ve tahmin iki farklı günün
    hareketini karıştırırdı (ölçüldü: BIST 27 Ağustos'ta biterken USD
    28 Ağustos'ta bitiyordu).
    """
    common = set.intersection(*(set(v) for v in factor_ret.values())) if factor_ret else set()
    return max(common) if common else None


def _design(
    fund_ret: dict[str, float],
    factor_ret: dict[str, dict[str, float]],
    factor_days: list[str],
) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Fon gününü BİR ÖNCEKİ işlem gününün faktörleriyle eşler."""
    import bisect

    rows, target, used = [], [], []
    for day in sorted(fund_ret):
        idx = bisect.bisect_left(factor_days, day)
        if idx == 0:
            continue
        prev = factor_days[idx - 1]
        values = [factor_ret[name].get(prev) for name in FACTORS]
        if any(v is None for v in values):
            continue
        rows.append([1.0, *values])
        target.append(fund_ret[day])
        used.append(day)
    return np.array(rows), np.array(target), used


def fit_forecast(
    fund_ret: dict[str, float],
    factor_ret: dict[str, dict[str, float]],
    as_of: str | None = None,
) -> FundForecast | None:
    """Fonun modelini kurar ve ertesi gün tahminini döndürür.

    Kalite kapısını geçemeyen fon için `None` döner — tahmin yazılmaz.
    """
    as_of = as_of or latest_common_day(factor_ret)
    if not as_of:
        return None
    factor_days = sorted(set().union(*(set(v) for v in factor_ret.values())))
    X, y, _ = _design(fund_ret, factor_ret, factor_days)
    if len(y) < MIN_HISTORY:
        return None

    # Örneklem dışı ölçüm: eski günlerde kur, son günlerde sına.
    cut = int(len(y) * (1 - HOLDOUT))
    if cut < 60 or len(y) - cut < 20:
        return None
    beta_train, *_ = np.linalg.lstsq(X[:cut], y[:cut], rcond=None)
    pred = X[cut:] @ beta_train
    actual = y[cut:]
    mae = float(np.mean(np.abs(pred - actual)))
    naive = float(np.mean(np.abs(actual)))  # "değişmeyecek" tabanı
    if naive <= 0:
        return None
    gain = 1 - mae / naive
    direction = float(np.mean(np.sign(pred) == np.sign(actual)))
    if gain < MIN_MAE_GAIN or direction < MIN_DIRECTION:
        return None

    # Yayımlanacak katsayılar TÜM veriyle yeniden kurulur; kalite ölçüsü ise
    # yukarıdaki örneklem dışı sınavdan gelir.
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    values = [factor_ret[name].get(as_of) for name in FACTORS]
    if any(v is None for v in values):
        return None
    change = float(beta[0] + sum(b * v for b, v in zip(beta[1:], values)))

    # Sürücü: en büyük mutlak katkı. SABİT TERİM de aday — para piyasası
    # fonlarının günlük getirisi piyasadan değil birikimden (faiz taşıma)
    # gelir; onu "usd" diye etiketlemek yanlış olurdu.
    contributions = {name: abs(b * v) for name, b, v in zip(FACTORS, beta[1:], values)}
    contributions["birikim"] = abs(float(beta[0]))
    driver = max(contributions, key=contributions.get)

    return FundForecast(
        change=change,
        band=mae,
        direction_rate=direction,
        mae_gain=gain,
        samples=len(y),
        driver=driver,
        as_of=as_of,
    )
