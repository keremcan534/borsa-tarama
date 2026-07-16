"""Sinyalleri takip eden sanal portföy simülasyonu.

"Bu stratejiyi 1.000 TL ile takip etseydin ne olurdu?" sorusunun cevabı. Özet
istatistiklerden (isabet oranı, ortalama getiri) farkı: sinyaller sınırsız değildir.
Aynı gün 30 sinyal gelse bile gerçek bir yatırımcının parası ve pozisyon kapasitesi
sınırlıdır — bu simülasyon o kısıtı uygular ve bileşik getiriyi hesaplar.

Kurallar (bilerek basit ve şeffaf):
- Başlangıç sermayesi eşit ağırlıkla en fazla `max_positions` pozisyona dağıtılır.
- Sinyal geldiğinde boş pozisyon slotu varsa girilir, yoksa **sinyal atlanır**
  (gerçek hayatta da öyle olur; atlanan sinyal sayısı raporlanır).
- Pozisyon `horizon` mum sonra kapanır (sabit ufuk), nakit geri döner.
- Aynı anda birden fazla sinyal varsa tarih sırası, eşitlikte sembol sırası esas alınır.

Kabuller: komisyon/slipaj/temettü/vergi yok; pozisyon büyüklüğü kalan nakdin kalan
slotlara bölünmesiyle bulunur (kendi kendini finanse eder, nakit hiç eksiye düşmez).
"""

import bisect
import random

DEFAULT_INITIAL_CAPITAL = 1000.0
DEFAULT_MAX_POSITIONS = 10
DEFAULT_TRIALS = 25


def _drawdown(curve: list[dict]) -> float:
    """Getiri eğrisinin tepe noktasından gördüğü en büyük düşüş."""
    peak = float("-inf")
    worst = 0.0
    for point in curve:
        peak = max(peak, point["value"])
        if peak > 0:
            worst = min(worst, point["value"] / peak - 1)
    return worst


def simulate(
    trades: list[dict],
    horizon: int,
    initial_capital: float = DEFAULT_INITIAL_CAPITAL,
    max_positions: int = DEFAULT_MAX_POSITIONS,
    benchmark=None,
    rng: random.Random | None = None,
) -> dict | None:
    """Sinyalleri sırayla işleyip sanal portföyün getiri eğrisini üretir.

    `benchmark` verilirse aynı dönemde endeksi al-tut eğrisi de hesaplanır —
    portföyün tek başına değeri anlamsızdır, karşılaştırma şarttır.

    `rng` verilirse aynı gün gelen sinyaller arasında rastgele seçim yapılır.
    Bu önemlidir: pozisyon kapasitesi dolduğunda sinyallerin çoğu atlanır, dolayısıyla
    sonuç "hangisini seçtiğine" çok duyarlıdır. Varsayılan (rng=None) sembol adına göre
    alfabetik seçer — deterministiktir ama TEK BİR keyfî senaryodur; gerçekçi bir
    aralık için `simulate_many` kullanılmalıdır.
    """
    key = str(horizon)
    tie_break = (lambda t: rng.random()) if rng is not None else (lambda t: t["symbol"])
    usable = sorted(
        (t for t in trades if key in t.get("returns", {}) and key in t.get("exit_dates", {})),
        key=lambda t: (t["entry_date"], tie_break(t)),
    )
    if not usable:
        return None

    cash = initial_capital
    # Açık pozisyonlar: (çıkış tarihi, çıkışta eline geçecek tutar) — vadesi en yakın başta
    open_positions: list[tuple[str, float]] = []
    # Aynı sırada pozisyonların maliyet bedeli: açık pozisyonun ara değeri bilinmediğinden
    # eğri onları maliyetle taşır, her kapanışta gerçek değere oturur.
    open_costs: list[tuple[str, float]] = []
    curve: list[dict] = []
    taken = 0
    skipped = 0

    for trade in usable:
        entry_date = trade["entry_date"]
        # Önce vadesi gelen pozisyonları kapat: nakit yeni sinyal için serbest kalsın
        while open_positions and open_positions[0][0] <= entry_date:
            exit_date, exit_value = open_positions.pop(0)
            open_costs.pop(0)
            cash += exit_value
            curve.append({"date": exit_date, "value": round(cash + sum(c for _, c in open_costs), 2)})

        if len(open_positions) >= max_positions:
            skipped += 1
            continue

        free_slots = max_positions - len(open_positions)
        size = cash / free_slots
        if size <= 0:
            skipped += 1
            continue

        cash -= size
        exit_value = size * (1 + trade["returns"][key])
        exit_date = trade["exit_dates"][key]

        # Çıkış tarihine göre sıralı ekle (kuyruk hep vadesi en yakın pozisyonu başta tutar)
        pos = bisect.bisect_right([d for d, _ in open_positions], exit_date)
        open_positions.insert(pos, (exit_date, exit_value))
        open_costs.insert(pos, (exit_date, size))
        taken += 1

    # Kalan açık pozisyonları vadelerinde kapat
    while open_positions:
        exit_date, exit_value = open_positions.pop(0)
        open_costs.pop(0)
        cash += exit_value
        curve.append({"date": exit_date, "value": round(cash + sum(c for _, c in open_costs), 2)})

    if not curve:
        return None

    final_value = curve[-1]["value"]
    start_date = usable[0]["entry_date"]
    end_date = curve[-1]["date"]

    result = {
        "initial_capital": initial_capital,
        "max_positions": max_positions,
        "horizon": horizon,
        "start_date": start_date,
        "end_date": end_date,
        "final_value": round(final_value, 2),
        "total_return": final_value / initial_capital - 1,
        "max_drawdown": _drawdown(curve),
        "trades_taken": taken,
        "signals_skipped": skipped,
        "curve": _thin(curve),
    }

    if benchmark is not None:
        bh = _buy_and_hold(benchmark, start_date, end_date, initial_capital, curve)
        if bh:
            result["benchmark_final_value"] = bh["final_value"]
            result["benchmark_total_return"] = bh["total_return"]
            result["benchmark_curve"] = bh["curve"]

    return result


