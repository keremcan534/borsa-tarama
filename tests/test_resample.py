"""Günlük mumlardan haftalık/aylık/çeyreklik üretimi.

Bu testlerin varlık sebebi: resample'a geçmeden önce haftalık mumu Yahoo veriyordu.
Artık biz üretiyoruz — yani mumun sınırı, etiketi ve alanları Yahoo'nunkiyle
UYUŞMAK ZORUNDA, yoksa tarama sessizce farklı sinyaller verir.
"""

import pandas as pd
import pytest

from app.data.resample import period_to_days, resample_ohlcv, slice_period


def _daily(start: str, days: int, tz: str | None = None) -> pd.DataFrame:
    idx = pd.date_range(start, periods=days, freq="D", tz=tz)
    n = len(idx)
    return pd.DataFrame(
        {
            "open": [float(i + 1) for i in range(n)],
            "high": [float(i + 2) for i in range(n)],
            "low": [float(i) for i in range(n)],
            "close": [float(i + 1.5) for i in range(n)],
            "volume": [100 + i for i in range(n)],
        },
        index=idx,
    )


def test_daily_passthrough_is_identity():
    df = _daily("2026-01-05", 10)
    assert resample_ohlcv(df, "1d") is df


def test_unknown_interval_raises():
    """Sessizce günlük dönmek, haftalık sanılan seriyle gösterge hesaplattırırdı."""
    with pytest.raises(ValueError):
        resample_ohlcv(_daily("2026-01-05", 10), "1h")


def test_weekly_buckets_are_calendar_weeks():
    # 2026-01-05 pazartesi. 14 gün = tam iki takvim haftası.
    df = _daily("2026-01-05", 14)
    weekly = resample_ohlcv(df, "1wk")

    assert len(weekly) == 2
    assert [ts.strftime("%Y-%m-%d") for ts in weekly.index] == ["2026-01-05", "2026-01-12"]
    # İlk hafta: 7 günün açılış/kapanış/uç değerleri
    first = weekly.iloc[0]
    assert first["open"] == df["open"].iloc[0]
    assert first["close"] == df["close"].iloc[6]
    assert first["high"] == df["high"].iloc[:7].max()
    assert first["low"] == df["low"].iloc[:7].min()
    assert first["volume"] == df["volume"].iloc[:7].sum()


def test_partial_week_becomes_its_own_bar():
    """Yarım hafta düşürülmez — kapanmamış mumu atmak `drop_in_progress_bar`ın işi.

    İkisi de burada yapılsaydı sorumluluk ikiye bölünür ve günlük taramada
    (mum düşürülmemesi gereken yerde) hafta yanlışlıkla kırpılabilirdi.
    """
    df = _daily("2026-01-05", 9)  # 7 gün + 2 gün
    weekly = resample_ohlcv(df, "1wk")
    assert len(weekly) == 2
    assert weekly["volume"].iloc[1] == df["volume"].iloc[7:].sum()


def test_bar_is_labelled_with_calendar_start_not_first_trading_day():
    """Tatilde bile mum takvim pazartesisine etiketlenir — Yahoo da böyle yapıyor.

    Ölçüldü (bkz. app/data/resample.py başlığı): ilk işlem gününe etiketleseydik
    10 yılda haftalıkta 14, aylıkta 46 mumun tarihi Yahoo'dan kayardı ve
    `drop_in_progress_bar` yanlış mumu kapanmamış sayabilirdi.
    """
    # 2026-01-05 pazartesi; onu atlayıp salıdan başlat (pazartesi tatil senaryosu)
    df = _daily("2026-01-06", 6)
    weekly = resample_ohlcv(df, "1wk")
    assert weekly.index[0].strftime("%Y-%m-%d") == "2026-01-05"
    # Açılış yine de ilk İŞLEM gününün açılışıdır; tatil günü uydurulmaz
    assert weekly["open"].iloc[0] == df["open"].iloc[0]


