"""Sunucu tarafı alarmlar: tarama sonrası eşik kontrolü ve bildirim metni.

Neden gerekli: arayüzdeki alarmlar `new Notification` ile tarayıcıda çalışıyor —
yani **yalnızca site açıkken**. Sekme kapalıyken hiçbir şey olmuyor. Bu, "fiyat
alarmı" vaadinin en zayıf yeri.

## Kapsam: site sahibinin alarmları, ziyaretçininki değil

Site sunucusuz çalışıyor (GitHub Pages) ve ziyaretçilerin alarmları yalnızca kendi
tarayıcılarında duruyor — bu bilinçli bir gizlilik kararı ve değişmedi. Burada
kurulan şey farklı: **repoda tanımlı** alarm kuralları her taramadan sonra
değerlendirilir ve Telegram'a düşer. Yani site sahibi sekmeyi açık tutmak zorunda
kalmadan takip edebilir.

Ziyaretçiye kalıcı bildirim için sunucu ve hesap gerekir; o, mimarinin tamamını
değiştiren ayrı bir karardır ve burada verilmiyor.

## Kural biçimi (`alerts.json`)

    [
      {"symbol": "THYAO.IS", "field": "close", "op": "above", "value": 300},
      {"symbol": "ASELS.IS", "kind": "signal"},
      {"symbol": "AKBNK.IS", "field": "rsi", "op": "below", "value": 30}
    ]

- `kind: "signal"` -> hisse taramanın filtresine YENİ girdiğinde tetiklenir.
- Eşik kuralları taramanın ürettiği herhangi bir sayısal alana bakabilir
  (`close`, `rsi`, `stoch_k`, `pe`, `change` ...).

## Neden "yeniden tetiklenme" kontrolü yok

Alarm her taramada koşul sağlandığı sürece tetiklenir. Bir kez tetikleyip susmak
için tetiklenme durumunu kalıcı saklamak gerekirdi; tarama durumsuzdur ve arşivi
yayındaki dosyadan okur. Gün sonu verisiyle günde iki kez çalışan bir tarama için
tekrar eden bildirim, kaçırılan bildirimden daha az zararlıdır.
"""

import json
from pathlib import Path

ALERTS_PATH = Path(__file__).resolve().parents[2] / "alerts.json"

# Kural gövdesinde beklenen alanlar; fazlası yok sayılır, eksiği kuralı düşürür.
OPERATORS = {
    "above": lambda value, threshold: value > threshold,
    "below": lambda value, threshold: value < threshold,
}


def load_rules(path: Path | None = None) -> list[dict]:
    """Alarm kurallarını okur. Dosya yoksa boş liste (özellik kapalı demektir)."""
    path = path or ALERTS_PATH
    if not path.exists():
        return []
    try:
        rules = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"[ALARM] {path} okunamadı ({e}); alarmlar atlandı")
        return []
    return rules if isinstance(rules, list) else []


def _stocks_by_symbol(payloads: dict) -> dict[str, dict]:
    """Tüm marketlerin GÜNLÜK taramasındaki hisseleri sembole göre indeksler."""
    out: dict[str, dict] = {}
    for payload in payloads.values():
        for stock in payload.get("stocks") or []:
            out.setdefault(stock["symbol"], stock)
    return out


def _fresh_signals(payloads: dict) -> set[str]:
    """Bu taramada filtreye YENİ giren semboller."""
    fresh: set[str] = set()
    for payload in payloads.values():
        for result in payload.get("results") or []:
            if result.get("is_new") or result.get("signal_fresh"):
                fresh.add(result["symbol"])
    return fresh


def evaluate(rules: list[dict], payloads: dict) -> list[dict]:
    """Tetiklenen alarmları döner: [{"symbol", "reason", "value"}].

    Bilinmeyen sembol/alan sessizce atlanır — kural dosyasındaki bir yazım hatası
    yüzünden taramanın bildirim adımı çökmemeli.
    """
    stocks = _stocks_by_symbol(payloads)
    fresh = _fresh_signals(payloads)
    triggered: list[dict] = []

    for rule in rules:
        if not isinstance(rule, dict):
            continue
        symbol = rule.get("symbol")
        if not symbol:
            continue

        if rule.get("kind") == "signal":
            if symbol in fresh:
                triggered.append({"symbol": symbol, "reason": "signal", "value": None})
            continue

        stock = stocks.get(symbol)
        field = rule.get("field")
        threshold = rule.get("value")
        operator = OPERATORS.get(rule.get("op"))
        if not stock or not field or operator is None or not isinstance(threshold, (int, float)):
            continue

        value = stock.get(field)
        if not isinstance(value, (int, float)):
            continue

        if operator(value, threshold):
            triggered.append(
                {
                    "symbol": symbol,
                    "reason": f"{field} {rule['op']} {threshold}",
                    "value": value,
                    "field": field,
                }
            )

    return triggered


def format_alert_message(triggered: list[dict]) -> str:
    """Telegram mesajı. Tetiklenen alarm yoksa boş string (mesaj gönderilmez)."""
    if not triggered:
        return ""

    lines = ["🔔 <b>Alarm</b>", ""]
    for item in triggered:
        code = item["symbol"].removesuffix(".IS")
        if item["reason"] == "signal":
            lines.append(f"• <b>{code}</b> taramaya yeni girdi")
        else:
            value = item["value"]
            shown = f"{value:.2f}".rstrip("0").rstrip(".") if isinstance(value, float) else value
            lines.append(f"• <b>{code}</b> {item['reason']} (şu an {shown})")

    lines.append("")
    lines.append("<i>Gün sonu kapanış verisiyle. Yatırım tavsiyesi değildir.</i>")
    return "\n".join(lines)
