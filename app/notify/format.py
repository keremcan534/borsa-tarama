"""Tarama sonuçlarını bildirim kanalları (Telegram, X/Twitter) için metne çevirir."""

from datetime import datetime
from zoneinfo import ZoneInfo

SITE_URL = "https://keremcan534.github.io/borsa-tarama/"
DISCLAIMER = "Yatırım tavsiyesi değildir."
# Backtest sekmesindeki caveat listesinin son satırıyla aynı tonda; o liste
# yoksa/değişirse tweet yine de doğru bir uyarıyla çıksın diye burada da durur.
BACKTEST_DISCLAIMER = "Geçmiş performans gelecek getirinin garantisi değildir. Yatırım tavsiyesi değildir."

MARKET_LABELS = {"bist100": "🇹🇷 BIST 100", "sp500": "🇺🇸 S&P 500"}

# Naif len() emoji/URL ağırlıklarını tam sayamadığı için 280 yerine güvenli pay
TWEET_LIMIT = 270


def _fmt_dt(iso: str) -> str:
    dt = datetime.fromisoformat(iso)
    return dt.astimezone(ZoneInfo("Europe/Istanbul")).strftime("%d.%m.%Y %H:%M")


def _fmt_date(iso: str) -> str:
    dt = datetime.fromisoformat(iso)
    return dt.astimezone(ZoneInfo("Europe/Istanbul")).strftime("%d.%m.%Y")


def _scan_time(payloads: dict) -> str:
    for payload in payloads.values():
        if payload.get("generated_at"):
            return _fmt_dt(payload["generated_at"])
    return ""


def _symbols_line(results: list[dict], limit: int, cashtag: bool = False) -> str:
    # cashtag=True: X'te "$SEMBOL" formatı tweeti o hissenin cashtag arama/keşif
    # sayfasında görünür kılar — ücretsiz bir ek dağıtım kanalı. Telegram'da
    # anlamsız olduğundan yalnızca format_tweet bunu açar.
    def fmt(symbol: str) -> str:
        base = symbol.removesuffix(".IS")
        return f"${base}" if cashtag else base

    names = [fmt(r["symbol"]) for r in results[:limit]]
    text = ", ".join(names)
    extra = len(results) - limit
    if extra > 0:
        text += f" (+{extra})"
    return text


def _new_symbols(results: list[dict]) -> list[str]:
    return [r["symbol"].removesuffix(".IS") for r in results if r.get("is_new")]


def format_telegram_message(payloads: dict) -> str:
    lines = [f"📊 <b>Borsa Tarama</b> — {_scan_time(payloads)}"]
    for market, payload in payloads.items():
        label = MARKET_LABELS.get(market, market.upper())
        results = payload.get("results", [])
        lines.append("")
        lines.append(f"{label}: <b>{len(results)}</b> hisse")
        if results:
            lines.append(_symbols_line(results, 10))
        new_syms = _new_symbols(results)
        if new_syms:
            lines.append(f"🆕 Yeni sinyal: {', '.join(new_syms[:8])}")
    lines += ["", SITE_URL, f"⚠️ {DISCLAIMER}"]
    return "\n".join(lines)


def format_tweet(payloads: dict) -> str:
    total_new = sum(len(_new_symbols(p.get("results", []))) for p in payloads.values())
    # En zengin halden en sıkışığa doğru dener: önce cashtag'li + hashtag'li,
    # sığmazsa sırayla hashtag, sonra sembol sayısı düşer. Cashtag EN SON atılır —
    # X'in keşif/arama kanalı olduğundan en değerli parça.
    variants = [(5, True), (5, False), (3, False), (0, False)]
    for symbol_limit, use_hashtag in variants:
        parts = [f"📊 Borsa Tarama {_scan_time(payloads)}"]
        for market, payload in payloads.items():
            label = MARKET_LABELS.get(market, market.upper())
            results = payload.get("results", [])
            line = f"{label}: {len(results)} hisse"
            if results and symbol_limit:
                line += " — " + _symbols_line(results, symbol_limit, cashtag=True)
            parts.append(line)
        if total_new:
            parts.append(f"🆕 {total_new} yeni sinyal")
        if use_hashtag:
            parts.append("#Borsa")
        parts.append(SITE_URL)
        parts.append(f"⚠️ {DISCLAIMER}")
        text = "\n".join(parts)
        if len(text) <= TWEET_LIMIT:
            return text
    return text[:TWEET_LIMIT]


