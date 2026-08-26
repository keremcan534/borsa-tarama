"""TÜFE serisi ve reel (enflasyondan arındırılmış) getiri.

Neden gerekli: sitedeki her getiri nominal TL'ydi. Türkiye'de bu tek başına
yanıltıcıdır — yıllık %40 nominal getiri, enflasyon %45'se **kayıptır**. "Kazandım
mı?" sorusunun dürüst cevabı reel getiridir ve rakip platformların çoğunda da yok.

## Kaynak sırası: EVDS varsa o, yoksa OECD

1. **TCMB EVDS** (`EVDS_API_KEY` ortam değişkeni varsa): TÜFE'nin birincil kaynağı,
   TÜİK açıklar açıklamaz güncellenir. Anahtar ücretsiz ama kayıt gerektiriyor.
2. **OECD SDMX** (anahtarsız, varsayılan): aynı TÜİK verisini yayımlar, gecikmeli.
   Ölçüldü (2026-08): seri 2025-12'ye kadar geliyor, yani ~8 ay geride.

Gecikme gizlenmez: `as_of` alanı serinin son ayını taşır ve arayüz bunu gösterir.
**Kapsanmayan dönem için reel getiri hesaplanmaz, None döner.** Eksik ayları
tahmin etmek (son enflasyonu ileri taşımak gibi) sayıyı olduğundan güvenilir
gösterirdi; bu modülde bilinçli olarak yapılmıyor.

FRED'in Türkiye TÜFE serisi (TURCPIALLMINMEI) denendi ve ELENDİ: 2025-04'te
durmuş, OECD'den de eski.

## Reel getiri tanımı

    reel = (1 + nominal) / (TÜFE_bitiş / TÜFE_başlangıç) - 1

Yani nominal getiri, aynı dönemdeki fiyat artışına bölünür. "Nominalden enflasyonu
çıkar" kestirmesi bilinçli olarak kullanılmıyor: yüksek enflasyonda ikisi belirgin
biçimde ayrışır (nominal %80, enflasyon %60 iken çıkarma %20 der, doğrusu %12,5'tir).
"""

import os
from datetime import date

import requests

EVDS_URL = "https://evds2.tcmb.gov.tr/service/evds/series={series}/startDate={start}/endDate={end}/type=json"
EVDS_CPI_SERIES = "TP.FG.J0"  # TÜFE genel endeks

OECD_URL = (
    "https://sdmx.oecd.org/public/rest/data/OECD.SDD.TPS,DSD_PRICES@DF_PRICES_ALL,1.0/"
    "TUR.M.N.CPI.IX._T.N._Z?startPeriod={start}&format=jsondata"
)

SERIES_START_YEAR = 2015
REQUEST_TIMEOUT = 60


def _month_key(value: date | str) -> str:
    """Tarihi "YYYY-MM" anahtarına çevirir (TÜFE aylık yayımlanır)."""
    if isinstance(value, date):
        return value.strftime("%Y-%m")
    return str(value)[:7]


def fetch_cpi_oecd(session: requests.Session | None = None) -> dict:
    """OECD'den aylık TÜFE endeksi. Başarısızsa boş seri."""
    session = session or requests.Session()
    try:
        response = session.get(
            OECD_URL.format(start=f"{SERIES_START_YEAR}-01"),
            headers={"User-Agent": "Mozilla/5.0 (borsa-tarama)"},
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        payload = response.json()["data"]
        dataset = payload["dataSets"][0]
        months = [v["id"] for v in payload["structures"][0]["dimensions"]["observation"][0]["values"]]
    except Exception as e:
        print(f"[TÜFE] OECD serisi alınamadı ({e})")
        return {}

    series: dict[str, float] = {}
    for observations in dataset.get("series", {}).values():
        for index, value in observations.get("observations", {}).items():
            try:
                series[months[int(index)]] = float(value[0])
            except (ValueError, TypeError, IndexError):
                continue
    return series


def fetch_cpi_evds(api_key: str, session: requests.Session | None = None) -> dict:
    """TCMB EVDS'ten aylık TÜFE endeksi. Anahtar gerektirir; başarısızsa boş seri.

    NOT: bu yol bu geliştirme ortamında DOĞRULANAMADI (elde EVDS anahtarı yok).
    Bu yüzden hata durumunda sessizce boş dönüp OECD'ye düşer — anahtar eklendiğinde
    yanlış çalışırsa özellik kaybolmaz, yalnızca gecikmeli veriye geri döner.
    """
    session = session or requests.Session()
    try:
        response = session.get(
            EVDS_URL.format(
                series=EVDS_CPI_SERIES,
                start=f"01-01-{SERIES_START_YEAR}",
                end=date.today().strftime("%d-%m-%Y"),
            ),
            headers={"key": api_key, "User-Agent": "borsa-tarama"},
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        items = response.json().get("items") or []
    except Exception as e:
        print(f"[TÜFE] EVDS serisi alınamadı ({e}); OECD'ye düşülüyor")
        return {}

    series: dict[str, float] = {}
    for item in items:
        raw_date = item.get("Tarih") or ""  # "2026-07" ya da "07-2026"
        value = item.get(EVDS_CPI_SERIES.replace(".", "_"))
        if value in (None, ""):
            continue
        parts = raw_date.split("-")
        if len(parts) != 2:
            continue
        month = f"{parts[0]}-{parts[1]}" if len(parts[0]) == 4 else f"{parts[1]}-{parts[0]}"
        try:
            series[month] = float(value)
        except (TypeError, ValueError):
            continue
    return series


def load_cpi(session: requests.Session | None = None) -> dict:
    """TÜFE serisi + kaynağı + son ayı: {"series", "source", "as_of"}.

    Seri hiç alınamazsa boş `series` döner; çağıranlar bunu "reel getiri
    gösterilemez" diye yorumlamalı, sıfır enflasyon diye DEĞİL.
    """
    api_key = os.environ.get("EVDS_API_KEY", "").strip()
    series, source = {}, None

    if api_key:
        series = fetch_cpi_evds(api_key, session)
        source = "TCMB EVDS" if series else None

    if not series:
        series = fetch_cpi_oecd(session)
        source = "OECD (TÜİK verisi)" if series else None

    as_of = max(series) if series else None
    if series:
        print(f"[TÜFE] {len(series)} aylık gözlem, kaynak {source}, son ay {as_of}")
    return {"series": series, "source": source, "as_of": as_of}


def real_return(nominal_return: float | None, start: date | str, end: date | str, cpi: dict) -> float | None:
    """Nominal getiriyi aynı dönemin enflasyonundan arındırır.

    Dönemin İKİ ucu da TÜFE serisinde yoksa None döner — eksik ucu tahmin etmek,
    bilinmeyeni biliniyormuş gibi göstermek olurdu.
    """
    if nominal_return is None or not cpi:
        return None

    start_cpi = cpi.get(_month_key(start))
    end_cpi = cpi.get(_month_key(end))
    if not start_cpi or not end_cpi or start_cpi <= 0:
        return None

    inflation_factor = end_cpi / start_cpi
    return (1 + nominal_return) / inflation_factor - 1


def inflation_between(start: date | str, end: date | str, cpi: dict) -> float | None:
    """İki ay arasındaki toplam enflasyon (oran). Kapsanmıyorsa None."""
    if not cpi:
        return None
    start_cpi = cpi.get(_month_key(start))
    end_cpi = cpi.get(_month_key(end))
    if not start_cpi or not end_cpi or start_cpi <= 0:
        return None
    return end_cpi / start_cpi - 1
