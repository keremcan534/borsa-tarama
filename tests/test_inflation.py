"""TÜFE serisi ve reel getiri.

Ağa çıkmaz. OECD fixture'ı gerçek yanıtın (2026-08) yapısından kopyalandı.
"""

from datetime import date
from unittest.mock import MagicMock

import pytest

from app.data.inflation import (
    fetch_cpi_oecd,
    inflation_between,
    load_cpi,
    real_return,
)

CPI = {"2025-01": 100.0, "2025-07": 120.0, "2026-01": 150.0}

# OECD SDMX-JSON yapısı: gözlem anahtarları zaman DİZİSİNDEKİ İNDEKStir, tarih değil.
OECD_PAYLOAD = {
    "data": {
        "dataSets": [{"series": {"0:0:0:0:0:0:0:0": {"observations": {"0": [96.1, 0], "1": [98.4, 0]}}}}],
        "structures": [
            {"dimensions": {"observation": [{"values": [{"id": "2025-01"}, {"id": "2025-02"}]}]}}
        ],
    }
}


class TestRealReturn:
    def test_deflates_by_the_period_inflation(self):
        # %50 nominal, aynı dönemde TÜFE 100 -> 150 (%50 enflasyon) = reel 0
        assert real_return(0.5, "2025-01", "2026-01", CPI) == pytest.approx(0.0)

    def test_is_not_naive_subtraction(self):
        """Yüksek enflasyonda "nominal - enflasyon" belirgin biçimde yanlış.

        Nominal %80, enflasyon %50: çıkarma %30 der, doğrusu 1.8/1.5-1 = %20.
        """
        result = real_return(0.8, "2025-01", "2026-01", CPI)
        assert result == pytest.approx(0.20)
        assert result != pytest.approx(0.30)

    def test_negative_real_return_when_inflation_beats_nominal(self):
        assert real_return(0.30, "2025-01", "2026-01", CPI) < 0

    def test_returns_none_when_period_is_not_covered(self):
        """Kapsanmayan ay tahmin EDİLMEZ — bilinmeyeni biliniyormuş gibi göstermek olurdu."""
        assert real_return(0.5, "2024-01", "2026-01", CPI) is None
        assert real_return(0.5, "2025-01", "2026-08", CPI) is None

    def test_returns_none_without_cpi_or_nominal(self):
        assert real_return(0.5, "2025-01", "2026-01", {}) is None
        assert real_return(None, "2025-01", "2026-01", CPI) is None

    def test_accepts_date_objects_and_full_dates(self):
        assert real_return(0.5, date(2025, 1, 14), date(2026, 1, 3), CPI) == pytest.approx(0.0)
        assert real_return(0.5, "2025-01-14", "2026-01-03", CPI) == pytest.approx(0.0)


class TestInflationBetween:
    def test_measures_cumulative_inflation(self):
        assert inflation_between("2025-01", "2026-01", CPI) == pytest.approx(0.5)

    def test_none_when_uncovered(self):
        assert inflation_between("2020-01", "2026-01", CPI) is None


class TestFetchOecd:
    def test_maps_observation_indexes_to_months(self):
        """Gözlem anahtarı indekstir; doğrudan ay sanılırsa seri tamamen kayar."""
        session = MagicMock()
        session.get.return_value = MagicMock(json=lambda: OECD_PAYLOAD, raise_for_status=lambda: None)
        assert fetch_cpi_oecd(session) == {"2025-01": 96.1, "2025-02": 98.4}

    def test_network_failure_yields_empty_series(self):
        session = MagicMock()
        session.get.side_effect = RuntimeError("ağ yok")
        assert fetch_cpi_oecd(session) == {}


class TestLoadCpi:
    def test_falls_back_to_oecd_without_api_key(self, monkeypatch):
        monkeypatch.delenv("EVDS_API_KEY", raising=False)
        session = MagicMock()
        session.get.return_value = MagicMock(json=lambda: OECD_PAYLOAD, raise_for_status=lambda: None)

        result = load_cpi(session)

        assert result["source"].startswith("OECD")
        assert result["as_of"] == "2025-02"
        assert result["series"]["2025-01"] == 96.1

    def test_empty_series_is_not_zero_inflation(self, monkeypatch):
        """Seri alınamazsa reel getiri GÖSTERİLMEZ; enflasyon 0 varsayılmaz."""
        monkeypatch.delenv("EVDS_API_KEY", raising=False)
        session = MagicMock()
        session.get.side_effect = RuntimeError("ağ yok")

        result = load_cpi(session)

        assert result == {"series": {}, "source": None, "as_of": None}
        assert real_return(0.5, "2025-01", "2026-01", result["series"]) is None

    def test_evds_is_preferred_when_key_exists(self, monkeypatch):
        monkeypatch.setenv("EVDS_API_KEY", "test-key")
        session = MagicMock()
        session.get.return_value = MagicMock(
            json=lambda: {"items": [{"Tarih": "2026-07", "TP_FG_J0": "3120.5"}]},
            raise_for_status=lambda: None,
        )

        result = load_cpi(session)

        assert result["source"] == "TCMB EVDS"
        assert result["series"] == {"2026-07": 3120.5}
