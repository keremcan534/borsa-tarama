from typing import Optional

from pydantic import BaseModel


class ScreenedStock(BaseModel):
    symbol: str
    close: float
    market_cap: Optional[float] = None
    ema_9: float
    ema_21: float
    ema_50: float
    ema_200: Optional[float] = None  # aylık zaman diliminde hesaplanmaz (yeterli veri yok)
    macd_line: float
    rsi: float
    stoch_k: float
    stoch_rsi_k: float


class ScreenerResponse(BaseModel):
    market: str  # "BIST100" | "SP500"
    timeframe: str = "daily"  # "daily" | "weekly" | "monthly"
    count: int
    scanned: Optional[int] = None  # taranan toplam sembol sayısı
    results: list[ScreenedStock]
