"""Günlük tarama sonuçlarından SEO dostu, bağımsız statik HTML rapor sayfası üretir.

Bu sayfalar GitHub Pages'te /rapor/YYYY-AA-GG.html olarak yayınlanır; her gün
benzersiz içerikli bir sayfa oluşması arama motorlarından organik trafik getirir.
"""

from datetime import datetime
from html import escape

SITE_URL = "https://keremcan534.github.io/borsa-tarama/"

MARKET_TITLES = {"bist100": "BIST 100", "sp500": "S&P 500"}
TIMEFRAME_TITLES = {"daily": "Günlük", "weekly": "Haftalık", "monthly": "Aylık"}

_PAGE_CSS = """
:root{color-scheme:light dark;--bg:#f8fafc;--surface:#fff;--text:#4b5563;--text-h:#0f172a;
--border:#e2e8f0;--accent:#7c3aed;--new:#16a34a}
@media(prefers-color-scheme:dark){:root{--bg:#0f1115;--surface:#171a21;--text:#9ca3af;
--text-h:#f3f4f6;--border:#2a2e38;--accent:#a78bfa;--new:#4ade80}}
body{font:16px/1.6 system-ui,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);
margin:0;padding:24px 16px 60px}
main{max-width:860px;margin:0 auto}
h1,h2,h3{color:var(--text-h);line-height:1.3}
a{color:var(--accent)}
table{width:100%;border-collapse:collapse;font-size:14px;background:var(--surface);
border:1px solid var(--border);border-radius:10px;overflow:hidden;margin:12px 0}
th,td{padding:8px 12px;text-align:right;border-bottom:1px solid var(--border)}
th:first-child,td:first-child{text-align:left}
th.left,td.left{text-align:left}
.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
thead th{color:var(--text);font-weight:500}
tbody tr:last-child td{border-bottom:none}
.new{color:var(--new);font-weight:700;font-size:11px;margin-left:6px}
.muted{font-size:13px;opacity:.8}
.cta{display:inline-block;background:var(--accent);color:#fff;padding:10px 18px;border-radius:9px;
text-decoration:none;font-weight:600;margin:8px 0}
footer{margin-top:32px;font-size:12px;opacity:.7}
"""


def _fmt_date_tr(date_str: str) -> str:
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
              "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
    return f"{dt.day} {months[dt.month - 1]} {dt.year}"


def _symbol_label(stock: dict) -> str:
    label = escape(stock["symbol"].removesuffix(".IS"))
    if stock.get("is_new"):
        label += '<span class="new">YENİ</span>'
    return label


def _daily_table(results: list[dict]) -> str:
    if not results:
        return "<p>Bu taramada kriterleri geçen hisse yok.</p>"
    rows = "".join(
        f"<tr><td>{_symbol_label(s)}</td><td>{s['close']}</td><td>{s['rsi']}</td>"
        f"<td>{s['macd_line']}</td><td>{s['stoch_k']}</td></tr>"
        for s in results
    )
    return (
        "<table><thead><tr><th>Hisse</th><th>Kapanış</th><th>RSI</th><th>MACD</th>"
        "<th>Stoch %K</th></tr></thead><tbody>" + rows + "</tbody></table>"
    )


def _symbol_list(results: list[dict]) -> str:
    if not results:
        return "—"
    return ", ".join(_symbol_label(s) for s in results)


