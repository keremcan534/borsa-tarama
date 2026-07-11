import pandas as pd
import yfinance as yf

from .base import BaseFetcher


class YFinanceFetcher(BaseFetcher):
    """
    yfinance üzerinden veri çeker.
    - BIST sembol formatı: 'THYAO.IS', 'ASELS.IS' ...
    - S&P 500 sembol formatı: 'AAPL', 'MSFT' ...

    NOT: yfinance ücretsiz ve pratik ama resmi bir API değil; rate-limit'e
    takılabilir ve BIST verisinde zaman zaman gecikme/eksiklik olabilir.
    Üretimde bu sınıfı değiştirmeden, BaseFetcher'ı implemente eden başka
    bir fetcher (örn. İş Yatırım, Finnhub, Alpha Vantage) yazıp
    engine.py'a onu enjekte edebilirsin.
    """

    def fetch_ohlcv(self, symbol: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval)

        if df.empty:
            raise ValueError(f"{symbol} için veri bulunamadı")

        df = df.rename(columns=str.lower)
        df = df.dropna(subset=["close"])
        return df[["open", "high", "low", "close", "volume"]]

    def fetch_market_cap(self, symbol: str) -> float | None:
        ticker = yf.Ticker(symbol)
        try:
            return ticker.fast_info["market_cap"]
        except Exception:
            info = ticker.info or {}
            return info.get("marketCap")
