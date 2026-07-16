import pytest

from app.core.config import settings
from app.data.markets import MARKET_FILES, enabled_markets, is_enabled, load_symbols


@pytest.fixture
def set_enabled(monkeypatch):
    def _set(markets):
        monkeypatch.setattr(settings, "enabled_markets", markets)

    return _set


def test_sp500_is_disabled_by_default():
    # 503 sembol x 4 zaman dilimi taramanın ~%76'sıydı; kapalı olması bilinçli.
    assert "sp500" not in enabled_markets()
    assert "bist100" in enabled_markets()


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