def test_monthly_and_quarterly_buckets():
    df = _daily("2026-01-01", 200)  # ~6,5 ay
    monthly = resample_ohlcv(df, "1mo")
    quarterly = resample_ohlcv(df, "3mo")

    assert [ts.strftime("%Y-%m-%d") for ts in monthly.index[:3]] == [
        "2026-01-01",
        "2026-02-01",
        "2026-03-01",
    ]
    # Çeyrekler takvimseldir: Ocak, Nisan, Temmuz
    assert [ts.strftime("%Y-%m-%d") for ts in quarterly.index] == [
        "2026-01-01",
        "2026-04-01",
        "2026-07-01",
    ]
    assert quarterly["close"].iloc[0] == df["close"].loc["2026-03-31"]


def test_quarters_are_calendar_quarters_regardless_of_series_start():
    """Çeyrek çapası serinin başlangıcına DEĞİL takvime bağlı.

    Yahoo'nun `3mo` mumu istenen aralığa göre kayıyor (ölçüldü: aynı sembol
    range=5y ile başka, range=10y ile başka aya oturuyor), yani semboller arası
    karşılaştırılamaz. Bu test o davranışı kopyalamadığımızı kilitler.
    """
    for start in ("2026-02-11", "2026-03-20", "2026-05-02"):
        q = resample_ohlcv(_daily(start, 120), "3mo")
        assert all(ts.month in (1, 4, 7, 10) and ts.day == 1 for ts in q.index), start


def test_gaps_do_not_create_empty_bars():
    """Tatil/işlem olmayan hafta mum üretmemeli: boş mum EMA'yı ve mum sayısını bozar."""
    idx = pd.DatetimeIndex(["2026-01-05", "2026-01-06", "2026-01-26", "2026-01-27"])
    df = pd.DataFrame(
        {
            "open": [1.0, 2, 3, 4],
            "high": [2.0, 3, 4, 5],
            "low": [0.5, 1, 2, 3],
            "close": [1.5, 2.5, 3.5, 4.5],
            "volume": [10, 20, 30, 40],
        },
        index=idx,
    )
    weekly = resample_ohlcv(df, "1wk")
    assert len(weekly) == 2  # aradaki iki boş hafta mum üretmez


def test_timezone_is_preserved():
    """BIST verisi tz'lidir; `drop_in_progress_bar` tz'li `now` ile karşılaştırır."""
    df = _daily("2026-01-05", 14, tz="Europe/Istanbul")
    weekly = resample_ohlcv(df, "1wk")
    assert str(weekly.index.tz) == "Europe/Istanbul"
    assert weekly.index[0].strftime("%Y-%m-%d") == "2026-01-05"


def test_volume_stays_integral():
    """yfinance hacmi int64 döner; float'a kaçarsa onarım kodu cast hatası veriyordu."""
    df = _daily("2026-01-05", 14)
    weekly = resample_ohlcv(df, "1wk")
    assert str(weekly["volume"].dtype).startswith("int")


def test_empty_frame_survives():
    empty = pd.DataFrame(columns=["open", "high", "low", "close", "volume"], index=pd.DatetimeIndex([]))
    assert resample_ohlcv(empty, "1wk").empty


class TestSlicePeriod:
    def test_max_returns_everything(self):
        df = _daily("2020-01-01", 500)
        assert len(slice_period(df, "max")) == 500

    def test_slices_from_now_not_from_last_bar(self):
        """Yahoo periyodu BUGÜNden geriye sayar; işlem görmeyen sembol boş dönmeli."""
        df = _daily("2010-01-01", 100)
        assert slice_period(df, "5y", now=pd.Timestamp("2026-08-25")).empty

    def test_keeps_requested_window(self):
        df = _daily("2026-01-01", 200)
        out = slice_period(df, "1mo", now=pd.Timestamp("2026-07-19"))
        assert len(out) == 31
        assert out.index[-1] == df.index[-1]

    def test_unknown_period_is_left_alone(self):
        df = _daily("2026-01-01", 30)
        assert len(slice_period(df, "ytd")) == 30

    @pytest.mark.parametrize(
        "period,days", [("max", None), ("5y", 1826.25), ("10y", 3652.5), ("1mo", 30.44), ("7d", 7)]
    )
    def test_period_to_days(self, period, days):
        assert period_to_days(period) == days
