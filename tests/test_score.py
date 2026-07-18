"""technical_score, arayüzdeki technicalScore ile aynı sonucu vermeli."""

from app.screener.score import technical_score


def test_strong_uptrend_high_score():
    stock = {
        "close": 100,
        "ema_9": 95,
        "ema_21": 90,
        "ema_50": 85,
        "ema_200": 70,
        "macd_line": 1.5,  # ratio 0.015 -> tam MACD puanı
        "rsi": 60,  # sağlık zirvesi
        "stoch_k": 0,  # tam stokastik alanı
    }
    assert technical_score(stock, [9, 21, 50, 200]) == 100


def test_weak_downtrend_low_score():
    stock = {
        "close": 80,
        "ema_9": 85,
        "ema_21": 90,
        "ema_50": 95,
        "ema_200": 110,
        "macd_line": -0.5,  # negatif -> MACD 0
        "rsi": 30,  # sağlık 0.3
        "stoch_k": 100,  # stokastik 0
    }
    # trend 0 + macd 0 + rsi 0.3*20=6 + stoch 0 = 6
    assert technical_score(stock, [9, 21, 50, 200]) == 6


def test_none_fields_do_not_crash():
    # Gerçek taramada tüm alanlar dolu; bu yalnızca savunma amaçlı (çökmesin)
    stock = {"close": None, "macd_line": None, "rsi": None, "stoch_k": None}
    score = technical_score(stock, [9, 21])
    assert isinstance(score, int) and 0 <= score <= 100
