"""Zaman dilimi (timeframe) konfigürasyonları.

Aynı gösterge seti farklı mum periyotlarıyla hesaplanır:
- daily:   günlük mumlar  -> sinyaller günler-haftalar ölçeğinde
- weekly:  haftalık mumlar -> sinyaller haftalar-aylar ölçeğinde
- monthly: aylık mumlar   -> sinyaller aylar ve ötesi ölçeğinde

Not: aylık görünümde EMA200 kullanılamaz (200 aylık ~17 yıllık veri çoğu
hissede yok); bu yüzden EMA seti 9/21/50'ye iner ve min_bars 60'tır (~5 yıl).
"""

TIMEFRAMES: dict[str, dict] = {
    "daily": {"period": "1y", "interval": "1d", "ema_periods": [9, 21, 50, 200], "min_bars": 200},
    "weekly": {"period": "10y", "interval": "1wk", "ema_periods": [9, 21, 50, 200], "min_bars": 200},
    "monthly": {"period": "max", "interval": "1mo", "ema_periods": [9, 21, 50], "min_bars": 60},
}
