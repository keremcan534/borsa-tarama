"""Rapor arşivini frontend'e kopyalar; arşiv dizini, sitemap ve robots üretir.

Frontend build'inden ÖNCE çalıştırılır:

    python scripts/build_site_meta.py reports frontend/public
"""

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

    (rapor_dir / "index.html").write_text(build_archive_index(dates), encoding="utf-8")
    (public_dir / "sitemap.xml").write_text(build_sitemap(dates), encoding="utf-8")
    (public_dir / "robots.txt").write_text(build_robots(), encoding="utf-8")
    print(f"[SITE-META] {len(dates)} rapor kopyalandı; arşiv + sitemap + robots üretildi")


if __name__ == "__main__":
    main()
