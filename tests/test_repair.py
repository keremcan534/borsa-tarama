import numpy as np
import pandas as pd

from app.data.repair import repair_split_artifacts


def _series(closes, splits=None) -> tuple[pd.DataFrame, pd.Series]:
    n = len(closes)
    closes = np.asarray(closes, dtype=float)
    idx = pd.date_range("2024-01-01", periods=n, freq="D")
    df = pd.DataFrame(
        {
            "open": closes,
            "high": closes * 1.01,
            "low": closes * 0.99,
            "close": closes,
            "volume": np.full(n, 1_000_000.0),
        },
        index=idx,
    )
    split_series = pd.Series(splits if splits is not None else np.zeros(n), index=idx, dtype=float)
    return df, split_series


def test_unapplied_split_is_repaired_and_series_becomes_continuous():
    # CCOLA.IS örneğinin küçültülmüş hali: fiyat 4. barda 11'e bölünüyor,
    # ama kayıtlı bölünme tarihi birkaç bar SONRAYA yazılmış.
    closes = [880, 869, 880, 814.9, 74.0, 75.0, 74.5, 76.0]
    splits = [0, 0, 0, 0, 0, 0, 11.0, 0]  # Yahoo'nun yanlış tarihe yazdığı kayıt
    df, split_series = _series(closes, splits)

    repaired, repairs = repair_split_artifacts(df, split_series)

    assert len(repairs) == 1
    assert repairs[0]["split"] == 11.0
    assert repairs[0]["date"] == "2024-01-05"

    # sıçrama öncesi fiyatlar 11'e bölünmüş olmalı
    assert repaired["close"].iloc[3] == 814.9 / 11
    # ve seride artık imkânsız tek günlük hareket kalmamalı
    changes = repaired["close"].pct_change().dropna()
    assert changes.abs().max() < 0.35


def test_repair_preserves_turnover_so_liquidity_filter_is_unaffected():
    closes = [880, 869, 880, 814.9, 74.0, 75.0, 74.5, 76.0]
    df, split_series = _series(closes, [0, 0, 0, 0, 0, 0, 11.0, 0])
    before = (df["close"] * df["volume"]).iloc[0]

    repaired, _ = repair_split_artifacts(df, split_series)

    # fiyat 11'e bölünüp hacim 11 ile çarpıldığından ciro değişmez
    assert np.isclose((repaired["close"] * repaired["volume"]).iloc[0], before)
    assert np.isclose(repaired["volume"].iloc[0], 11_000_000.0)


def test_real_crash_without_matching_split_is_left_alone():
    # Bilanço sonrası gerçek bir -%45 düşüş: kayıtlı bölünme yok, seri korunmalı.
    closes = [100, 101, 100, 55, 54, 56]
    df, split_series = _series(closes)

    repaired, repairs = repair_split_artifacts(df, split_series)

    assert repairs == []
    pd.testing.assert_frame_equal(repaired, df)


def test_jump_is_not_repaired_when_split_ratio_does_not_match():
    # Sıçrama oranı ~2 ama kayıtlı bölünme 11:1 -> eşleşmiyor, dokunulmaz
    closes = [100, 101, 100, 50, 51, 52]
    df, split_series = _series(closes, [0, 0, 0, 0, 11.0, 0])

    _, repairs = repair_split_artifacts(df, split_series)
    assert repairs == []


def test_jump_is_not_repaired_when_recorded_split_is_far_away_in_time():
    closes = [880, 869, 880, 814.9, 74.0, 75.0, 74.5, 76.0]
    df, split_series = _series(closes, [0, 0, 0, 0, 0, 0, 11.0, 0])

    # bölünme kaydı sıçramadan 1 günden fazla uzaktaysa eşleşme sayılmaz
    _, repairs = repair_split_artifacts(df, split_series, max_days=1)
    assert repairs == []


def test_correctly_applied_split_produces_no_jump_and_no_repair():
    # MIATK.IS gibi normal durum: Yahoo bölünmeyi zaten uygulamış, seri sürekli
    closes = [10, 10.2, 10.1, 10.3, 10.5, 10.4]
    df, split_series = _series(closes, [0, 0, 13.0, 0, 0, 0])

    _, repairs = repair_split_artifacts(df, split_series)
    assert repairs == []


def test_upward_jump_matching_split_is_repaired():
    # Ters yön: seri erken bölünmüş, gerçek tarihte 11 kat yukarı sıçrıyor.
    # Bu yön daha tehlikeli: fiyatı tüm EMA'ların üstüne atıp SAHTE AL sinyali üretir.
    closes = [74, 75, 74.5, 814.9, 820, 830]
    df, split_series = _series(closes, [0, 0, 0, 0, 11.0, 0])

    repaired, repairs = repair_split_artifacts(df, split_series)

    assert len(repairs) == 1
    assert repaired["close"].iloc[2] == 74.5 * 11
    assert repaired["close"].pct_change().dropna().abs().max() < 0.35


def test_series_without_splits_column_is_returned_untouched():
    df, _ = _series([100, 101, 50, 51])
    repaired, repairs = repair_split_artifacts(df, None)
    assert repairs == []
    pd.testing.assert_frame_equal(repaired, df)


def test_short_series_is_safe():
    df, split_series = _series([100])
    repaired, repairs = repair_split_artifacts(df, split_series)
    assert repairs == []
    assert len(repaired) == 1
