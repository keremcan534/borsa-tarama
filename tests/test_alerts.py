"""Sunucu tarafı alarm değerlendirme."""

import json

from app.notify.alerts import evaluate, format_alert_message, load_rules

PAYLOADS = {
    "bist": {
        "stocks": [
            {"symbol": "THYAO.IS", "close": 320.0, "rsi": 72.0, "change": 0.03},
            {"symbol": "AKBNK.IS", "close": 60.0, "rsi": 28.0, "change": -0.02},
        ],
        "results": [{"symbol": "AKBNK.IS", "is_new": True}],
    }
}


class TestThresholds:
    def test_above_triggers_when_value_exceeds(self):
        rules = [{"symbol": "THYAO.IS", "field": "close", "op": "above", "value": 300}]
        triggered = evaluate(rules, PAYLOADS)
        assert [t["symbol"] for t in triggered] == ["THYAO.IS"]
        assert triggered[0]["value"] == 320.0

    def test_above_does_not_trigger_at_or_below(self):
        assert evaluate([{"symbol": "THYAO.IS", "field": "close", "op": "above", "value": 320}], PAYLOADS) == []

    def test_below_triggers(self):
        rules = [{"symbol": "AKBNK.IS", "field": "rsi", "op": "below", "value": 30}]
        assert len(evaluate(rules, PAYLOADS)) == 1

    def test_any_numeric_field_works(self):
        rules = [{"symbol": "AKBNK.IS", "field": "change", "op": "below", "value": 0}]
        assert len(evaluate(rules, PAYLOADS)) == 1


class TestSignalRules:
    def test_signal_rule_fires_for_fresh_entry(self):
        assert evaluate([{"symbol": "AKBNK.IS", "kind": "signal"}], PAYLOADS)[0]["reason"] == "signal"

    def test_signal_rule_silent_for_stock_not_freshly_entering(self):
        assert evaluate([{"symbol": "THYAO.IS", "kind": "signal"}], PAYLOADS) == []


class TestMalformedRulesAreSkipped:
    """Kural dosyasındaki yazım hatası, taramanın bildirim adımını ÇÖKERTMEMELİ."""

    def test_unknown_symbol(self):
        assert evaluate([{"symbol": "YOKBU.IS", "field": "close", "op": "above", "value": 1}], PAYLOADS) == []

    def test_unknown_field_and_operator(self):
        assert evaluate([{"symbol": "THYAO.IS", "field": "yok", "op": "above", "value": 1}], PAYLOADS) == []
        assert evaluate([{"symbol": "THYAO.IS", "field": "close", "op": "yaklaş", "value": 1}], PAYLOADS) == []

    def test_missing_pieces(self):
        assert evaluate([{}], PAYLOADS) == []
        assert evaluate([{"symbol": "THYAO.IS"}], PAYLOADS) == []
        assert evaluate(["bu bir kural değil"], PAYLOADS) == []

    def test_non_numeric_threshold(self):
        rules = [{"symbol": "THYAO.IS", "field": "close", "op": "above", "value": "üç yüz"}]
        assert evaluate(rules, PAYLOADS) == []


class TestMessage:
    def test_empty_when_nothing_triggered(self):
        """Boş mesaj gönderilmez: her taramada 'alarm yok' bildirimi gürültüdür."""
        assert format_alert_message([]) == ""

    def test_lists_each_trigger_and_carries_the_disclaimer(self):
        message = format_alert_message(evaluate(
            [
                {"symbol": "THYAO.IS", "field": "close", "op": "above", "value": 300},
                {"symbol": "AKBNK.IS", "kind": "signal"},
            ],
            PAYLOADS,
        ))
        assert "THYAO" in message and "AKBNK" in message
        assert "taramaya yeni girdi" in message
        assert "Yatırım tavsiyesi değildir" in message
        assert ".IS" not in message  # arayüzde olduğu gibi sade kod gösterilir


class TestLoadRules:
    def test_missing_file_means_feature_off(self, tmp_path):
        assert load_rules(tmp_path / "yok.json") == []

    def test_broken_json_does_not_raise(self, tmp_path):
        path = tmp_path / "alerts.json"
        path.write_text("{bozuk", encoding="utf-8")
        assert load_rules(path) == []

    def test_non_list_payload_is_rejected(self, tmp_path):
        path = tmp_path / "alerts.json"
        path.write_text(json.dumps({"symbol": "THYAO.IS"}), encoding="utf-8")
        assert load_rules(path) == []

    def test_reads_a_valid_file(self, tmp_path):
        path = tmp_path / "alerts.json"
        path.write_text(json.dumps([{"symbol": "THYAO.IS", "kind": "signal"}]), encoding="utf-8")
        assert load_rules(path) == [{"symbol": "THYAO.IS", "kind": "signal"}]
