"""Sinyal veren hisseler için haber başlıklarını toplar (agregatör modeli).

Yalnızca başlık + kaynak + link + tarih saklanır; içerik metni ASLA kopyalanmaz
(telif). BIST hisseleri için Google News Türkçe RSS, ABD hisseleri için Yahoo
Finance haber verisi kullanılır.
"""

import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import requests

GOOGLE_NEWS_RSS = "https://news.google.com/rss/search?q={query}&hl=tr&gl=TR&ceid=TR:tr"
HEADERS = {"User-Agent": "Mozilla/5.0 (borsa-tarama news aggregator)"}
REQUEST_DELAY_SECONDS = 0.5  # RSS uçlarını yormamak için semboller arası bekleme

# Haber olmayan, otomatik üretilen fiyat/grafik/şablon sayfası başlıkları (elenir)
LOW_QUALITY_PATTERNS = re.compile(
    r"canlı grafik|hisse senedi canlı|hisse senedi fiyat|hisse fiyatı|kaç tl|ne kadar oldu"
    r"|anlık takip|canlı borsa|hisse yorum ve grafik|günlük teknik analiz"
    r"|hisse senedi\s*[-–]|hisse senedi$|hedef fiyat listesi|şirket kart[ıi]",
    re.IGNORECASE,
)


def is_low_quality(title: str) -> bool:
    """Gerçek haber olmayan (fiyat/grafik sayfası) başlıkları yakalar."""
    return bool(LOW_QUALITY_PATTERNS.search(title))


def parse_google_rss(xml_text: str, symbol: str) -> list[dict]:
    """Google News RSS çıktısını normalize edilmiş haber sözlüklerine çevirir."""
    items = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return items

    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        if not title or not link:
            continue

        source = (item.findtext("source") or "").strip() or None
        published_at = None
        pub_date = item.findtext("pubDate")
        if pub_date:
            try:
                published_at = parsedate_to_datetime(pub_date).astimezone(timezone.utc).isoformat()
            except (ValueError, TypeError):
                pass

        items.append(
            {"symbol": symbol, "title": title, "source": source, "link": link, "published_at": published_at}
        )
    return items


def normalize_yahoo_item(item: dict, symbol: str) -> dict | None:
    """yfinance'in eski ve yeni haber formatlarını tek şekle indirger."""
    content = item.get("content") if isinstance(item.get("content"), dict) else item

    title = (content.get("title") or "").strip()
    if not title:
        return None

    link = None
    for key in ("canonicalUrl", "clickThroughUrl"):
        url_obj = content.get(key)
        if isinstance(url_obj, dict) and url_obj.get("url"):
            link = url_obj["url"]
            break
    link = link or content.get("link")
    if not link:
        return None

    source = None
    provider = content.get("provider")
    if isinstance(provider, dict):
        source = provider.get("displayName")
    source = source or content.get("publisher")

    published_at = None
    if content.get("pubDate"):
        published_at = content["pubDate"]
    elif content.get("providerPublishTime"):
        try:
            published_at = datetime.fromtimestamp(
                content["providerPublishTime"], tz=timezone.utc
            ).isoformat()
        except (ValueError, TypeError, OSError):
            pass

    return {"symbol": symbol, "title": title, "source": source, "link": link, "published_at": published_at}


def fetch_symbol_news(symbol: str) -> list[dict]:
    """Tek sembol için haberleri kaynağına göre çeker (BIST -> Google TR, ABD -> Yahoo)."""
    if symbol.endswith(".IS"):
        query = f"{symbol.removesuffix('.IS')} hisse"
        resp = requests.get(GOOGLE_NEWS_RSS.format(query=query), headers=HEADERS, timeout=20)
        resp.raise_for_status()
        return parse_google_rss(resp.text, symbol)

    import yfinance as yf

    raw = yf.Ticker(symbol).news or []
    items = [normalize_yahoo_item(item, symbol) for item in raw]
    return [i for i in items if i]


def merge_news(all_items: list[dict], per_symbol: int = 5, total: int = 60) -> list[dict]:
    """Sembol başına ve toplamda sınırlar, başlığa göre tekilleştirir, yeniden eskiye sıralar."""
    per_symbol_counts: dict[str, int] = {}
    seen_titles: set[str] = set()
    merged = []

    def sort_key(item):
        return item["published_at"] or ""

    for item in sorted(all_items, key=sort_key, reverse=True):
        if is_low_quality(item["title"]):
            continue
        key = item["title"].lower()
        if key in seen_titles:
            continue
        if per_symbol_counts.get(item["symbol"], 0) >= per_symbol:
            continue
        seen_titles.add(key)
        per_symbol_counts[item["symbol"]] = per_symbol_counts.get(item["symbol"], 0) + 1
        merged.append(item)
        if len(merged) >= total:
            break
    return merged


def build_news_payload(market: str, symbols: list[str], max_symbols: int = 25) -> dict:
    """Verilen sembol listesi için haber payload'u üretir (dosyaya yazılmaya hazır)."""
    all_items = []
    for symbol in symbols[:max_symbols]:
        try:
            all_items.extend(fetch_symbol_news(symbol))
        except Exception as e:
            print(f"[HABER-UYARI] {symbol} haberleri alınamadı: {e}")
        time.sleep(REQUEST_DELAY_SECONDS)

    return {
        "market": market.upper(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "items": merge_news(all_items),
    }
