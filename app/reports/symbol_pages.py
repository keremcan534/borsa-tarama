"""Hisse başına statik HTML sayfası üretir (`/hisse/THYAO.html`).

Neden gerekli: sitenin arama motoru altyapısı (sitemap, robots, statik rapor
sayfaları) vardı ama **içerik ekseni yoktu**. Sitemap'teki 30 URL'in 28'i tarih
damgalı günlük rapordu; insanlar ise "THYAO teknik analiz", "ASELS hisse yorum"
diye arıyor. Bu sorgular için sitede hedef sayfa olmadığından organik trafik
kanalı fiilen kapalıydı.

Her sayfa tek bir hissenin o günkü teknik görünümünü, temel oranlarını, analist
konsensüsünü, son çeyrek finansallarını ve son KAP bildirimlerini taşır — yani
aranan şeyin cevabını sayfanın kendisinde verir, uygulamaya tıklamayı şart koşmaz.

## Tasarım kararları

- **Sayfa tek başına ayakta durur.** JavaScript yok, veri gömülü. Arama motoru
  render beklemez, kullanıcı da boş ekran görmez. (Uygulamanın kendisi SPA
  olduğundan `?v=…&s=…` derin bağlantısı indekslenebilir içerik üretmiyor —
  bu sayfaların var olma sebebi tam olarak bu.)
- **Uygulamaya geçiş bağlantısı sayfanın içinde.** Sayfa bir açılış kapısıdır;
  ziyaretçiyi ölü uçta bırakmaz.
- **Veri yoksa blok hiç basılmaz.** Boş bir "F/K: —" tablosu, arama motoruna da
  kullanıcıya da içerik varmış izlenimi verirdi.
- **Yatırım tavsiyesi uyarısı her sayfada.** Store/politika gereği değil, sayfa
  tek başına dolaştığı için: paylaşılan bağlantıda uygulamanın uyarısı görünmez.
"""

from datetime import datetime
from html import escape

from app.reports.generate import SITE_URL, _PAGE_CSS

SYMBOL_DIR = "hisse"

RECOMMENDATION_LABELS = {
    "strong_buy": "AL",
    "buy": "AL",
    "hold": "TUT",
    "sell": "SAT",
    "strong_sell": "SAT",
}


def symbol_slug(symbol: str) -> str:
    """`THYAO.IS` -> `THYAO`. Dosya adı ve URL'de kullanılır."""
    return symbol.removesuffix(".IS").replace("^", "_").replace("=", "_")


def symbol_url(symbol: str) -> str:
    return f"{SITE_URL}{SYMBOL_DIR}/{symbol_slug(symbol)}.html"


def _fmt(value, digits: int = 2, suffix: str = "") -> str | None:
    if value is None:
        return None
    try:
        return f"{float(value):,.{digits}f}".replace(",", " ").replace(".", ",") + suffix
    except (TypeError, ValueError):
        return None


def _fmt_pct(value, digits: int = 1) -> str | None:
    if value is None:
        return None
    try:
        return f"{float(value) * 100:+.{digits}f}%".replace(".", ",")
    except (TypeError, ValueError):
        return None


def _fmt_compact(value) -> str | None:
    """Milyar mertebesindeki tutarları okunur kısaltır (327108000000 -> 327,1 mlr)."""
    if value is None:
        return None
    try:
        value = float(value)
    except (TypeError, ValueError):
        return None
    sign = "-" if value < 0 else ""
    amount = abs(value)
    for scale, unit in ((1e12, "trl"), (1e9, "mlr"), (1e6, "mn"), (1e3, "bin")):
        if amount >= scale:
            return f"{sign}{_fmt(amount / scale, 1)} {unit}"
    return f"{sign}{_fmt(amount, 0)}"


def _rows(pairs: list[tuple[str, str | None]]) -> str:
    """Değeri olan satırları basar; hepsi boşsa boş string (blok hiç çizilmez)."""
    body = "".join(
        f"<tr><td>{escape(label)}</td><td>{escape(value)}</td></tr>"
        for label, value in pairs
        if value not in (None, "")
    )
    return f"<table><tbody>{body}</tbody></table>" if body else ""


def _technical_block(stock: dict) -> str:
    ema_rows = []
    for period in (9, 21, 50, 200):
        ema = stock.get(f"ema_{period}")
        if ema is None:
            continue
        above = stock["close"] > ema
        ema_rows.append((f"EMA {period}", f"{_fmt(ema)} — fiyat {'üstünde' if above else 'altında'}"))

    table = _rows(
        [
            ("RSI (14)", _fmt(stock.get("rsi"), 1)),
            ("MACD", _fmt(stock.get("macd_line"), 3)),
            ("Stokastik %K", _fmt(stock.get("stoch_k"), 1)),
            ("Stokastik RSI %K", _fmt(stock.get("stoch_rsi_k"), 1)),
            *ema_rows,
        ]
    )
    return f"<h2>Teknik görünüm</h2>{table}" if table else ""


def _fundamental_block(stock: dict) -> str:
    table = _rows(
        [
            ("Piyasa değeri", _fmt_compact(stock.get("market_cap"))),
            ("F/K", _fmt(stock.get("pe"), 1)),
            ("PD/DD", _fmt(stock.get("pb"), 2)),
            ("Temettü verimi", _fmt_pct(stock.get("dividend_yield"))),
            ("Özsermaye kârlılığı (ROE)", _fmt_pct(stock.get("roe"))),
        ]
    )
    return f"<h2>Temel oranlar</h2>{table}" if table else ""


