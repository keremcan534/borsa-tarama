"""Fon fiyat serisinden getiri / risk metrikleri.

Hisse tarayıcısındaki RSI/MACD yerine fonlar için anlamlı olan kümülatif getiri,
volatilite, maksimum düşüş ve risk-ayarlı oranlar (Sharpe, Sortino, Calmar) ile
endekse göre beta / Jensen alfası hesaplanır.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

# Risksiz faiz varsayımı yok — Sharpe burada "getiri / volatilite" oranı
# (aşırı sadeleştirilmiş); göreli sıralama için yeterli. Sortino ve Jensen
# alfası risksiz faizi parametre olarak alır (bkz. settings.risk_free_rate).
TRADING_DAYS = 252

# Calmar için asgari geçmiş: daha kısa pencerede CAGR'ye çevirmek (örn. 2 aylık
# %10'u yıllığa taşımak) fonu olduğundan çok daha iyi gösterir.
MIN_CALMAR_DAYS = 180

# Beta/alfa regresyonu için asgari ortak işlem günü
MIN_ALPHA_OBS = 60


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


def daily_return(series: pd.Series) -> float | None:
    """Son iki fiyat arasındaki değişim — "bugünün getirisi".

    TEFAS fiyatları iş günü bazlıdır; hafta sonu/tatil sonrası bu, son iki İŞLEM
    günü arasındaki değişimdir.
    """
    if len(series) < 2:
        return None
    previous = float(series.iloc[-2])
    last = float(series.iloc[-1])
    if previous <= 0 or last <= 0:
        return None
    return last / previous - 1.0


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


def _log_returns(series: pd.Series, min_obs: int) -> pd.Series | None:
    """Günlük log-getiriler; seri kısaysa None (metrik hesaplanmaz)."""
    if len(series) < min_obs:
        return None
    rets = np.log(series / series.shift(1)).dropna()
    if len(rets) < min_obs - 1:
        return None
    return rets


def annualized_volatility(series: pd.Series, min_obs: int = 40) -> float | None:
    """Günlük log-getirilerden yıllıklandırılmış volatilite."""
    rets = _log_returns(series, min_obs)
    if rets is None:
        return None
    return float(rets.std(ddof=1) * math.sqrt(TRADING_DAYS))


def sharpe_ratio(series: pd.Series, min_obs: int = 40) -> float | None:
    """Yıllıklandırılmış ortalama getiri / volatilite (risksiz faiz = 0)."""
    rets = _log_returns(series, min_obs)
    if rets is None:
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


def max_daily_move(series: pd.Series) -> float | None:
    """En büyük tek günlük mutlak fiyat değişimi (oran).

    Fon birim pay fiyatı bir günde %40+ oynamaz; böyle bir sıçrama neredeyse
    her zaman birim-pay bölünmesi / denominasyon değişimi ya da bozuk fiyat
    verisidir. Bu, toplam getiriden çok daha güvenilir bir artefakt imzasıdır.
    """
    if len(series) < 2:
        return None
    changes = series.pct_change().dropna().abs()
    if changes.empty:
        return None
    return float(changes.max())


def sortino_ratio(series: pd.Series, min_obs: int = 40, risk_free: float = 0.0) -> float | None:
    """Sharpe'ın yalnızca AŞAĞI yönlü riske bakan versiyonu.

    Sharpe, yukarı yönlü oynaklığı da "risk" sayar; bir fon sert yükseldiği için
    cezalandırılabilir. Sortino paydayı yalnızca hedefin (risksiz getiri) altında
    kalan günlerden kurar — yatırımcının gerçekten rahatsız olduğu taraf budur.

    Payda sıfırsa (hiç hedefin altında gün yok) oran tanımsızdır; None döner.
    """
    rets = _log_returns(series, min_obs)
    if rets is None:
        return None
    # Yıllık risksiz faizin günlük log karşılığı
    daily_target = math.log1p(risk_free) / TRADING_DAYS
    excess = rets - daily_target
    # Standart tanım: hedefin üstündeki günler 0 sayılır, ortalama TÜM günlere bölünür
    downside = excess.clip(upper=0.0)
    deviation = float(np.sqrt((downside**2).mean()))
    if deviation == 0 or math.isnan(deviation):
        return None
    return float((excess.mean() / deviation) * math.sqrt(TRADING_DAYS))


def calmar_ratio(series: pd.Series, min_days: int = MIN_CALMAR_DAYS) -> float | None:
    """Yıllık bileşik getiri (CAGR) / maksimum düşüş.

    "Bu getiriyi elde etmek için yolda ne kadar acı çektim?" sorusunun tek
    sayılık cevabı. Volatilite yerine yaşanmış en kötü düşüşü payda alır, bu
    yüzden Sharpe/Sortino'nun kaçırdığı tek seferlik çöküşleri yakalar.

    Kısa geçmişte (< `min_days`) CAGR anlamsız şekilde şişer; None döner.
    Hiç düşüş yaşamamış seride oran tanımsızdır (payda 0) — o da None.
    """
    if len(series) < 2:
        return None
    span_days = (series.index[-1] - series.index[0]).days
    if span_days < min_days:
        return None
    first = float(series.iloc[0])
    last = float(series.iloc[-1])
    if first <= 0 or last <= 0:
        return None
    cagr = (last / first) ** (365.25 / span_days) - 1.0
    mdd = max_drawdown(series)
    if mdd is None or abs(mdd) < 1e-9:
        return None
    return float(cagr / abs(mdd))


def _normalized_prices(series: pd.Series) -> pd.Series:
    """Fiyat serisini gün bazına indirger (tz'siz, tekilleştirilmiş, pozitif).

    TEFAS tarihleri tz'siz, yfinance endeks tarihleri tz'li gelir; hizalama
    yapabilmek için ikisi de aynı forma sokulmalı.
    """
    clean = series.dropna()
    clean = clean[clean > 0]
    index = pd.DatetimeIndex(clean.index)
    if index.tz is not None:
        index = index.tz_localize(None)
    clean = pd.Series(clean.to_numpy(dtype=float), index=index.normalize())
    clean = clean[~clean.index.duplicated(keep="last")]
    return clean.sort_index()


def alpha_beta(
    series: pd.Series,
    benchmark: pd.Series | None,
    min_obs: int = MIN_ALPHA_OBS,
    risk_free: float = 0.0,
) -> dict | None:
    """CAPM regresyonu: fonun endekse göre betası ve Jensen alfası.

    Beta, fonun endeksle birlikte ne kadar hareket ettiğini söyler (1 = endeksle
    aynı, 0.5 = yarısı kadar). Jensen alfası ise "bu betayı taşımanın hak ettiği
    getiriden ne kadar FAZLASINI üretti" sorusunun cevabıdır — yıllıklandırılmış
    oran olarak döner (0.08 = yılda %8 fazla).

    Getiriler basit (log değil) alınır: CAPM doğrusal ilişkiyi aritmetik
    getiriler üzerinde tanımlar. Ortak işlem günü sayısı `min_obs`'un altındaysa
    regresyon gürültüdür; None döner.
    """
    if series is None or benchmark is None or len(benchmark) < 2:
        return None

    joined = pd.DataFrame(
        {"fund": _normalized_prices(series), "bench": _normalized_prices(benchmark)}
    ).dropna()
    if len(joined) < min_obs + 1:
        return None

    rets = joined.pct_change().dropna()
    if len(rets) < min_obs:
        return None

    daily_rf = (1.0 + risk_free) ** (1.0 / TRADING_DAYS) - 1.0
    fund_excess = rets["fund"] - daily_rf
    bench_excess = rets["bench"] - daily_rf

    variance = float(bench_excess.var(ddof=1))
    if variance <= 0 or math.isnan(variance):
        return None

    beta = float(fund_excess.cov(bench_excess) / variance)
    daily_alpha = float(fund_excess.mean() - beta * bench_excess.mean())
    if math.isnan(beta) or math.isnan(daily_alpha):
        return None

    return {
        "beta": beta,
        # Bileşik yıllıklandırma: TR'nin yüksek getiri rejiminde 252*günlük
        # doğrusal ölçek alfayı belirgin şekilde yanlış gösterir.
        "alpha": (1.0 + daily_alpha) ** TRADING_DAYS - 1.0,
        "obs": int(len(rets)),
    }


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


def compute_fund_metrics(
    prices: pd.Series,
    benchmark: pd.Series | None = None,
    risk_free: float = 0.0,
) -> dict:
    """Tek bir fonun fiyat serisinden metrik sözlüğü üretir.

    `benchmark` (endeks kapanışları) verilirse beta ve Jensen alfası da
    hesaplanır; verilmezse bu alanlar None kalır — endeks çekilemediğinde
    taramanın geri kalanı çalışmaya devam etmeli.
    """
    prices = prices.dropna().sort_index()
    # Sıfır/negatif fiyatlar (eksik gün) log-getiri hesabını bozar — ele
    prices = prices[prices > 0]
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
    capm = alpha_beta(prices, benchmark, risk_free=risk_free)

    return {
        "price": float(prices.iloc[-1]) if len(prices) else None,
        "max_daily_move": max_daily_move(prices),
        "return_1d": daily_return(prices),
        "return_1m": r1m,
        "return_3m": r3m,
        "return_6m": r6m,
        "return_1y": r1y,
        "return_ytd": rytd,
        "volatility": vol,
        "sharpe": sharpe,
        "sortino": sortino_ratio(prices, risk_free=risk_free),
        "calmar": calmar_ratio(prices),
        "max_drawdown": mdd,
        "beta": capm["beta"] if capm else None,
        "alpha": capm["alpha"] if capm else None,
        # Puan bilinçli olarak eski üç bileşende kalıyor: yeni metrikler
        # sıralamayı sessizce değiştirmesin, önce kullanıcı görüp yorumlasın.
        "score": fund_score(r1y, sharpe, mdd),
        "history_days": int(len(prices)),
    }