def _quantile(sorted_values: list[float], q: float) -> float:
    """Sıralı listeden basit yüzdelik (en yakın sıra) — küçük örneklem için yeterli."""
    if not sorted_values:
        return 0.0
    idx = min(len(sorted_values) - 1, max(0, round(q * (len(sorted_values) - 1))))
    return sorted_values[idx]


def simulate_many(
    trades: list[dict],
    horizon: int,
    trials: int = DEFAULT_TRIALS,
    seed: int = 0,
    **kwargs,
) -> dict | None:
    """Simülasyonu farklı rastgele seçimlerle birçok kez koşup DAĞILIMI döner.

    Neden tek koşu yetmez: kapasite dolduğunda sinyallerin ~%90'ı atlanır, yani sonuç
    hangi sinyalin seçildiğine bağlıdır. BIST100 günlük veride tek koşuların nihai
    değeri 13.000 ile 45.000 arasında değişiyordu — üç kattan fazla fark. Tek bir
    rakam yayınlamak bu şansı gizler; bu yüzden medyan ve aralık birlikte raporlanır.

    Dönüş: medyan koşunun sonucu (eğrisiyle birlikte) + `distribution` alanı.
    """
    results = []
    for i in range(trials):
        result = simulate(trades, horizon, rng=random.Random(seed + i), **kwargs)
        if result:
            results.append(result)
    if not results:
        return None

    results.sort(key=lambda r: r["final_value"])
    finals = [r["final_value"] for r in results]
    median = results[len(results) // 2]

    median["distribution"] = {
        "trials": len(results),
        "median_final_value": median["final_value"],
        "p10_final_value": _quantile(finals, 0.10),
        "p90_final_value": _quantile(finals, 0.90),
        "min_final_value": finals[0],
        "max_final_value": finals[-1],
        # Kaç koşu endeksi yendi: yön güvenilirse bu 1.0'a yakın olmalı
        "beat_benchmark_trials": (
            sum(1 for r in results if r["final_value"] > r.get("benchmark_final_value", float("inf")))
            if median.get("benchmark_final_value") is not None
            else None
        ),
    }
    return median


def _buy_and_hold(benchmark, start_date: str, end_date: str, capital: float, curve: list[dict]) -> dict | None:
    """Aynı dönemde endeksi al-tut eğrisi; portföy eğrisiyle aynı tarihlerde örneklenir."""
    start_close = benchmark.close_at(start_date)
    if not start_close:
        return None

    points = []
    for point in _thin(curve):
        close = benchmark.close_at(point["date"])
        if close:
            points.append({"date": point["date"], "value": round(capital * close / start_close, 2)})

    end_close = benchmark.close_at(end_date)
    if not end_close or not points:
        return None

    final_value = round(capital * end_close / start_close, 2)
    return {"final_value": final_value, "total_return": final_value / capital - 1, "curve": points}


def _thin(curve: list[dict], max_points: int = 400) -> list[dict]:
    """Eğriyi JSON boyutu için seyreltir (grafikte 400 nokta fazlasıyla yeter)."""
    if len(curve) <= max_points:
        return curve
    step = len(curve) / max_points
    thinned = [curve[int(i * step)] for i in range(max_points)]
    if thinned[-1] is not curve[-1]:
        thinned.append(curve[-1])  # son nokta (nihai değer) her zaman korunmalı
    return thinned
