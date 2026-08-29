"""Fon kategorisi başına statik HTML sayfası (`/fon-kategori/gumus-fonlari.html`).

Hisse tarafında `symbol_pages.py` ile çözülen sorunun fon karşılığı: insanlar
"gümüş fonu hangisi", "en iyi hisse senedi fonu" diye arıyor; uygulama SPA
olduğu için `?v=funds` altındaki liste indekslenebilir içerik üretmiyordu ve bu
sorguların ineceği bir sayfa yoktu. Her kategori kendi sayfasında, o kategorinin
fonlarını getiri/risk metrikleriyle listeler.

Tasarım kararları `symbol_pages.py` ile aynı, sebepleri de aynı:

- **Sayfa tek başına ayakta durur.** JavaScript yok, veri gömülü.
- **Veri yoksa sayfa hiç basılmaz.** Boş bir "gümüş fonları" sayfası hem arama
  motoruna hem kullanıcıya içerik varmış izlenimi verirdi.
- **Ölü uç yok:** her satır TEFAS'a, sayfa da uygulamanın fon listesine bağlanır.
- **Sıralama puana göre** — uygulamadaki Fon Ligi ile aynı sıra, aynı kategori
  kuralı (`app/funds/categories.py`); iki yer farklı bir sıralama gösterirse
  kullanıcı hangisine güveneceğini bilemez.
"""

from datetime import datetime
from html import escape

from app.funds.categories import BY_KEY, FUND_CATEGORIES
from app.reports.generate import SITE_URL, _PAGE_CSS

CATEGORY_DIR = "fon-kategori"

# Sayfa başına listelenen fon sayısı tavanı. Serbest fonlar 163 taneye çıkıyor;
# hepsini basmak sayfayı okunmaz ve ağır yapardı, ilk N zaten aranan cevabı verir.
MAX_ROWS = 60


def category_url(slug: str) -> str:
    return f"{SITE_URL}{CATEGORY_DIR}/{slug}.html"


def _pct(value) -> str:
    if value is None:
        return "—"
    return f"{value * 100:+.1f}%".replace(".", ",")


def _num(value, digits: int = 2) -> str:
    if value is None:
        return "—"
    return f"{value:.{digits}f}".replace(".", ",")


def _size(value) -> str:
    """Portföy büyüklüğü: milyar/milyon TL."""
    if not value:
        return "—"
    if value >= 1e9:
        return f"{value / 1e9:.1f} mlr ₺".replace(".", ",")
    return f"{value / 1e6:.0f} mn ₺"


def _investors(value) -> str:
    return f"{int(value):,}".replace(",", ".") if value else "—"


def _rows(funds: list[dict]) -> str:
    cells = []
    for f in funds[:MAX_ROWS]:
        code = escape(str(f.get("symbol") or ""))
        cells.append(
            "<tr>"
            f'<td><a href="{escape(f.get("tefas_url") or "")}" rel="nofollow noopener">{code}</a></td>'
            f'<td class="left">{escape(str(f.get("name") or ""))}</td>'
            f'<td>{f.get("score") if f.get("score") is not None else "—"}</td>'
            f'<td>{_pct(f.get("return_1y"))}</td>'
            f'<td>{_pct(f.get("return_ytd"))}</td>'
            f'<td>{_pct(f.get("volatility"))}</td>'
            f'<td>{_num(f.get("sharpe"))}</td>'
            f'<td>{_size(f.get("portfolio_size"))}</td>'
            f'<td>{_investors(f.get("investor_count"))}</td>'
            "</tr>"
        )
    return "".join(cells)


