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

`rs_bars`: göreli gücün (hisse getirisi eksi endeks getirisi) ölçüleceği pencere.
Her zaman diliminde kabaca "son çeyrek/yıl" ölçeğinde tutulur.
"""

TIMEFRAMES: dict[str, dict] = {
    "daily": {
        # 5 yıl (~1250 bar): EMA200'ün OTURMASI için gerekli. adjust=False ile EMA,
        # başlangıç değerinden itibaren kurulur ve span'in ~3 katı bar geçmeden
        # gerçek değerine yakınsamaz. Eskiden "1y" (~250 bar) çekiliyordu; ölçümde
        # BIST 100'ün 42/99 hissesinde EMA200 hatası %1'i aşıyor, 2 hissede
        # "fiyat > EMA200" kararı değişiyordu — bu bir FİLTRE kriteri olduğundan
        # sinyaller yanlış eleniyordu. Ayrıca backtest zaten "5y" kullanıyor;
        # aynı periyot, backtest ile ekrandaki sinyalin aynı EMA'yı görmesini sağlar.
        "period": "5y",
        "interval": "1d",
        "ema_periods": [9, 21, 50, 200],
        "min_bars": 200,
        "rs_bars": 60,  # ~3 ay
    },
    "weekly": {
        # "max": haftalık EMA200 = 200 hafta ≈ 3,8 yıl; 10y (~520 bar) span'in
        # yalnızca 2,6 katıdır ve uzun geçmişli hisselerde kararı değiştirebiliyordu.
        "period": "max",
        "interval": "1wk",
        "ema_periods": [9, 21, 50, 200],
        "min_bars": 200,
        "rs_bars": 26,  # ~6 ay
    },
    "monthly": {
        "period": "max",
        "interval": "1mo",
        "ema_periods": [9, 21, 50],
        "min_bars": 60,
        "rs_bars": 12,  # 1 yıl
    },
    "quarterly": {
        "period": "max",
        "interval": "3mo",
        "ema_periods": [9, 21],
        "min_bars": 24,
        "rs_bars": 4,  # 1 yıl
    },
}
