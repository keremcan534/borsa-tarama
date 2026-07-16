"""Backtest işlemlerini özet istatistiklere çevirir.

Tek başına "isabet oranı %60" bir şey ifade etmez: yükselen bir piyasada rastgele
alım da benzer oran verir. Bu yüzden her ufuk için endeksle karşılaştırma
(`beat_benchmark_rate`, `avg_excess_return`) da hesaplanır — asıl soru budur.
"""

import statistics


def _summarize_horizon(trades: list[dict], horizon: str) -> dict | None:
    """Belirli bir ufkun dolduğu işlemler üzerinden istatistikleri hesaplar."""
    returns = [t["returns"][horizon] for t in trades if horizon in t["returns"]]
    if not returns:
        return None

    paired = [
        (t["returns"][horizon], t["benchmark_returns"][horizon])
        for t in trades
        if horizon in t["returns"] and horizon in t.get("benchmark_returns", {})
    ]

    summary = {
        "count": len(returns),
        "win_rate": sum(1 for r in returns if r > 0) / len(returns),
        "avg_return": statistics.fmean(returns),
        "median_return": statistics.median(returns),
        "best_return": max(returns),
        "worst_return": min(returns),
    }

    if paired:
        excess = [r - b for r, b in paired]
        summary.update(
            {
                "benchmark_count": len(paired),
                "avg_benchmark_return": statistics.fmean(b for _, b in paired),
                "avg_excess_return": statistics.fmean(excess),
                "beat_benchmark_rate": sum(1 for e in excess if e > 0) / len(excess),
            }
        )

    return summary


def summarize(trades: list[dict], horizons: list[int]) -> dict:
    """İşlem listesini market/timeframe seviyesinde özet dict'e çevirir."""
    if not trades:
        return {"signals": 0, "symbols": 0, "horizons": {}}

    drawdowns = [t["max_drawdown"] for t in trades if t.get("max_drawdown") is not None]

    return {
        "signals": len(trades),
        "symbols": len({t["symbol"] for t in trades}),
        "first_signal": trades[0]["signal_date"],
        "last_signal": trades[-1]["signal_date"],
        "avg_max_drawdown": statistics.fmean(drawdowns) if drawdowns else None,
        "horizons": {
            str(h): summary
            for h in horizons
            if (summary := _summarize_horizon(trades, str(h))) is not None
        },
    }


def top_symbols(trades: list[dict], horizon: str, limit: int = 10, min_signals: int = 3) -> list[dict]:
    """Sembol bazında ortalama getiriye göre sıralama (en az `min_signals` sinyali olanlar).

    Az sinyalli semboller şans eseri tepeye çıkmasın diye alt eşik var.
    """
    by_symbol: dict[str, list[float]] = {}
    for t in trades:
        if horizon in t["returns"]:
            by_symbol.setdefault(t["symbol"], []).append(t["returns"][horizon])

    rows = [
        {
            "symbol": symbol,
            "signals": len(rets),
            "avg_return": statistics.fmean(rets),
            "win_rate": sum(1 for r in rets if r > 0) / len(rets),
        }
        for symbol, rets in by_symbol.items()
        if len(rets) >= min_signals
    ]
    rows.sort(key=lambda r: r["avg_return"], reverse=True)
    return rows[:limit]
