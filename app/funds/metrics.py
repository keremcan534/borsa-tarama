"""Fon fiyat serisinden getiri / risk metrikleri.

Hisse tarayıcısındaki RSI/MACD yerine fonlar için anlamlı olan
kümülatif getiri, volatilite, Sharpe ve maksimum düşüş hesaplanır.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

# Risksiz faiz varsayımı yok — Sharpe burada "getiri / volatilite" oranı
# (aşırı sadeleştirilmiş); göreli sıralama için yeterli.
TRADING_DAYS = 252


def _price_on_or_before(series: pd.Series, target: pd.Timestamp) -> float | None:
    """target tarihine eşit veya önceki son fiyatı döner."""
    window = series.loc[:target]
    if window.empty:
        return None
    return float(window.iloc[-1])


def cumulative_return(series: pd.Series, days: int) -> float | None:
    """Son `days` takvim gününe göre kümülatif getiri (oran, örn. 0.12 = %12)."""
    if series.empty or len(series) < 2:
        return None
    end = series.index.max()
    start_price = _price_on_or_before(series, end - timedelta(days=days))
    end_price = float(series.iloc[-1])
    if start_price is None or start_price <= 0 or end_price <= 0:
        return None
    return end_price / start_price - 1.0


def ytd_return(series: pd.Series) -> float | None:
    """Yılbaşından bugüne getiri."""
    if series.empty:
        return None
    end = series.index.max()
    year_start = pd.Timestamp(datetime(end.year, 1, 1))
    start_price = _price_on_or_before(series, year_start)
    # 1 Ocak tatil olabilir; yılın ilk işlem gününe düş
    if start_price is None:
        after = series.loc[year_start:]
        if after.empty:
            return None
        start_price = float(after.iloc[0])
    end_price = float(series.iloc[-1])
    if start_price <= 0 or end_price <= 0:
        return None
    return end_price / start_price - 1.0


def annualized_volatility(series: pd.Series, min_obs: int = 40) -> float | None:
    """Günlük log-getirilerden yıllıklandırılmış volatilite."""
    if len(series) < min_obs:
        return None
    rets = np.log(series / series.shift(1)).dropna()
    if len(rets) < min_obs - 1:
        return None
    return float(rets.std(ddof=1) * math.sqrt(TRADING_DAYS))


def sharpe_ratio(series: pd.Series, min_obs: int = 40) -> float | None:
    """Yıllıklandırılmış ortalama getiri / volatilite (risksiz faiz = 0)."""
    if len(series) < min_obs:
        return None
    rets = np.log(series / series.shift(1)).dropna()
    if len(rets) < min_obs - 1:
        return None
    vol = rets.std(ddof=1)
    if vol == 0 or math.isnan(vol):
        return None
    return float((rets.mean() / vol) * math.sqrt(TRADING_DAYS))


def max_drawdown(series: pd.Series) -> float | None:
    """Serideki en büyük zirveden düşüş (negatif oran, örn. -0.25)."""
    if len(series) < 2:
        return None
    peak = series.cummax()
    dd = series / peak - 1.0
    return float(dd.min())


def fund_score(
    return_1y: float | None,
    sharpe: float | None,
    max_dd: float | None,
) -> int:
    """0-100 fon puanı: 1y getiri (45) + Sharpe (40) + düşük maxDD (15)."""
    # Getiri: %0 → 0, %80+ → 45 (enflasyonlu TR piyasasına göre ölçek)
    ret_pts = 0.0
    if return_1y is not None:
        ret_pts = max(0.0, min(1.0, return_1y / 0.80)) * 45

    # Sharpe: 0 → 0, 2.0+ → 40
    sharpe_pts = 0.0
    if sharpe is not None:
        sharpe_pts = max(0.0, min(1.0, sharpe / 2.0)) * 40

    # Max DD: 0 → 15, -50% → 0
    dd_pts = 0.0
    if max_dd is not None:
        dd_pts = max(0.0, min(1.0, 1.0 + max_dd / 0.50)) * 15

    return int(round(ret_pts + sharpe_pts + dd_pts))


def compute_fund_metrics(prices: pd.Series) -> dict:
    """Tek bir fonun fiyat serisinden metrik sözlüğü üretir."""
    prices = prices.dropna().sort_index()
    # Aynı gün birden fazla satır gelirse sonuncuyu al
    prices = prices[~prices.index.duplicated(keep="last")]

    r1m = cumulative_return(prices, 30)
    r3m = cumulative_return(prices, 90)
    r6m = cumulative_return(prices, 180)
    r1y = cumulative_return(prices, 365)
    rytd = ytd_return(prices)
    vol = annualized_volatility(prices)
    sharpe = sharpe_ratio(prices)
    mdd = max_drawdown(prices)

    return {
        "price": float(prices.iloc[-1]) if len(prices) else None,
        "return_1m": r1m,
        "return_3m": r3m,
        "return_6m": r6m,
        "return_1y": r1y,
        "return_ytd": rytd,
        "volatility": vol,
        "sharpe": sharpe,
        "max_drawdown": mdd,
        "score": fund_score(r1y, sharpe, mdd),
        "history_days": int(len(prices)),
    }
