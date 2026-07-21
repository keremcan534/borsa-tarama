"""Döviz ve altın serileri: TL bazlı getiriyi reel (dolar/altın) bazda göstermek için.

Neden gerekli: yüksek enflasyon ortamında TL bazında "+%50" bir getiri, dolar
bazında kayıp olabilir. Arayüzdeki TL / $ / gram altın anahtarı bu serilerden
beslenir; dönüşüm HER TARİH İÇİN o günün kuruyla yapılır (tek bir güncel kurla
geçmişi çevirmek geçmiş getiriyi tamamen çarpıtırdı).
"""

import pandas as pd

from app.data.fetchers.base import BaseFetcher

# TL/dolar paritesi ve ons altın (USD). Altın gram fiyatı bu ikisinden türetilir.
USDTRY_SYMBOL = "USDTRY=X"
GOLD_SYMBOL = "GC=F"

# 1 troy ons = 31.1034768 gram (gram altın dönüşümü için)
GRAMS_PER_OUNCE = 31.1034768


def _series_points(df: pd.DataFrame | None) -> list[list]:
    """OHLCV DataFrame'i [[YYYY-MM-DD, kapanış], ...] listesine çevirir."""
    if df is None or df.empty or "close" not in df:
        return []
    closes = df["close"].dropna()
    return [[ts.strftime("%Y-%m-%d"), round(float(v), 6)] for ts, v in closes.items()]


def fetch_fx_series(fetcher: BaseFetcher, period: str = "5y") -> dict:
    """USDTRY ve ons altın (USD) günlük serilerini çeker.

    Biri çekilemezse o seri boş döner; arayüz eksik seride ilgili para birimi
    seçeneğini gizler (sessizce yanlış rakam göstermektense seçeneği hiç sunmaz).
    """
    out: dict[str, list[list]] = {}

    for key, symbol in (("usdtry", USDTRY_SYMBOL), ("goldusd", GOLD_SYMBOL)):
        try:
            df = fetcher.fetch_ohlcv(symbol, period=period, interval="1d")
            out[key] = _series_points(df)
        except Exception as e:
            print(f"[FX] {symbol} çekilemedi ({e}); bu seri boş bırakılıyor")
            out[key] = []

    return out