def build_report_html(date_str: str, market_payloads: dict[str, dict[str, dict]]) -> str:
    """
    market_payloads: {"bist100": {"daily": payload, "weekly": payload, "monthly": payload}, ...}
    Bağımsız (tek dosyalık) HTML rapor sayfası döner.
    """
    date_tr = _fmt_date_tr(date_str)
    title = f"Borsa Taraması {date_tr} — BIST 100 ve S&P 500 Teknik Sinyaller"

    summary_bits = []
    for market, tfs in market_payloads.items():
        daily = tfs.get("daily", {})
        count = daily.get("count", 0)
        new_syms = [s["symbol"].removesuffix(".IS") for s in daily.get("results", []) if s.get("is_new")]
        bit = f"{MARKET_TITLES.get(market, market)}: {count} sinyal"
        if new_syms:
            bit += f" ({len(new_syms)} yeni: {', '.join(new_syms)})"
        summary_bits.append(bit)
    description = f"{date_tr} teknik tarama sonuçları — " + " · ".join(summary_bits) + ". Günlük EMA/MACD/RSI taraması."

    sections = []
    for market, tfs in market_payloads.items():
        market_title = MARKET_TITLES.get(market, market)
        daily = tfs.get("daily", {})
        section = [f"<h2>{market_title}</h2>"]
        scanned = daily.get("scanned")
        if scanned:
            section.append(
                f'<p class="muted">{scanned} hisse tarandı, {daily.get("count", 0)} tanesi '
                f"günlük kriterleri geçti.</p>"
            )
        section.append(_daily_table(daily.get("results", [])))
        for tf in ("weekly", "monthly"):
            payload = tfs.get(tf)
            if payload:
                section.append(
                    f"<p><strong>{TIMEFRAME_TITLES[tf]} görünüm</strong> "
                    f"({payload.get('count', 0)} sinyal): {_symbol_list(payload.get('results', []))}</p>"
                )
        sections.append("\n".join(section))

    page_url = f"{SITE_URL}rapor/{date_str}.html"
    return f"""<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)}</title>
<meta name="description" content="{escape(description)}">
<link rel="canonical" href="{page_url}">
<meta property="og:title" content="{escape(title)}">
<meta property="og:description" content="{escape(description)}">
<meta property="og:type" content="article">
<meta property="og:url" content="{page_url}">
<meta property="og:image" content="{SITE_URL}og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{SITE_URL}icon-192.png">
<style>{_PAGE_CSS}</style>
</head>
<body>
<main>
<h1>📊 Borsa Taraması — {date_tr}</h1>
<p>BIST 100 ve S&P 500 endekslerinin tamamı teknik kriterlerle tarandı
(fiyat &gt; EMA 9/21/50/200, MACD &gt; 0, RSI &lt; 70, Stokastik &lt; 80, likidite tabanı).
Aşağıda kriterleri geçen hisseler yer alıyor. <span class="new">YENİ</span> etiketi,
hissenin bir önceki taramada listede olmadığını gösterir.</p>
<p><a class="cta" href="{SITE_URL}">Canlı taramayı ve grafikleri gör →</a></p>
{chr(10).join(sections)}
<h2>Arşiv</h2>
<p><a href="{SITE_URL}rapor/">Geçmiş günlerin raporları</a></p>
<footer>
Bu rapor otomatik üretilmiştir ve yalnızca teknik göstergelere dayalı veri sunar;
<strong>yatırım tavsiyesi değildir</strong>. Kaynak: günlük piyasa kapanış verileri.
</footer>
</main>
</body>
</html>
"""


def build_archive_index(dates: list[str]) -> str:
    """Rapor arşivi için basit bir dizin sayfası üretir (yeniden eskiye)."""
    items = "\n".join(
        f'<li><a href="{SITE_URL}rapor/{d}.html">{_fmt_date_tr(d)} taraması</a></li>'
        for d in sorted(dates, reverse=True)
    )
    return f"""<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Borsa Tarama Rapor Arşivi — Günlük BIST 100 ve S&P 500 Sinyalleri</title>
<meta name="description" content="Günlük teknik tarama raporlarının arşivi: BIST 100 ve S&P 500 momentum sinyalleri.">
<link rel="canonical" href="{SITE_URL}rapor/">
<link rel="icon" href="{SITE_URL}icon-192.png">
<style>{_PAGE_CSS}</style>
</head>
<body>
<main>
<h1>📚 Rapor Arşivi</h1>
<p><a class="cta" href="{SITE_URL}">Canlı taramaya dön →</a></p>
<ul>
{items}
</ul>
<footer>Yatırım tavsiyesi değildir.</footer>
</main>
</body>
</html>
"""


def build_sitemap(
    dates: list[str],
    symbol_urls: list[str] | None = None,
    fund_category_urls: list[str] | None = None,
) -> str:
    """Site haritası: ana sayfa, rapor arşivi, hisse ve fon kategorisi sayfaları.

    Hisse sayfaları eklenmeden önce haritada 30 URL vardı ve 28'i tarih damgalı
    rapordu — yani "THYAO teknik analiz" gibi sorgular için hedef sayfa yoktu.
    Fon kategorisi sayfaları aynı boşluğun fon tarafını kapatır ("gümüş fonu",
    "en iyi hisse senedi fonu").

    Dizin sayfası (`hisse/`, `fon-kategori/`) yalnızca altında sayfa VARSA
    eklenir: var olmayan bir URL'i haritaya yazmak tarayıcıya 404 verdirir.
    """
    urls = (
        [SITE_URL, f"{SITE_URL}rapor/"]
        + [f"{SITE_URL}rapor/{d}.html" for d in sorted(dates, reverse=True)]
        + ([f"{SITE_URL}hisse/"] if symbol_urls else [])
        + sorted(symbol_urls or [])
        + ([f"{SITE_URL}fon-kategori/"] if fund_category_urls else [])
        + sorted(fund_category_urls or [])
    )
    entries = "\n".join(f"  <url><loc>{u}</loc></url>" for u in urls)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{entries}\n</urlset>\n'


def build_robots() -> str:
    return f"User-agent: *\nAllow: /\n\nSitemap: {SITE_URL}sitemap.xml\n"
