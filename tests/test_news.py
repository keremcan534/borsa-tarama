from app.news.collect import merge_news, normalize_yahoo_item, parse_google_rss

SAMPLE_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Google News</title>
  <item>
    <title>EREGL için hedef fiyat güncellendi</title>
    <link>https://example.com/haber-1</link>
    <pubDate>Tue, 14 Jul 2026 09:00:00 GMT</pubDate>
    <source url="https://example.com">Örnek Gazete</source>
  </item>
  <item>
    <title>Demir çelik sektöründe son durum</title>
    <link>https://example.com/haber-2</link>
    <pubDate>Mon, 13 Jul 2026 15:30:00 GMT</pubDate>
    <source url="https://kaynak.com">Kaynak Haber</source>
  </item>
  <item>
    <title></title>
    <link>https://example.com/bos-baslik</link>
  </item>
</channel></rss>"""


def test_parse_google_rss_extracts_items():
    items = parse_google_rss(SAMPLE_RSS, "EREGL.IS")
    assert len(items) == 2  # boş başlıklı öğe elenir
    first = items[0]
    assert first["symbol"] == "EREGL.IS"
    assert first["title"] == "EREGL için hedef fiyat güncellendi"
    assert first["source"] == "Örnek Gazete"
    assert first["link"] == "https://example.com/haber-1"
    assert first["published_at"].startswith("2026-07-14T09:00:00")


def test_parse_google_rss_handles_invalid_xml():
    assert parse_google_rss("bu xml degil <<", "X") == []


def test_normalize_yahoo_new_format():
    item = {
        "content": {
            "title": "Apple beats expectations",
            "pubDate": "2026-07-14T12:00:00Z",
            "provider": {"displayName": "Reuters"},
            "canonicalUrl": {"url": "https://example.com/aapl"},
        }
    }
    result = normalize_yahoo_item(item, "AAPL")
    assert result == {
        "symbol": "AAPL",
        "title": "Apple beats expectations",
        "source": "Reuters",
        "link": "https://example.com/aapl",
        "published_at": "2026-07-14T12:00:00Z",
    }


def test_normalize_yahoo_old_format():
    item = {
        "title": "Old format news",
        "publisher": "Bloomberg",
        "link": "https://example.com/old",
        "providerPublishTime": 1780000000,
    }
    result = normalize_yahoo_item(item, "JPM")
    assert result["title"] == "Old format news"
    assert result["source"] == "Bloomberg"
    assert result["published_at"] is not None


def test_normalize_yahoo_returns_none_without_link():
    assert normalize_yahoo_item({"content": {"title": "Linksiz haber"}}, "X") is None


def test_merge_news_dedupes_and_caps():
    items = [
        {"symbol": "A", "title": "Aynı Başlık", "source": None, "link": "l1", "published_at": "2026-07-14T10:00:00Z"},
        {"symbol": "A", "title": "aynı başlık", "source": None, "link": "l2", "published_at": "2026-07-14T09:00:00Z"},
        {"symbol": "B", "title": "Farklı", "source": None, "link": "l3", "published_at": "2026-07-14T11:00:00Z"},
    ]
    merged = merge_news(items)
    assert len(merged) == 2
    assert merged[0]["title"] == "Farklı"  # en yeni önce


def test_merge_news_drops_quote_page_titles():
    items = [
        {"symbol": "A", "title": "EREGLI Hisse Senedi Canlı Grafik - Portal", "source": None, "link": "l1", "published_at": "2026-07-14T10:00:00Z"},
        {"symbol": "A", "title": "GESAN Hisse Yorumları (Güncel Yorumlar) - Portal", "source": None, "link": "l2", "published_at": "2026-07-14T10:30:00Z"},
        {"symbol": "A", "title": "Ereğli'den yeni yatırım hamlesi", "source": None, "link": "l3", "published_at": "2026-07-14T09:00:00Z"},
    ]
    merged = merge_news(items)
    assert len(merged) == 1
    assert merged[0]["title"] == "Ereğli'den yeni yatırım hamlesi"


def test_merge_news_respects_per_symbol_limit():
    items = [
        {"symbol": "A", "title": f"Haber {i}", "source": None, "link": f"l{i}", "published_at": f"2026-07-{10 + i:02d}T10:00:00Z"}
        for i in range(8)
    ]
    merged = merge_news(items, per_symbol=5)
    assert len(merged) == 5
