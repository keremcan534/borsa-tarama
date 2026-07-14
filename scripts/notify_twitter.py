"""Son tarama JSON'larını okuyup X'e (Twitter) özet tweet atar.

Gerekli ortam değişkenleri (developer.x.com'daki uygulamandan):
  TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET

Kullanım (repo kökünden):
    python scripts/notify_twitter.py frontend/public/data
"""

import os
import sys
from pathlib import Path

import tweepy

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.notify.format import format_tweet
from scripts.notify_telegram import load_payloads


REQUIRED_VARS = ("TWITTER_API_KEY", "TWITTER_API_SECRET", "TWITTER_ACCESS_TOKEN", "TWITTER_ACCESS_SECRET")


def main() -> None:
    data_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "frontend/public/data")
    if not all(os.environ.get(v) for v in REQUIRED_VARS):
        print("[TWITTER] API anahtarları tanımlı değil, paylaşım atlandı")
        return

    payloads = load_payloads(data_dir)
    if not payloads:
        print("[TWITTER] veri dosyası bulunamadı, paylaşım atlandı")
        return

    client = tweepy.Client(
        consumer_key=os.environ["TWITTER_API_KEY"],
        consumer_secret=os.environ["TWITTER_API_SECRET"],
        access_token=os.environ["TWITTER_ACCESS_TOKEN"],
        access_token_secret=os.environ["TWITTER_ACCESS_SECRET"],
    )
    client.create_tweet(text=format_tweet(payloads))
    print("[TWITTER] tweet gönderildi")


if __name__ == "__main__":
    main()
