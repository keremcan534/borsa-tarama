import pytest

from app.core.config import settings
from app.data.markets import MARKET_FILES, enabled_markets, is_enabled, load_symbols


@pytest.fixture
def set_enabled(monkeypatch):
    def _set(markets):
        monkeypatch.setattr(settings, "enabled_markets", markets)

    return _set


def test_default_enabled_markets():
    # BIST (borsanın tamamı) + S&P 500 + emtia açık; ETF kapalı (tarama/strateji
    # vizyonunda yok, ama sembol listesi ve kod duruyor — açmak tek satır).
    assert "bist" in enabled_markets()
    assert "sp500" in enabled_markets()
    assert "commodity" in enabled_markets()
    assert "etf" not in enabled_markets()
    # Endeks listesi tanımlı kalır ama taranmaz: "bist" onu zaten kapsıyor,
    # ikisini birden taramak aynı 100 hisseyi iki kez çekerdi.
    assert "bist100" in MARKET_FILES
    assert "bist100" not in enabled_markets()


def test_bist_market_covers_the_whole_exchange_and_contains_the_index():
    """Kapsam kilitli: "bist" hem geniş hem BIST 100'ün üst kümesi olmalı.

    Üst küme olmazsa endeks üyelik bayrağı (app/data/indices.py) taranmayan
    hisselere işaret eder ve "yalnızca BIST 100" filtresi eksik liste gösterirdi.
    """
    everything = set(load_symbols("bist"))
    assert len(everything) > 500
    assert set(load_symbols("bist100")) <= everything


def test_disabled_market_keeps_its_definition_and_symbols():
    # Kapatmak silmek değil: geri açmak tek satır olmalı
    assert "sp500" in MARKET_FILES
    assert len(load_symbols("sp500")) > 400


def test_enabled_markets_preserves_definition_order(set_enabled):
    set_enabled(["commodity", "bist100"])
    assert enabled_markets() == ["bist100", "commodity"]


def test_unknown_market_in_config_is_ignored(set_enabled):
    set_enabled(["bist100", "yokboyle"])
    assert enabled_markets() == ["bist100"]


def test_is_enabled(set_enabled):
    set_enabled(["bist100"])
    assert is_enabled("bist100")
    assert not is_enabled("sp500")


def test_enabling_sp500_is_a_one_line_change(set_enabled):
    set_enabled(["bist100", "sp500", "etf", "commodity"])
    assert enabled_markets() == ["bist100", "sp500", "etf", "commodity"]


@pytest.mark.parametrize("market", list(MARKET_FILES))
def test_every_defined_market_has_a_readable_symbol_list(market):
    symbols = load_symbols(market)
    assert symbols and all(isinstance(s, str) for s in symbols)
