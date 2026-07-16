"""Göreli güç (relative strength): hisse endeksten ne kadar iyi/kötü?

Momentum filtresi "yükselen hisse" bulur — ama yükselen bir piyasada zaten her şey
yükselir. Göreli güç, hissenin getirisinden aynı dönemdeki endeks getirisini çıkarır:
pozitifse hisse endeksi geçiyor, negatifse piyasayla birlikte sürükleniyordur.
"""

import pandas as pd


def _window_return(series: pd.Series, bars: int) -> float | None:
    if len(series) <= bars:
        return None
    start = series.iloc[-1 - bars]
    end = series.iloc[-1]
    if pd.isna(start) or pd.isna(end) or start <= 0:
        return None
    return float(end) / float(start) - 1


def relative_strength(
    close: pd.Series,
    benchmark_close: pd.Series | None,
    bars: int,
) -> float | None:
    """Son `bars` mumda hissenin endekse göre fazla/eksik getirisi.

    Endeks verisi yoksa (örn. emtia) veya yeterli geçmiş yoksa None döner —
    çağıran tarafta bu alan basitçe boş kalır.
    """
    if benchmark_close is None or benchmark_close.empty:
        return None

    stock_return = _window_return(close, bars)
    if stock_return is None:
        return None

    # Endeks farklı günlerde işlem görmüş olabilir (tatiller); hissenin takvimine
    # hizala ve boşlukları son bilinen kapanışla doldur.
    aligned = benchmark_close.reindex(close.index, method="ffill")
    benchmark_return = _window_return(aligned, bars)
    if benchmark_return is None:
        return None

    return stock_return - benchmark_return
