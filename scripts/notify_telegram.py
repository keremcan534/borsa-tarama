"""Son tarama JSON'larını okuyup Telegram kanalına/sohbetine özet gönderir.

Gerekli ortam değişkenleri:
  TELEGRAM_BOT_TOKEN  -> @BotFather'dan alınan bot token'ı
  TELEGRAM_CHAT_ID    -> mesajın gideceği kanal/sohbet id'si (örn. @kanaladi veya -100...)

Kullanım (repo kökünden):
    python scripts/notify_telegram.py frontend/public/data
"""

import json
import os
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.scheduler import MARKET_FILES
from app.notify.format import format_telegram_message


def load_payloads(data_dir: Path) -> dict:
    payloads = {}
    for market in MARKET_FILES:
        path = data_dir / f"{market}.json"
        if path.exists():
            payloads[market] = json.loads(path.read_text(encoding="utf-8"))
    return payloads


def main() -> None:
    data_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "frontend/public/data")
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        print("[TELEGRAM] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID tanımlı değil, bildirim atlandı")
        return

    payloads = load_payloads(data_dir)
    if not payloads:
        print("[TELEGRAM] veri dosyası bulunamadı, bildirim atlandı")
        return

    resp = requests.post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        json={
            "chat_id": chat_id,
            "text": format_telegram_message(payloads),
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        },
        timeout=30,
    )
    resp.raise_for_status()
    print("[TELEGRAM] bildirim gönderildi")


if __name__ == "__main__":
    main()
