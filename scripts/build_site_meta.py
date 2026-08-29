"""Rapor arşivini ve backtest sonucunu frontend'e kopyalar; arşiv dizini, sitemap
ve robots üretir.

Frontend build'inden ÖNCE çalıştırılır:

    python scripts/build_site_meta.py reports frontend/public
"""

import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.reports.generate import build_archive_index, build_robots, build_sitemap


def main() -> None:
    reports_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "reports")
    public_dir = Path(sys.argv[2] if len(sys.argv) > 2 else "frontend/public")

    rapor_dir = public_dir / "rapor"
    rapor_dir.mkdir(parents=True, exist_ok=True)

    dates = []
    for report in sorted(reports_dir.glob("*.html")):
        shutil.copy2(report, rapor_dir / report.name)
        dates.append(report.stem)

    # Hisse sayfaları taramada üretiliyor (veri orada); burada yalnızca site
    # haritasına ekleniyor. Manifest yoksa (tarama henüz koşmamışsa) harita eski
    # haliyle üretilir — sitemap'in hiç yazılmaması daha kötü olurdu.
    def manifest_urls(directory: str) -> list[str]:
        manifest = public_dir / directory / "index.json"
        if not manifest.exists():
            return []
        try:
            return json.loads(manifest.read_text(encoding="utf-8")).get("urls") or []
        except (OSError, json.JSONDecodeError) as e:
            print(f"[SITE-META] {directory} manifesti okunamadı ({e}); sitemap'e eklenmedi")
            return []

    symbol_urls = manifest_urls("hisse")
    fund_category_urls = manifest_urls("fon-kategori")

    (rapor_dir / "index.html").write_text(build_archive_index(dates), encoding="utf-8")
    (public_dir / "sitemap.xml").write_text(
        build_sitemap(dates, symbol_urls, fund_category_urls), encoding="utf-8"
    )
    (public_dir / "robots.txt").write_text(build_robots(), encoding="utf-8")
    print(
        f"[SITE-META] {len(dates)} rapor kopyalandı, {len(symbol_urls)} hisse + "
        f"{len(fund_category_urls)} fon kategorisi sayfası haritaya eklendi; "
        "arşiv + sitemap + robots üretildi"
    )

    # Backtest ayrı ve seyrek bir workflow'da üretilip repoya commit'lendiğinden
    # (data/backtest.json), her yayında oradan alınıp siteye taşınır.
    backtest_src = Path("data/backtest.json")
    if backtest_src.exists():
        data_dir = public_dir / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(backtest_src, data_dir / "backtest.json")
        print("[SITE-META] backtest.json siteye kopyalandı")
    else:
        print("[SITE-META] data/backtest.json yok; Strateji sekmesi bu yayında boş görünecek")


if __name__ == "__main__":
    main()
