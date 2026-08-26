"""Ekonomik takvim: faiz kararları ve enflasyon raporları.

Neden gerekli: Makro panel vardı ama o bir **fiyat serisi** panelidir (kur, faiz,
emtia seviyeleri). "Perşembe 14:00'te TCMB faiz açıklıyor" gibi bir **olay** takvimi
yoktu — oysa BIST'in en sert günleri çoğunlukla o takvimdeki günlerdir.

## Neden statik dosya, neden kazıma değil

TCMB ve TÜİK'in takvim sayfaları bu ortamdan çekilemiyor (SPA/404). Kazımaya
dayanan bir çözüm, kaynak sayfa değiştiği gün sessizce boş takvim gösterirdi.
Onun yerine tarihler `calendar_events.json` içinde durur ve kaynak URL'leri dosyada
yazılıdır: PPK tarihleri TCMB'nin kendi 2026 sayfasından, FOMC tarihleri
federalreserve.gov'un toplantı takviminden doğrulanarak alındı.

Takvimler yılda bir kez açıklanır ve nadiren değişir; yılda bir güncellenen bir
dosya, her gün kırılabilecek bir kazıyıcıdan daha güvenilirdir.

## Ne YOK ve neden

**TÜİK enflasyon açıklama tarihleri yok.** TÜİK TÜFE'yi ayın 3'ünde açıklar diye
bilinir ama bunu resmî bir takvimden doğrulayamadım. Doğrulanmamış tarihi takvime
yazmak, kullanıcıyı yanlış güne hazırlardı — konvansiyona dayanarak tarih üretmek
bu modülde bilinçli olarak yapılmıyor.

**Bilanço ve halka arz takvimi burada değil.** Bilanço tarafı KAP'ın finansal rapor
(`FR`) bildirimlerinden zaten geliyor — ama o GEÇMİŞE bakar ("kim açıkladı"),
geleceğe değil. Halka arz takvimi için programatik ve güvenilir bir kaynak bulunamadı.
"""

import json
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path

EVENTS_PATH = Path(__file__).resolve().parent / "calendar_events.json"


@lru_cache(maxsize=1)
def load_events() -> dict:
    """Takvim dosyası. Yoksa/bozuksa boş takvim (özellik gizlenir, hata verilmez)."""
    if not EVENTS_PATH.exists():
        print(f"[TAKVİM] {EVENTS_PATH} yok; ekonomik takvim boş kalacak")
        return {"events": [], "sources": {}}
    try:
        return json.loads(EVENTS_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"[TAKVİM] okunamadı ({e}); ekonomik takvim boş kalacak")
        return {"events": [], "sources": {}}


def _as_date(value: str) -> date | None:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def upcoming_events(today: date | None = None, limit: int = 12, window_days: int = 400) -> list[dict]:
    """Bugünden itibaren yaklaşan olaylar (tarihe göre sıralı).

    Geçmiş olaylar düşürülür: takvimin işi neye hazırlanılacağını söylemektir.
    `days_until` alanı arayüzde "3 gün sonra" rozetini besler; arayüzün tarih
    aritmetiği yapmasına gerek kalmasın diye burada hesaplanır.
    """
    today = today or date.today()
    out: list[dict] = []

    for event in load_events().get("events") or []:
        event_date = _as_date(event.get("date", ""))
        if event_date is None or event_date < today:
            continue
        days_until = (event_date - today).days
        if days_until > window_days:
            continue
        out.append({**event, "days_until": days_until})

    out.sort(key=lambda e: e["date"])
    return out[:limit]


def build_calendar_payload(today: date | None = None) -> dict:
    """Siteye yazılan takvim payload'ı: yaklaşan olaylar + kaynak bağlantıları."""
    data = load_events()
    events = upcoming_events(today)
    return {
        "count": len(events),
        "events": events,
        # Kaynaklar payload'da taşınır: kullanıcı tarihi doğrulamak isterse
        # bizim sayfamıza değil, kaynağa gidebilmeli.
        "sources": data.get("sources") or {},
        "updated": data.get("generated_at"),
    }
