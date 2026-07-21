import pandas as pd
import yfinance as yf

from app.core.config import settings
from app.data.repair import repair_split_artifacts

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

        # Bölünme bilgisi aynı istekle geldiğinden onarım ek network maliyeti getirmez.
        splits = df["stock splits"] if "stock splits" in df.columns else None
        df, repairs = repair_split_artifacts(df[["open", "high", "low", "close", "volume"]], splits)
        for r in repairs:
            print(f"[ONARIM] {symbol}: {r['date']} tarihinde uygulanmamış {r['split']}:1 bölünme düzeltildi")

        return df

    def __init__(self) -> None:
        # Aynı tarama koşusunda sembol başına tek market-cap isteği atılsın diye
        # instance seviyesinde cache (üç zaman dilimi de aynı değeri paylaşır).
        self._market_cap_cache: dict[str, float | None] = {}
        self._fundamentals_cache: dict[str, dict] = {}

    def fetch_market_cap(self, symbol: str) -> float | None:
        if symbol in self._market_cap_cache:
            return self._market_cap_cache[symbol]

        ticker = yf.Ticker(symbol)
        try:
            value = ticker.fast_info["market_cap"]
        except Exception:
            info = ticker.info or {}
            value = info.get("marketCap")

        self._market_cap_cache[symbol] = value
        return value

    def fetch_fundamentals(self, symbol: str) -> dict:
        """F/K, PD/DD, temettü verimi ve özsermaye kârlılığı.

        `.info` çağrısı `fast_info`'dan pahalıdır (sembol başına ayrı bir istek),
        bu yüzden market-cap gibi instance seviyesinde cache'lenir: üç zaman dilimi
        aynı değeri paylaşır, tarama başına sembol başına tek istek atılır.

        NOT: yfinance'in BIST temel verisi bayat/tutarsız olabiliyor (ör. tek çeyrek
        zararı olan bir şirkette F/K üç haneli çıkabiliyor). Değerler burada
        DÜZELTİLMEZ — arayüz kaynağı belirtip olduğu gibi gösterir; sessizce
        "makul" bir aralığa kırpmak, veriyi olduğundan güvenilir gösterirdi.
        """
        # Kapatılabilir olması bilinçli: yfinance rate-limit'e takılırsa tarama
        # tamamen durmasın, yalnızca temel kolonlar boş kalsın.
        if not settings.fundamentals_enabled:
            return {}

        if symbol in self._fundamentals_cache:
            return self._fundamentals_cache[symbol]

        try:
            info = yf.Ticker(symbol).info or {}
        except Exception as e:
            print(f"[TEMEL] {symbol} temel verisi alınamadı ({e})")
            info = {}

        def num(key):
            v = info.get(key)
            return float(v) if isinstance(v, (int, float)) else None

        out = {
            "pe": num("trailingPE"),
            "pb": num("priceToBook"),
            # yfinance temettü verimini yüzde olarak döner (2.1 = %2,1); arayüzdeki
            # diğer oranlar gibi ondalığa çevrilir (0.021) ki formatPct tutarlı çalışsın.
            "dividend_yield": (lambda v: v / 100 if v is not None else None)(num("dividendYield")),
            "roe": num("returnOnEquity"),
        }
        self._fundamentals_cache[symbol] = out
        return out
