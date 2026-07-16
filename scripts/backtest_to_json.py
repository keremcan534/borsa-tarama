"""Stratejinin geçmiş performansını ölçüp `backtest.json` üretir.

Taramanın aksine bu script her koşuda çalıştırılmaz: strateji performansı günden güne
kayda değer değişmez, buna karşılık sembol başına 5-10 yıllık veri çekmek pahalıdır
(yfinance rate-limit). Bu yüzden ayrı ve seyrek (haftalık) bir workflow'da çalışır;
çıktı repoya commit'lenir, tarama/yayın workflow'u onu siteye kopyalar.

Kullanım:
    python scripts/backtest_to_json.py data
    python scripts/backtest_to_json.py data --markets bist100 --timeframes daily
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.backtest.engine import BENCHMARKS, HORIZONS, load_benchmark, run_backtest
from app.backtest.metrics import summarize, top_symbols
from app.backtest.portfolio import simulate_many
from app.core.scheduler import MARKET_FILES, SYMBOLS_DIR
from app.data.fetchers.yfinance_fetcher import YFinanceFetcher

# Backtest'in sonuçlarıyla birlikte yayınlanan uyarılar. Rakamların yanında
# görünmezlerse sonuçlar olduğundan güvenilir sanılır.
CAVEATS = [
    "Sembol listeleri bugünün endeks üyeleridir; geçmişte endeksten çıkarılan şirketler "
    "veride yok (survivorship bias). Bu, sonuçları gerçekte olduğundan iyi gösterir.",
    "Komisyon, slipaj, temettü ve vergi hesaba katılmamıştır.",
    "Giriş, sinyal mumunun ertesi mumunun açılış fiyatından varsayılır.",
    "Geçmiş performans gelecek getirinin garantisi değildir. Yatırım tavsiyesi değildir.",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Tarama stratejisini geçmiş veride test eder")
    parser.add_argument("out_dir", nargs="?", default="data", help="backtest.json'un yazılacağı klasör")
    parser.add_argument(
        "--markets",
        default=",".join(MARKET_FILES),
        help="Virgülle ayrılmış market listesi (varsayılan: hepsi)",
    )
    parser.add_argument(
        "--timeframes",
        default="daily,weekly",
        help="Virgülle ayrılmış zaman dilimleri (varsayılan: daily,weekly)",
    )
    return parser.parse_args()


def backtest_market(market: str, timeframe: str, fetcher: YFinanceFetcher) -> dict:
    """Tek market/timeframe için backtest çalıştırıp özet dict döner."""
    with open(SYMBOLS_DIR / MARKET_FILES[market], encoding="utf-8") as f:
        symbols = json.load(f)

    horizons = HORIZONS[timeframe]
    benchmark = load_benchmark(market, fetcher, timeframe)
    trades = run_backtest(market, symbols, fetcher, timeframe, benchmark)

    summary = summarize(trades, horizons)
    summary["scanned"] = len(symbols)
    summary["benchmark"] = BENCHMARKS.get(market)
    summary["horizons_bars"] = horizons
    # Uzun ufuk en anlamlı örneklem; sembol sıralamasını onun üzerinden yap
    summary["top_symbols"] = top_symbols(trades, str(horizons[-1]))
    # Portföy simülasyonu orta ufuk üzerinden: kısa ufuk işlem sayısını şişirir,
    # en uzun ufuk sermayeyi çok uzun süre tek pozisyonda kilitler.
    # Tek koşu değil dağılım: sonuç hangi sinyalin seçildiğine çok duyarlı.
    summary["portfolio"] = simulate_many(trades, horizon=horizons[1], benchmark=benchmark)
    return summary


def main() -> None:
    args = parse_args()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    markets = [m.strip() for m in args.markets.split(",") if m.strip()]
    timeframes = [t.strip() for t in args.timeframes.split(",") if t.strip()]

    fetcher = YFinanceFetcher()
    results: dict[str, dict[str, dict]] = {}

    for market in markets:
        if market not in MARKET_FILES:
            print(f"[BACKTEST] bilinmeyen market atlandı: {market}")
            continue
        results[market] = {}
        for timeframe in timeframes:
            try:
                summary = backtest_market(market, timeframe, fetcher)
            except Exception as e:
                print(f"[BACKTEST] {market}/{timeframe} başarısız: {e}")
                continue
            results[market][timeframe] = summary
            print(
                f"[BACKTEST] {market}/{timeframe}: {summary['signals']} sinyal, "
                f"{summary['symbols']} sembol"
            )
            for horizon, stats in summary["horizons"].items():
                beat = stats.get("beat_benchmark_rate")
                beat_str = f", endeksi yenme %{beat * 100:.0f}" if beat is not None else ""
                print(
                    f"           +{horizon} mum: n={stats['count']}, "
                    f"isabet %{stats['win_rate'] * 100:.0f}, "
                    f"ort. getiri %{stats['avg_return'] * 100:+.2f}{beat_str}"
                )
            p = summary.get("portfolio")
            if p:
                d = p["distribution"]
                bench = (
                    f" | endeks al-tut: {p['benchmark_final_value']:.0f}"
                    f" ({d['beat_benchmark_trials']}/{d['trials']} kosu endeksi yendi)"
                    if p.get("benchmark_final_value") is not None
                    else ""
                )
                print(
                    f"           portfoy: {p['initial_capital']:.0f} -> medyan {d['median_final_value']:.0f}"
                    f" (aralik {d['min_final_value']:.0f}-{d['max_final_value']:.0f},"
                    f" {p['trades_taken']} islem, {p['signals_skipped']} sinyal atlandi){bench}"
                )

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "caveats": CAVEATS,
        "markets": results,
    }
    out_path = out_dir / "backtest.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"[BACKTEST] -> {out_path}")


if __name__ == "__main__":
    main()