def _pick_horizon(summary: dict) -> tuple[int, dict] | None:
    """Bir market/timeframe backtest özetinden ortanca ufku seçer.

    En kısa ufuk (ör. 5 mum) gürültüye en yakın, en uzunu genelde en az örnekli;
    ortanca ufuk çoğu zaman en dengeli/temsili hikayeyi anlatır.
    """
    bars_list = summary.get("horizons_bars") or []
    horizons = summary.get("horizons") or {}
    if not bars_list:
        return None
    bars = bars_list[len(bars_list) // 2]
    stats = horizons.get(str(bars))
    return (bars, stats) if stats else None


def format_backtest_tweet(payload: dict) -> str:
    """Haftalık backtest sonucunu güven inşa eden bir özet tweete çevirir.

    Ham sinyal listesi değil, "bu sinyallerin GERÇEK geçmiş başarı oranı ne"
    sorusuna cevap verir: kazanma oranı + endeksi yenme oranı. Şeffaflık içeriği
    ham sinyal spamından çok daha fazla paylaşılır ve güven inşa eder — otomatik
    hesaplarda en değerli tweet türü budur. `format_tweet`'ten AYRI ve haftada
    bir çalışır (backtest workflow'unun sonunda), günlük sinyal akışını boğmasın.
    Paylaşılacak veri yoksa (bozuk/eksik payload) boş string döner; çağıran
    script bunu "atla" sinyali olarak okur.
    """
    markets = payload.get("markets") or {}

    # Her market için iki satır hazırlanır: tam (endeksi yenme oranı dahil) ve
    # kompakt (yalnızca getiri + kazanma). Uzun disclaimer + iki market genelde
    # 270'i aşar; aşağıdaki degrade sırası önce süsü, sonra marketi kısar.
    full_lines, compact_lines = [], []
    for market in MARKET_LABELS:
        summary = (markets.get(market) or {}).get("daily")
        if not summary:
            continue
        picked = _pick_horizon(summary)
        if not picked:
            continue
        bars, stats = picked
        avg_return = stats.get("avg_return")
        win_rate = stats.get("win_rate")
        if avg_return is None or win_rate is None:
            continue
        label = MARKET_LABELS[market]
        compact = f"{label}: {bars} mumda %{avg_return * 100:+.1f} getiri, %{win_rate * 100:.0f} kazanma"
        compact_lines.append(compact)
        beat = stats.get("beat_benchmark_rate")
        full_lines.append(f"{compact}, endeksi %{beat * 100:.0f} yendi" if beat is not None else compact)

    if not full_lines:
        return ""

    date_str = _fmt_date(payload["generated_at"]) if payload.get("generated_at") else ""
    caveats = payload.get("caveats") or []
    disclaimer = caveats[-1] if caveats else BACKTEST_DISCLAIMER
    header = f"📈 Haftalık performans özeti — {date_str}".rstrip(" —")

    # En zengin halden en sıkışığa: tüm marketler + tam satır -> tüm marketler +
    # kompakt satır -> yalnızca ilk market + kompakt satır -> sert kırpma.
    for included in (full_lines, compact_lines, compact_lines[:1]):
        parts = [header, *included, SITE_URL, f"⚠️ {disclaimer}"]
        text = "\n".join(parts)
        if len(text) <= TWEET_LIMIT:
            return text
    return text[:TWEET_LIMIT]
