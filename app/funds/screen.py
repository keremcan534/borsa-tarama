"""TEFAS'tan fon fiyatlarını çekip metriklerle sıralı liste üretir."""

from __future__ import annotations

from datetime import date, timedelta

import pandas as pd

from app.funds.metrics import compute_fund_metrics

# En az bu kadar günlük geçmişi olan fonlar metrik alır
MIN_HISTORY_DAYS = 60
# Portföy büyüklüğü (TRY) — çok küçük/illik fonları ele
MIN_PORTFOLIO_SIZE = 100_000_000  # 100M TRY
# Sonuç listesi üst sınırı (UI + JSON boyutu)
MAX_FUNDS = 120
# Geçmiş penceresi (takvim günü) — 1y getiri + vol için
LOOKBACK_DAYS = 400

# --- Veri kalitesi kontrolleri ---
# Birincil sinyal: tek günlük sıçrama. Bir fonun birim pay fiyatı bir günde
# %40+ oynamaz; böyle bir hareket birim-pay bölünmesi / denominasyon değişimi
# veya bozuk fiyat verisidir (gözlem: OSF tek günde %1385, PDG %63).
MAX_DAILY_MOVE_LIMIT = 0.40

# İkincil emniyet: sıçrama imzası olmasa bile fiziksel olarak anlamsız
# toplam getiriler (20x/yıl gibi) veri sorununa işaret eder. Eşik bilinçli
# olarak geniş — TR'de %200-400 yıllık getiri meşru olabilir, hatta serbest
# fonlarda daha yükseği görülebilir; sadece uç saçmalıkları eliyoruz.
RETURN_SANITY_CAPS = {
    "return_1m": 3.0,   # %300/ay
    "return_3m": 8.0,   # %800/3ay
    "return_6m": 15.0,  # %1500/6ay
    "return_1y": 20.0,  # %2000/yıl
}


def _implausible_returns(metrics: dict) -> bool:
    """Veri artefaktı şüphesi: tek gün sıçraması veya uç toplam getiri."""
    move = metrics.get("max_daily_move")
    if move is not None and move > MAX_DAILY_MOVE_LIMIT:
        return True
    for key, cap in RETURN_SANITY_CAPS.items():
        val = metrics.get(key)
        if val is not None and val > cap:
            return True
    return False


def _fetch_history(start: date, end: date) -> pd.DataFrame:
    """pytefas ile YAT fonlarının tarihsel bilgisini çeker."""
    from pytefas import Crawler

    crawler = Crawler(timeout=90, max_retry=6)
    return crawler.fetch(
        start.isoformat(),
        end.isoformat(),
        kind="YAT",
        columns="info",
    )


def run_fund_screener(
    *,
    as_of: date | None = None,
    lookback_days: int = LOOKBACK_DAYS,
    min_portfolio_size: float = MIN_PORTFOLIO_SIZE,
    max_funds: int = MAX_FUNDS,
    df: pd.DataFrame | None = None,
) -> list[dict]:
    """TEFAS YAT fonlarını tara; getiri/risk skoruna göre sıralı liste döner.

    `df` verilirse ağ çağrısı yapılmaz (testler için). Aksi halde pytefas
    ile ~1 yıllık tüm YAT fon fiyatları çekilir (~3 dk, rate-limit'li).
    """
    end = as_of or date.today()
    start = end - timedelta(days=lookback_days)

    if df is None:
        print(f"[FON] TEFAS YAT {start} → {end} çekiliyor…")
        df = _fetch_history(start, end)
        print(f"[FON] {len(df)} satır alındı")

    if df is None or df.empty:
        return []

    # Sütun isimleri pytefas şemasına göre
    required = {"date", "fund_code", "price"}
    if not required.issubset(df.columns):
        raise ValueError(f"TEFAS verisinde beklenen sütunlar yok: {df.columns.tolist()}")

    work = df.copy()
    work["date"] = pd.to_datetime(work["date"])
    work["price"] = pd.to_numeric(work["price"], errors="coerce")
    work = work.dropna(subset=["fund_code", "price", "date"])
    work = work.sort_values(["fund_code", "date"])

    # Son güne göre likidite (portföy büyüklüğü)
    latest = work.groupby("fund_code", as_index=False).tail(1)
    if "portfolio_size" in latest.columns:
        latest["portfolio_size"] = pd.to_numeric(latest["portfolio_size"], errors="coerce")
        liquid_codes = set(
            latest.loc[
                latest["portfolio_size"].fillna(0) >= min_portfolio_size, "fund_code"
            ]
        )
    else:
        liquid_codes = set(latest["fund_code"])

    name_map = {}
    if "fund_name" in latest.columns:
        name_map = dict(zip(latest["fund_code"], latest["fund_name"]))
    size_map = {}
    if "portfolio_size" in latest.columns:
        size_map = {
            row.fund_code: float(row.portfolio_size)
            for row in latest.itertuples()
            if pd.notna(getattr(row, "portfolio_size", None))
        }
    investor_map = {}
    if "investor_count" in latest.columns:
        investor_map = {
            row.fund_code: int(row.investor_count)
            for row in latest.itertuples()
            if pd.notna(getattr(row, "investor_count", None))
        }

    results: list[dict] = []
    for code, group in work.groupby("fund_code"):
        if code not in liquid_codes:
            continue
        series = group.set_index("date")["price"].astype(float)
        metrics = compute_fund_metrics(series)
        if metrics["history_days"] < MIN_HISTORY_DAYS:
            continue
        if metrics["return_1y"] is None and metrics["return_3m"] is None:
            continue
        # Veri kalitesi: birim-pay bölünmesi/denominasyon değişimi veya bozuk
        # fiyat gününden kaynaklanan gerçek dışı getirileri ele (örn. 0.16→14.6).
        if _implausible_returns(metrics):
            print(
                f"[FON] {code} atlandı (veri artefaktı şüphesi: "
                f"tek-gün max={metrics.get('max_daily_move')}, 1y={metrics.get('return_1y')})"
            )
            continue

        results.append(
            {
                "symbol": code,
                "name": name_map.get(code) or code,
                "portfolio_size": size_map.get(code),
                "investor_count": investor_map.get(code),
                "tefas_url": f"https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod={code}",
                **metrics,
            }
        )

    results.sort(key=lambda r: (r.get("score") or 0, r.get("return_1y") or -999), reverse=True)
    return results[:max_funds]
