"""Zaman dilimi veri penceresi ile EMA periyotlarının tutarlılığı.

Bu testlerin varlık sebebi gerçek bir hata: günlük tarama "1y" (~250 bar) veri
çekerken EMA200 hesaplıyordu. `adjust=False` ile EMA başlangıç değerinden kurulur
ve span'in ~3 katı bar geçmeden yakınsamaz; ölçümde BIST 100'ün 42/99 hissesinde
EMA200 hatası %1'i aşıyor, 2 hissede "fiyat > EMA200" kararı değişiyordu. Bu bir
FİLTRE kriteri olduğu için sinyaller yanlış eleniyordu.
"""

import numpy as np
import pandas as pd
import pytest

from app.backtest.engine import BACKTEST_PERIODS
from app.indicators.ema import calculate_ema
from app.screener.timeframes import TIMEFRAMES

# Bir mum periyodunun kabaca kaç takvim yılına denk geldiği (yakınsama hesabı için)
BARS_PER_YEAR = {"1d": 252, "1wk": 52, "1mo": 12, "3mo": 4}

# EMA'nın yakınsaması için span'in en az bu katı kadar bar gerekir
MIN_CONVERGENCE_FACTOR = 3


def _years(period: str) -> float | None:
    """'5y' -> 5.0, 'max' -> None (sınırsız kabul edilir)."""
    return None if period == "max" else float(period.rstrip("y"))


@pytest.mark.parametrize("name", list(TIMEFRAMES))
def test_period_long_enough_for_largest_ema(name):
    config = TIMEFRAMES[name]
    years = _years(config["period"])
    if years is None:
        return  # "max": elde olan tüm geçmiş çekilir, yakınsama sorunu yok

    bars = years * BARS_PER_YEAR[config["interval"]]
    needed = max(config["ema_periods"]) * MIN_CONVERGENCE_FACTOR
    assert bars >= needed, (
        f"{name}: {config['period']} ≈ {bars:.0f} bar, "
        f"EMA{max(config['ema_periods'])} için en az {needed} bar gerekiyor"
    )


def test_daily_period_matches_backtest():
    # Backtest ile canlı tarama aynı EMA'yı görmeli: farklı pencere, farklı EMA200
    # tohumu demektir ve backtest ekrandakinden başka bir stratejiyi ölçmüş olur.
    assert TIMEFRAMES["daily"]["period"] == BACKTEST_PERIODS["daily"]


def test_weekly_period_matches_backtest():
    assert TIMEFRAMES["weekly"]["period"] == BACKTEST_PERIODS["weekly"]


def test_short_window_biases_ema200_upward_in_uptrend():
    """Hatanın MEKANİZMASINI kilitler (sapmanın büyüklüğünü değil).

    Yükselen bir seride 250 barlık pencere, EMA'yı 250 bar önceki (yüksek) fiyattan
    başlatır; tüm geçmiş ise çok daha düşük bir fiyattan. Bu yüzden kısa pencerenin
    EMA200'ü sistematik olarak DAHA YÜKSEK çıkar ve fiyat "EMA200'ün altında"
    görünerek filtreden elenir. Canlı veride tam olarak bu yaşandı: ALTNY'de
    1y-EMA200 16,83 iken 5y-EMA200 16,45'ti (fiyat 16,75 — yani gerçekte üstünde).
    """
    rng = np.random.default_rng(7)
    close = pd.Series(np.cumsum(rng.normal(0.3, 2.0, 1500)) + 300)

    short = calculate_ema(close.iloc[-250:], 200).iloc[-1]
    long = calculate_ema(close, 200).iloc[-1]

    assert short > long, (
        "Yükselen seride kısa pencere EMA200'ü daha yüksek çıkarmalıydı; "
        "bu testin yakaladığı önyargı kaybolmuşsa hata analizi de geçersizdir"
    )
    # Sapma ölçülebilir olmalı: gürültü seviyesinde kalırsa sorun pratikte önemsizdir
    assert abs(short - long) / long > 0.002
