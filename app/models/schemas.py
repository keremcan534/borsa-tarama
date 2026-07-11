from typing import Optional

from pydantic import BaseModel


class ScreenedStock(BaseModel):
    symbol: str
    close: float
    market_cap: Optional[float] = None
    ema_9: float
    ema_21: float
    ema_50: float
    ema_200: float
    macd_line: float
    rsi: float
    stoch_k: float
    stoch_rsi_k: float


class ScreenerResponse(BaseModel):
    market: str  # "BIST100" | "SP500"
    count: int
    results: list[ScreenedStock]
