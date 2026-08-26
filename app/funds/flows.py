"""Fon para akışı: bir fona günlük net kaç TL girdi/çıktı?

Neden gerekli: sitede fon akışı zaten vardı ama **yatırımcı SAYISI** üzerinden.
"Fona 500 kişi katıldı" ile "fona 12 milyar TL girdi" aynı şey değil — tek bir
kurumsal giriş yatırımcı sayısını hiç değiştirmeden fonun boyutunu ikiye katlayabilir.
Para akışı, fonun büyüklüğündeki değişimin **fiyat hareketiyle açıklanamayan**
kısmıdır ve gerçek talebi ölçen ölçüdür.

## Hesap

    akış_t = büyüklük_t − büyüklük_(t−1) × (fiyat_t / fiyat_(t−1))

Yani dünkü portföy bugünkü fiyatla değerlenseydi ne olurdu? Gerçek büyüklük ondan
fazlaysa aradaki fark **giren para**, azsa **çıkan para**dır. Fiyat çarpanı şart:
onsuz, fonu %5 yükselten bir piyasa günü %5'lik sahte "para girişi" gibi görünürdü.

Yüzde, dünkü büyüklüğe oranlanır: 100 milyon TL'lik fona giren 10 milyon (%10) ile
100 milyar TL'lik fona giren 10 milyon (%0,01) aynı haber değildir.

## Veri ve sınırları

Arşiv taramanın yan ürünü olarak birikir (`fund_flows.json`); gün başına fon
büyüklüğü, fiyat ve yatırımcı sayısı saklanır. Bu yüzden:

- **Geriye dönük hesap yapılamaz.** Akış ancak arşivde ardışık iki gün varsa
  bilinir; arşiv ileriye doğru dolar.
- **Tarama çalışmayan gün (hafta sonu, tatil, başarısız koşu) atlanır.** Araya gün
  girdiğinde akış o boşluğun tamamını kapsar; bu yüzden her akış kaydı hangi iki
  günü karşılaştırdığını taşır (`from_date`).
- TEFAS büyüklüğü T+1 yayımlar; yani akış günü fonun kendi değerleme günüdür,
  taramanın çalıştığı gün değil.
"""

# Bir günün akışı bu orandan büyükse veri hatası sayılır ve atlanır. TEFAS zaman
# zaman büyüklüğü sıfır/eksik yayımlıyor; onu "fonun %100'ü çıktı" diye göstermek
# listenin tepesini tamamen çöple doldururdu.
MAX_PLAUSIBLE_FLOW_RATIO = 3.0


def _reading(entry) -> dict | None:
    """Arşiv kaydını normalize eder.

    Eski kayıtlar düz sayıdır (yalnızca yatırımcı sayısı); yeni kayıtlar sözlük.
    Eski biçimden akış hesaplanamaz — bilerek None döner, sıfır değil.
    """
    if isinstance(entry, dict):
        return entry
    return None


def daily_flows(history: dict, symbol: str) -> list[dict]:
    """Bir fonun günlük net para akışları (eskiden yeniye).

    `history`: {"YYYY-MM-DD": {symbol: {"size": ..., "price": ...}}}
    Döner: [{"date", "from_date", "flow", "pct", "size"}]
    """
    days = sorted(history or {})
    out: list[dict] = []
    previous_day, previous = None, None

    for day in days:
        current = _reading((history[day] or {}).get(symbol))
        if current is None:
            continue

        size = current.get("size")
        price = current.get("price")
        if size is None or price is None or price <= 0:
            previous_day, previous = day, current
            continue

        if previous is not None:
            prev_size, prev_price = previous.get("size"), previous.get("price")
            if prev_size and prev_price and prev_price > 0 and prev_size > 0:
                expected = prev_size * (price / prev_price)
                flow = size - expected
                ratio = flow / prev_size
                if abs(ratio) <= MAX_PLAUSIBLE_FLOW_RATIO:
                    out.append(
                        {
                            "date": day,
                            "from_date": previous_day,
                            "flow": round(flow, 2),
                            "pct": round(ratio, 6),
                            "size": size,
                        }
                    )

        previous_day, previous = day, current

    return out


def flow_summary(history: dict, symbol: str, days: int = 5) -> dict | None:
    """Son `days` günün akışı + toplamı.

    Toplam yüzdesi, **dönemin başındaki** büyüklüğe oranlanır (her günün yüzdesinin
    toplamı DEĞİL): günlük yüzdeler farklı tabanlara göre hesaplandığından
    toplanmaları matematiksel olarak yanlış olurdu.
    """
    flows = daily_flows(history, symbol)
    if not flows:
        return None

    window = flows[-days:]
    total = sum(f["flow"] for f in window)

    # Dönem başı büyüklüğü: ilk günün akışından ÖNCEki büyüklük
    first = window[0]
    base = first["size"] - first["flow"]
    total_pct = round(total / base, 6) if base > 0 else None

    return {
        "symbol": symbol,
        "days": window,
        "total": round(total, 2),
        "total_pct": total_pct,
        "size": window[-1]["size"],
    }


def top_flows(history: dict, symbols: list[str], days: int = 5, limit: int = 10) -> list[dict]:
    """Dönem toplamı mutlak değerce en büyük fonlar (giren ve çıkan birlikte).

    Sıralama TL toplamına göredir, yüzdeye göre değil: yüzde sıralaması küçük
    fonları tepeye taşır ve "bugün piyasada para nereye gitti?" sorusunu
    cevaplamaz. Yüzde her satırda ayrıca gösterilir.
    """
    summaries = [flow_summary(history, symbol, days) for symbol in symbols]
    ranked = [s for s in summaries if s and s["total"] is not None]
    ranked.sort(key=lambda s: abs(s["total"]), reverse=True)
    return ranked[:limit]
