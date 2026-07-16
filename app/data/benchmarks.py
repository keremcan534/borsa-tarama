"""Market -> karşılaştırma endeksi eşlemesi.

Hem backtest (sinyal endeksi yendi mi?) hem tarama (göreli güç kolonu) aynı
endeksi kullanır; tanım tek yerde durmalı ki ikisi farklı şeyi ölçmesin.
"""

import pandas as pd

from app.data.fetchers.base import BaseFetcher

BENCHMARKS: dict[str, str | None] = {
    "bist100": "XU100.IS",
    "sp500": "^GSPC",
    "etf": "^GSPC",
    "commodity": None,  # emtia sepeti için anlamlı tek bir endeks yok
}


def fetch_benchmark(
    market: str,
    fetcher: BaseFetcher,
    period: str,
    interval: str,
) -> pd.DataFrame | None:
    """Marketin endeksini çeker; endeksi yoksa ya da çekilemezse None döner.

    Endeks verisi olmaması taramayı/backtest'i durdurmamalı — yalnızca
    karşılaştırmaya dayalı alanlar boş kalır.
    """
    symbol = BENCHMARKS.get(market)
    if not symbol:
        return None
    try:
        return fetcher.fetch_ohlcv(symbol, period=period, interval=interval)
    except Exception as e:
        print(f"[ENDEKS] {market} için {symbol} çekilemedi: {e}")
        return None
