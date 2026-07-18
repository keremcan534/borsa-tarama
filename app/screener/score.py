"""Teknik güç puanı (0-100).

Arayüzdeki `technicalScore` (frontend/src/App.jsx) ile BİREBİR aynı olmalı:
skor geçmişi arşivi bu fonksiyonla üretilir, tablo puanı arayüzde hesaplanır;
ikisi ayrışırsa "değişim raporu" tutarsız görünür. Formül değişirse iki yer
birlikte güncellenmeli (test: tests/test_score.py).
"""


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _rsi_health(rsi: float) -> float:
    # 55-65 bandında zirve; aşırı alım/satımda düşer
    if 55 <= rsi <= 65:
        return 1.0
    if rsi > 65:
        return _clamp(1 - (rsi - 65) / 20, 0.2, 1)  # 65→1, 85→0.2
    return _clamp(0.3 + ((rsi - 30) / 25) * 0.7, 0.3, 1)  # 30→0.3, 55→1


def technical_score(stock: dict, ema_periods: list[int]) -> int:
    """Trend hizası (40) + MACD momentumu (25) + RSI sağlığı (20) + Stokastik (15)."""
    close = stock.get("close") or 0
    emas_above = sum(1 for p in ema_periods if close > (stock.get(f"ema_{p}") or 0))
    trend = (emas_above / len(ema_periods)) * 40 if ema_periods else 0
    macd_line = stock.get("macd_line") or 0
    ratio = macd_line / close if close else 0
    macd = _clamp(ratio / 0.015, 0, 1) * 25 if macd_line > 0 else 0
    rsi = _rsi_health(stock.get("rsi") or 0) * 20
    stoch = _clamp((100 - (stock.get("stoch_k") or 0)) / 100, 0, 1) * 15
    return round(trend + macd + rsi + stoch)
