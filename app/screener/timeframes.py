"""Zaman dilimi (timeframe) konfigürasyonları.

Aynı gösterge seti farklı mum periyotlarıyla hesaplanır:
- daily:     günlük mumlar   -> sinyaller günler-haftalar ölçeğinde
- weekly:    haftalık mumlar -> sinyaller haftalar-aylar ölçeğinde
- monthly:   aylık mumlar    -> sinyaller aylar ve ötesi ölçeğinde
- quarterly: 3 aylık mumlar  -> sinyaller çeyrekler ve ötesi ölçeğinde

Not: uzun periyotlarda EMA200 kullanılamaz çünkü yeterli mum oluşmaz (200 aylık
~17 yıl, 200 çeyrek ~50 yıl). Bu yüzden aylıkta EMA seti 9/21/50'ye, çeyreklikte
9/21'e iner. "Yıllık" mum desteklenmez: RSI-14 için 14 yıl, EMA9 için 9 yıllık
veri gerektiğinden çoğu enstrümanda hesaplanamaz — çeyreklik en uzun görünümdür.
"""

TIMEFRAMES: dict[str, dict] = {
    "daily": {"period": "1y", "interval": "1d", "ema_periods": [9, 21, 50, 200], "min_bars": 200},
    "weekly": {"period": "10y", "interval": "1wk", "ema_periods": [9, 21, 50, 200], "min_bars": 200},
    "monthly": {"period": "max", "interval": "1mo", "ema_periods": [9, 21, 50], "min_bars": 60},
    "quarterly": {"period": "max", "interval": "3mo", "ema_periods": [9, 21], "min_bars": 24},
}
