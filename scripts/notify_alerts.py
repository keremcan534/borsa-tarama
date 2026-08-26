"""Repoda tanımlı alarm kurallarını değerlendirip Telegram'a gönderir.

Tarama bittikten sonra çalışır. Kural dosyası (`alerts.json`) yoksa ya da hiçbir
kural tetiklenmediyse sessizce çıkar — her koşuda "alarm yok" mesajı göndermek
kanalı gürültüye boğardı.

Gerekli ortam değişkenleri (yoksa adım sessizce atlanır, tarama etkilenmez):
  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

Kullanım (repo kökünden):
    python scripts/notify_alerts.py frontend/public/data
"""

import json
import os
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.data.markets import MARKET_FILES  # noqa: E402
from app.notify.alerts import evaluate, format_alert_message, load_rules  # noqa: E402

TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"


def load_payloads(data_dir: Path) -> dict:
    """Günlük tarama çıktıları (market başına bir dosya)."""
    payloads = {}
    for market in MARKET_FILES:
        path = data_dir / f"{market}.json"
        if path.exists():
            try:
                payloads[market] = json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError as e:
                print(f"[ALARM] {path.name} okunamadı ({e})")
    return payloads


def main() -> int:
    data_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "frontend/public/data")

    rules = load_rules()
    if not rules:
        print("[ALARM] alerts.json yok ya da boş; alarm adımı atlandı")
        return 0

    triggered = evaluate(rules, load_payloads(data_dir))
    if not triggered:
        print(f"[ALARM] {len(rules)} kural değerlendirildi, tetiklenen yok")
        return 0

    message = format_alert_message(triggered)
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        # Token yokken de değerlendirme yapılır ve loga basılır: kuralların doğru
        # çalıştığı, bot kurulmadan önce de görülebilsin.
        print(f"[ALARM] {len(triggered)} alarm tetiklendi ama Telegram tanımlı değil:\n{message}")
        return 0

    try:
        response = requests.post(
            TELEGRAM_API.format(token=token),
            json={"chat_id": chat_id, "text": message, "parse_mode": "HTML"},
            timeout=20,
        )
        response.raise_for_status()
        print(f"[ALARM] {len(triggered)} alarm gönderildi")
    except Exception as e:
        # Bildirim gönderilemedi diye yayın adımı düşmemeli.
        print(f"[ALARM] gönderilemedi ({e})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