def build_category_page(category_key: str, funds: list[dict], generated_at: str | None = None) -> str:
    """Tek kategorinin bağımsız HTML sayfası. `funds` puana göre sıralı gelmeli."""
    cat = BY_KEY[category_key]
    when = (generated_at or datetime.utcnow().isoformat())[:10]
    shown = min(len(funds), MAX_ROWS)
    title = f"{cat.label} Fonları"

    more = ""
    if len(funds) > MAX_ROWS:
        more = (
            f'<p class="muted">{len(funds)} fonun puana göre ilk {MAX_ROWS} tanesi '
            "listelendi; tamamı uygulamada.</p>"
        )

    others = " · ".join(
        f'<a href="{c.slug}.html">{escape(c.label)}</a>'
        for c in FUND_CATEGORIES
        if c.key != category_key
    )

    return f"""<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(title)} — Getiri, Risk ve Puan Karşılaştırması | Borsa Tarama</title>
<meta name="description" content="{escape(cat.blurb)} TEFAS'ta işlem gören {len(funds)} {escape(cat.label.lower())} fonunun 1 yıllık getirisi, volatilitesi, Sharpe oranı ve büyüklüğü. {when} verisiyle.">
<link rel="canonical" href="{category_url(cat.slug)}">
<style>{_PAGE_CSS}</style>
</head>
<body>
<main>
<h1>{escape(title)}</h1>
<p>{escape(cat.blurb)}</p>
<p class="muted">TEFAS'ta işlem gören ve büyüklük/yatırımcı eşiğini geçen
<strong>{len(funds)}</strong> fon. Puana göre sıralı, {when} verisiyle.</p>
<div class="scroll">
<table>
<thead><tr>
<th>Kod</th><th>Fon</th><th>Puan</th><th>1 Yıl</th><th>YBB</th>
<th>Volatilite</th><th>Sharpe</th><th>Büyüklük</th><th>Yatırımcı</th>
</tr></thead>
<tbody>{_rows(funds)}</tbody>
</table>
</div>
{more}
<p><a class="cta" href="{SITE_URL}?v=funds">Tüm fonları uygulamada karşılaştır</a></p>
<h2>Diğer fon kategorileri</h2>
<p>{others}</p>
<footer>
<p>Veriler TEFAS'tan {when} tarihiyle alınmıştır ve gecikmeli olabilir. Puan,
getiri ve risk metriklerinden türetilen otomatik bir ölçüdür. Geçmiş performans
gelecek getirinin garantisi değildir; bu sayfa <strong>yatırım tavsiyesi
değildir</strong>.</p>
<p><a href="{SITE_URL}">Borsa Tarama</a> · <a href="{SITE_URL}{CATEGORY_DIR}/">Tüm kategoriler</a></p>
</footer>
</main>
</body>
</html>
"""


def build_category_index(counts: dict[str, int], generated_at: str | None = None) -> str:
    """`/fon-kategori/` dizin sayfası: kategori sayfalarına iç bağlantı."""
    when = (generated_at or datetime.utcnow().isoformat())[:10]
    items = "".join(
        f'<li><a href="{c.slug}.html">{escape(c.label)} Fonları</a> '
        f'<span class="muted">{counts[c.key]} fon</span></li>'
        for c in FUND_CATEGORIES
        if counts.get(c.key)
    )
    total = sum(counts.values())
    return f"""<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TEFAS Fon Kategorileri — Getiri ve Risk Karşılaştırması | Borsa Tarama</title>
<meta name="description" content="TEFAS yatırım fonları kategorilere göre: gümüş, altın, hisse senedi, para piyasası, serbest, katılım ve diğerleri. Getiri, volatilite ve Sharpe karşılaştırması.">
<link rel="canonical" href="{SITE_URL}{CATEGORY_DIR}/">
<style>{_PAGE_CSS}</style>
</head>
<body>
<main>
<h1>TEFAS fon kategorileri</h1>
<p class="muted">{total} fon, {len([c for c in FUND_CATEGORIES if counts.get(c.key)])}
kategoride. Her sayfa o kategorinin fonlarını getiri, volatilite ve Sharpe
oranıyla listeler ({when}).</p>
<ul>{items}</ul>
<footer><p><a href="{SITE_URL}">Borsa Tarama</a></p></footer>
</main>
</body>
</html>
"""
