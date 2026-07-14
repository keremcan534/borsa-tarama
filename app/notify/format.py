"""Tarama sonuçlarını bildirim kanalları (Telegram, X/Twitter) için metne çevirir."""

from datetime import datetime
from zoneinfo import ZoneInfo

SITE_URL = "https://keremcan534.github.io/borsa-tarama/"
DISCLAIMER = "Yatırım tavsiyesi değildir."

MARKET_LABELS = {"bist100": "🇹🇷 BIST 100", "sp500": "🇺🇸 S&P 500"}

# Naif len() emoji/URL ağırlıklarını tam sayamadığı için 280 yerine güvenli pay
TWEET_LIMIT = 270


def _scan_time(payloads: dict) -> str:
    for payload in payloads.values():
        if payload.get("generated_at"):
            dt = datetime.fromisoformat(payload["generated_at"])
            return dt.astimezone(ZoneInfo("Europe/Istanbul")).strftime("%d.%m.%Y %H:%M")
    return ""


def _symbols_line(results: list[dict], limit: int) -> str:
    names = [r["symbol"].removesuffix(".IS") for r in results[:limit]]
    text = ", ".join(names)
    extra = len(results) - limit
    if extra > 0:
        text += f" (+{extra})"
    return text


def format_telegram_message(payloads: dict) -> str:
    lines = [f"📊 <b>Borsa Tarama</b> — {_scan_time(payloads)}"]
    for market, payload in payloads.items():
        label = MARKET_LABELS.get(market, market.upper())
        results = payload.get("results", [])
        lines.append("")
        lines.append(f"{label}: <b>{len(results)}</b> hisse")
        if results:
            lines.append(_symbols_line(results, 10))
    lines += ["", SITE_URL, f"⚠️ {DISCLAIMER}"]
    return "\n".join(lines)


def format_tweet(payloads: dict) -> str:
    for symbol_limit in (5, 3, 0):
        parts = [f"📊 Borsa Tarama {_scan_time(payloads)}"]
        for market, payload in payloads.items():
            label = MARKET_LABELS.get(market, market.upper())
            results = payload.get("results", [])
            line = f"{label}: {len(results)} hisse"
            if results and symbol_limit:
                line += " — " + _symbols_line(results, symbol_limit)
            parts.append(line)
        parts.append(SITE_URL)
        parts.append(f"⚠️ {DISCLAIMER}")
        text = "\n".join(parts)
        if len(text) <= TWEET_LIMIT:
            return text
    return text[:TWEET_LIMIT]
