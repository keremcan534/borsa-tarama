"""Haftalık backtest sonucunu (data/backtest.json) okuyup X'e performans özeti paylaşır.

Ham sinyal listesi değil, sinyallerin GERÇEK geçmiş başarı oranını (kazanma oranı,
endeksi yenme oranı) paylaşır — otomatik hesaplarda en çok paylaşılan/güven inşa
eden içerik türü budur. `notify_twitter.py`'nin günlük sinyal tweet'inden ayrı ve
haftada bir (backtest workflow'unun sonunda) çalışır.

Gerekli ortam değişkenleri (developer.x.com'daki uygulamandan, notify_twitter.py
ile aynı uygulama/anahtarlar kullanılabilir):
  TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET

Kullanım (repo kökünden):
    python scripts/notify_backtest_tweet.py data/backtest.json
"""

import json
import os
import sys
from pathlib import Path

import tweepy

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.notify.format import format_backtest_tweet

REQUIRED_VARS = ("TWITTER_API_KEY", "TWITTER_API_SECRET", "TWITTER_ACCESS_TOKEN", "TWITTER_ACCESS_SECRET")


def main() -> None:
    data_path = Path(sys.argv[1] if len(sys.argv) > 1 else "data/backtest.json")
    if not all(os.environ.get(v) for v in REQUIRED_VARS):
        print("[TWITTER] API anahtarları tanımlı değil, performans paylaşımı atlandı")
        return

    if not data_path.exists():
        print(f"[TWITTER] {data_path} bulunamadı, performans paylaşımı atlandı")
        return

    payload = json.loads(data_path.read_text(encoding="utf-8"))
    tweet = format_backtest_tweet(payload)
    if not tweet:
        print("[TWITTER] backtest verisinde paylaşılacak ufuk yok, atlandı")
        return

    client = tweepy.Client(
        consumer_key=os.environ["TWITTER_API_KEY"],
        consumer_secret=os.environ["TWITTER_API_SECRET"],
        access_token=os.environ["TWITTER_ACCESS_TOKEN"],
        access_token_secret=os.environ["TWITTER_ACCESS_SECRET"],
    )
    client.create_tweet(text=tweet)
    print("[TWITTER] performans özeti tweeti gönderildi")


if __name__ == "__main__":
    main()
