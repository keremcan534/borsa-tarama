"""Fiyat serisindeki uygulanmamış bölünme (split) artefaktlarını onarır.

Sorun: Yahoo genelde bölünmeleri doğru uygular, ama zaman zaman bölünmeyi YANLIŞ
TARİHE kaydedip fiyat serisine hiç yansıtmaz. Örnek (2026-07 itibarıyla canlı veride):
CCOLA.IS'in 11:1 bölünmesi Yahoo'da 2024-08-13 olarak kayıtlı, oysa fiyat serisi
2024-08-01'de 815'ten 75'e düşüyor — yani seride tek günde -%91'lik imkânsız bir
hareket duruyor (BIST'te günlük fiyat limiti ±%10).

Bu artefakt hem taramayı hem backtest'i bozar: yapay sıçrama fiyatı bir anda tüm
EMA'ların altına (ya da ters yönde üstüne) atar, yani gerçek olmayan sinyal üretebilir
ya da gerçek sinyali bastırabilir.

Onarım kuralı — bir sıçrama YALNIZCA şu üçü birden sağlanırsa bölünme sayılır:
  1. Tek mumda büyük bir fiyat sıçraması var,
  2. Sıçramanın oranı KAYITLI bir bölünme oranıyla eşleşiyor,
  3. O kayıtlı bölünmenin tarihi sıçramaya yakın.

Üçünün birden gerçek bir fiyat hareketinde çakışması pratikte imkânsızdır. Bu şart
bilerek dardır: yalnızca eşiğe bakıp "büyük düşüş = bölünme" demek, ABD hisselerinde
bilanço/dava sonrası yaşanan GERÇEK sert düşüşleri silip yerine sahte bir süreklilik
koyardı. Eşleşme yoksa seriye dokunulmaz.
"""

import numpy as np
import pandas as pd

PRICE_COLUMNS = ["open", "high", "low", "close"]


def _split_events(df: pd.DataFrame, splits: pd.Series | None) -> list[tuple[pd.Timestamp, float]]:
    """Kayıtlı (tarih, bölünme oranı) çiftlerini döner."""
    if splits is None or splits.empty:
        return []
    nonzero = splits[splits.notna() & (splits > 0) & (splits != 1)]
    return [(date, float(value)) for date, value in nonzero.items()]


def _matching_split(
    factor: float,
    jump_date: pd.Timestamp,
    events: list[tuple[pd.Timestamp, float]],
    ratio_tolerance: float,
    max_days: int,
) -> float | None:
    """Sıçramanın oranıyla eşleşen ve tarihi ona yakın olan kayıtlı bölünmeyi döner."""
    for date, value in events:
        if abs((jump_date - date).days) > max_days:
            continue
        if abs(factor - value) / value <= ratio_tolerance:
            return value
    return None


def repair_split_artifacts(
    df: pd.DataFrame,
    splits: pd.Series | None = None,
    jump_threshold: float = 0.35,
    ratio_tolerance: float = 0.15,
    max_days: int = 30,
) -> tuple[pd.DataFrame, list[dict]]:
    """Uygulanmamış bölünmeleri geriye dönük düzelterek seriyi sürekli hale getirir.

    Sıçramadan ÖNCEKİ barların fiyatları bölünme oranına bölünür (hacmi çarpılır) —
    standart geriye dönük düzeltme. Ciro (hacim x fiyat) bu işlemde değişmez, yani
    likidite filtresi etkilenmez.

    Dönüş: (onarılmış df, yapılan onarımların listesi).
    """
    if len(df) < 2:
        return df, []

    events = _split_events(df, splits)
    if not events:
        return df, []

    df = df.copy()
    # Oranlar ORİJİNAL seriden bir kez hesaplanır: bir onarım yalnızca kendisinden
    # ÖNCEKİ barları ölçeklediğinden sonraki barların birbirine oranını değiştirmez.
    ratios = df["close"] / df["close"].shift(1)
    upper = 1 / (1 - jump_threshold)
    price_cols = df.columns.get_indexer(PRICE_COLUMNS)
    volume_col = df.columns.get_indexer(["volume"])

    repairs: list[dict] = []
    for i in range(1, len(df)):
        ratio = ratios.iloc[i]
        if not np.isfinite(ratio) or ratio <= 0:
            continue
        if (1 - jump_threshold) <= ratio <= upper:
            continue  # normal hareket

        factor = 1 / ratio if ratio < 1 else ratio
        matched = _matching_split(factor, df.index[i], events, ratio_tolerance, max_days)
        if matched is None:
            continue  # oranı/tarihi eşleşen bir bölünme yok: gerçek hareket, dokunma

        # ratio < 1: fiyat düştü -> sonrası bölünmüş, öncesini bölünmeye böl
        scale = 1 / matched if ratio < 1 else matched
        df.iloc[:i, price_cols] *= scale
        df.iloc[:i, volume_col] /= scale

        repairs.append(
            {
                "date": str(df.index[i].date()),
                "observed_ratio": round(float(factor), 3),
                "split": matched,
            }
        )

    return df, repairs
