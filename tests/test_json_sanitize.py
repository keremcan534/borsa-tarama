"""NaN'in JSON çıktısına sızmasını engelleyen katmanların testleri.

Yaşanmış hata: çeyreklik taramada stoch-rsi sıfıra bölünüp NaN üretti,
Python'un json modülü bunu literal `NaN` olarak yazdı (kendi kabul ettiği
için testlerde de görünmedi) ve tarayıcının JSON.parse'ı tüm payload'ı
reddettiğinden "3 Aylık" sekmesi yayında ham hata kutusuna dönüştü.
"""

import json
import math

import numpy as np
import pandas as pd

from app.data.fetchers.base import BaseFetcher
from app.screener.engine import analyze_symbol, finite_or_none

from scripts.scan_to_json import dump_json, sanitize_for_json


def test_finite_or_none_rounds_and_drops_non_finite():
    assert finite_or_none(3.14159, 2) == 3.14
    assert finite_or_none(float("nan"), 2) is None
    assert finite_or_none(float("inf"), 2) is None
    assert finite_or_none(None, 2) is None
    assert finite_or_none("bozuk", 2) is None


def test_sanitize_for_json_walks_nested_structures():
    dirty = {
        "a": float("nan"),
        "b": [1.0, float("inf"), {"c": float("-inf")}],
        "d": "NaN",  # metin dokunulmaz
        "e": 5,
    }
    clean = sanitize_for_json(dirty)
    assert clean == {"a": None, "b": [1.0, None, {"c": None}], "d": "NaN", "e": 5}


def test_dump_json_never_emits_literal_nan():
    payload = {"results": [{"stoch_rsi_k": float("nan"), "close": 12.5}]}
    text = dump_json(payload)
    # Tarayıcı JSON.parse'ının kabul edeceği katı JSON olmalı
    parsed = json.loads(text)
    assert parsed["results"][0]["stoch_rsi_k"] is None
    assert "NaN" not in text


class _FlatCloseFetcher(BaseFetcher):
    """Kapanışı sabit seri: RSI değişimi 0 -> stoch-rsi paydası 0 -> NaN üretir."""

    def __init__(self, n: int = 400):
        close = np.full(n, 100.0)
        idx = pd.date_range("2024-01-01", periods=n, freq="D")
        self._df = pd.DataFrame(
            {
                "open": close,
                "high": close + 0.5,
                "low": close - 0.5,
                "close": close,
                "volume": np.full(n, 1_000_000),
            },
            index=idx,
        )

    def fetch_ohlcv(self, symbol: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame:
        return self._df

    def fetch_market_cap(self, symbol: str) -> float | None:
        return 1_000_000.0


def test_analyze_symbol_writes_none_for_non_finite_indicators():
    result = analyze_symbol("DUZ", _FlatCloseFetcher())
    assert result is not None
    for key in ("rsi", "stoch_k", "stoch_rsi_k", "macd_line", "close"):
        value = result[key]
        assert value is None or math.isfinite(value), f"{key} sonlu değil: {value}"
    # Payload'ın tamamı katı JSON'a çevrilebilmeli
    json.loads(dump_json(result))
