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

# Endeksin kendi adı: "Bugün" sayfasındaki nabız kartı marketin değil ENDEKSİN
# adını göstermeli — ^GSPC, sp500 kapalıyken ETF marketi üzerinden geliyor ve
# o kartın "ETF" yazması yanlış olurdu.
BENCHMARK_NAMES: dict[str, str] = {
    "XU100.IS": "BIST 100",
    "^GSPC": "S&P 500",
}


def benchmark_summary(df: pd.DataFrame | None, market: str) -> dict | None:
    """Endeksin son kapanışı + son mumdaki değişimi ("Bugün" sayfasındaki nabız kartı).

    Endeksi tarama zaten çektiğinden bunun ek maliyeti yok.
    """
    symbol = BENCHMARKS.get(market)
    if df is None or symbol is None or len(df) < 2:
        return None

    last = float(df["close"].iloc[-1])
    previous = float(df["close"].iloc[-2])
    if previous <= 0:
        return None

    return {
        "symbol": symbol,
        "name": BENCHMARK_NAMES.get(symbol, symbol),
        "close": round(last, 2),
        "change": round(last / previous - 1, 4),
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