def _analyst_block(stock: dict) -> str:
    target = stock.get("target_price")
    if target is None or not stock.get("close"):
        return ""
    upside = target / stock["close"] - 1
    recommendation = RECOMMENDATION_LABELS.get(str(stock.get("recommendation") or "").lower())
    count = stock.get("analyst_count")
    table = _rows(
        [
            ("Hedef fiyat (ortalama)", _fmt(target)),
            ("Bugünkü fiyata göre potansiyel", _fmt_pct(upside)),
            ("Tavsiye", recommendation),
            ("Kapsayan analist", None if count is None else str(int(count))),
        ]
    )
    return f"<h2>Analist konsensüsü</h2>{table}" if table else ""


def _financials_block(financials: dict | None) -> str:
    if not financials:
        return ""
    table = _rows(
        [
            ("Dönem", financials.get("period")),
            ("Satış", _fmt_compact(financials.get("revenue"))),
            ("Net kâr", _fmt_compact(financials.get("net_income"))),
            ("Net marj", _fmt_pct(financials.get("net_margin"))),
            ("Satış — önceki çeyreğe göre", _fmt_pct(financials.get("revenue_change_qoq"))),
            ("Son 12 ay satış", _fmt_compact(financials.get("ttm_revenue"))),
        ]
    )
    if not table:
        return ""
    return (
        "<h2>Finansallar (çeyreklik)</h2>"
        f"{table}"
        '<p class="muted">Kaynak son dört çeyreği veriyor; yıllık karşılaştırma yapılamıyor.</p>'
    )


def _kap_block(items: list[dict]) -> str:
    if not items:
        return ""
    entries = "".join(
        f'<li><a href="{escape(item["link"])}" rel="nofollow noopener">'
        f"{escape(item.get('subject') or 'Bildirim')}</a> "
        f'<span class="muted">{escape((item.get("published_at") or "")[:10])}</span></li>'
        for item in items[:5]
        if item.get("link")
    )
    return f"<h2>Son KAP bildirimleri</h2><ul>{entries}</ul>" if entries else ""


def build_symbol_page(
    symbol: str,
    stock: dict,
    name: str | None = None,
    financials: dict | None = None,
    kap_items: list[dict] | None = None,
    generated_at: str | None = None,
) -> str:
    """Tek hissenin bağımsız HTML sayfası."""
    code = symbol_slug(symbol)
    title_name = escape(name) if name else escape(code)
    heading = f"{escape(code)} — {title_name}" if name else escape(code)

    change = _fmt_pct(stock.get("change"))
    price_line = f"Son kapanış <strong>{_fmt(stock.get('close'))}</strong>"
    if change:
        price_line += f" ({change})"

    blocks = "".join(
        [
            _technical_block(stock),
            _fundamental_block(stock),
            _analyst_block(stock),
            _financials_block(financials),
            _kap_block(kap_items or []),
        ]
    )

    when = (generated_at or datetime.utcnow().isoformat())[:10]
    description = (
        f"{code} hissesi teknik görünüm (EMA, RSI, MACD, Stokastik), temel oranlar "
        f"(F/K, PD/DD, temettü) ve son KAP bildirimleri. {when} tarihli kapanış verisiyle."
    )
    app_link = f"{SITE_URL}?v=screener&amp;s={escape(symbol)}"

    return f"""<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(code)} Hisse Analizi — Teknik Görünüm ve Temel Oranlar | Borsa Tarama</title>
<meta name="description" content="{escape(description)}">
<link rel="canonical" href="{symbol_url(symbol)}">
<style>{_PAGE_CSS}</style>
</head>
<body>
<main>
<h1>{heading}</h1>
<p>{price_line} <span class="muted">({when})</span></p>
{blocks}
<p><a class="cta" href="{app_link}">Canlı taramada {escape(code)}</a></p>
<footer>
<p>Veriler {when} kapanışına aittir ve gecikmeli olabilir. Bu sayfa
<strong>yatırım tavsiyesi değildir</strong>; yalnızca kamuya açık verilerin
otomatik özetidir.</p>
<p><a href="{SITE_URL}">Borsa Tarama</a> · <a href="{SITE_URL}{SYMBOL_DIR}/">Tüm hisseler</a></p>
</footer>
</main>
</body>
</html>
"""


def build_symbol_index(entries: list[tuple[str, str | None]]) -> str:
    """`/hisse/` dizin sayfası: tüm hisse sayfalarına iç bağlantı.

    Dizin sayfası olmadan hisse sayfaları yalnızca sitemap üzerinden keşfedilirdi;
    iç bağlantı ise hem tarayıcıya hem kullanıcıya gezinme yolu verir.
    """
    items = "".join(
        f'<li><a href="{symbol_slug(symbol)}.html">{escape(symbol_slug(symbol))}</a>'
        + (f' <span class="muted">{escape(name)}</span>' if name else "")
        + "</li>"
        for symbol, name in sorted(entries)
    )
    return f"""<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hisse Analiz Sayfaları — Borsa Tarama</title>
<meta name="description" content="Borsa İstanbul'da işlem gören hisselerin teknik görünüm, temel oran ve KAP bildirimi özetleri.">
<link rel="canonical" href="{SITE_URL}{SYMBOL_DIR}/">
<style>{_PAGE_CSS}</style>
</head>
<body>
<main>
<h1>Hisse analiz sayfaları</h1>
<p class="muted">{len(entries)} hisse. Her sayfa o hissenin teknik görünümünü, temel
oranlarını ve son KAP bildirimlerini özetler.</p>
<ul>{items}</ul>
<footer><p><a href="{SITE_URL}">Borsa Tarama</a></p></footer>
</main>
</body>
</html>
"""
