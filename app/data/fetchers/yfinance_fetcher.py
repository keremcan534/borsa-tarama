from datetime import datetime, timezone

import pandas as pd
import yfinance as yf

from app.core.config import settings
from app.data.repair import repair_split_artifacts

from .base import BaseFetcher


def _epoch_to_date(value) -> str | None:
    """yfinance `.info` tarihleri unix saniyesi olarak gelir -> YYYY-MM-DD."""
    if not isinstance(value, (int, float)) or value <= 0:
        return None
    try:
        return datetime.fromtimestamp(float(value), tz=timezone.utc).strftime("%Y-%m-%d")
    except (OverflowError, OSError, ValueError):
        return None


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

        # Temettüler fiyatla AYNI istekte geliyor: günlük mumlarda (en hassas tarih
        # çözünürlüğü) yakalayıp cache'liyoruz, böylece temettü takvimi sembol başına
        # tek bir ek istek bile getirmiyor. Aylık/haftalık mumlarda ödeme tarihi
        # periyoda yuvarlanacağı için bilerek atlanır.
        if interval == "1d" and "dividends" in df.columns:
            paid = df["dividends"]
            paid = paid[paid > 0]
            self._dividends_cache[symbol] = [
                [ts.strftime("%Y-%m-%d"), round(float(v), 6)] for ts, v in paid.items()
            ]

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
        # Fiyat isteğinden düşen temettü ödemeleri (bkz. fetch_ohlcv) ve `.info`
        # çağrısından düşen ileriye dönük temettü alanları (bkz. fetch_fundamentals).
        self._dividends_cache: dict[str, list[list]] = {}
        self._dividend_info_cache: dict[str, dict] = {}

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

    def fetch_dividends(self, symbol: str) -> list[list]:
        """Günlük fiyat isteğinde yakalanan temettü ödemeleri (ek istek yok).

        Sembol henüz günlük mumlarla çekilmediyse boş döner: temettü takvimi
        taramanın YAN ÜRÜNÜdür, kendi başına veri çekmez.
        """
        return self._dividends_cache.get(symbol, [])

    def fetch_dividend_info(self, symbol: str) -> dict:
        """Yaklaşan temettü tarihi vb. — `.info` çağrısı fetch_fundamentals'ta yapılır."""
        if symbol not in self._dividend_info_cache:
            self.fetch_fundamentals(symbol)
        return self._dividend_info_cache.get(symbol, {})

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
        # İleriye dönük temettü alanları aynı `.info` çağrısından düşer; ayrı
        # sözlükte tutulur ki her hisse satırına gereksiz kolon eklenmesin
        # (600 sembol x 4 zaman dilimi = payload şişer).
        self._dividend_info_cache[symbol] = {
            "ex_date": _epoch_to_date(info.get("exDividendDate")),
            "rate": num("dividendRate"),
            "payout_ratio": num("payoutRatio"),
        }
        self._fundamentals_cache[symbol] = out
        return out
