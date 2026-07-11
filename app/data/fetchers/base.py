from abc import ABC, abstractmethod

import pandas as pd


class BaseFetcher(ABC):
    """
    Farklı veri kaynakları (yfinance, İş Yatırım, Finnhub, Alpha Vantage vb.)
    için ortak arayüz. Kaynak değiştirmek istediğinde sadece bu sınıfı
    implemente eden yeni bir fetcher yazman yeterli, screener/engine.py
    hiç değişmeden çalışır.
    """

    @abstractmethod
    def fetch_ohlcv(self, symbol: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame:
        """OHLCV verisi döner. Kolonlar: open, high, low, close, volume. Index: tarih."""
        ...

    @abstractmethod
    def fetch_market_cap(self, symbol: str) -> float | None:
        """Piyasa değerini döner (büyükten küçüğe sıralama için)."""
        ...
