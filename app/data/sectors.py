"""Sembol -> sektör haritası (statik).

Harita `scripts/build_sectors.py` ile üretilip repoya commit'lenir; tarama onu
okur ve sektör için hiç network isteği atmaz (bkz. o script'in docstring'i).
Haritada olmayan sembolün sektörü None kalır — emtia/kripto gibi sektör kavramı
olmayan enstrümanlar zaten burada yer almaz.
"""

import json
from functools import lru_cache
from pathlib import Path

SECTORS_PATH = Path(__file__).resolve().parent / "sectors.json"


@lru_cache(maxsize=1)
def load_sectors() -> dict[str, str]:
    """Sektör haritasını (bir kez) diskten okur; dosya yoksa boş döner."""
    if not SECTORS_PATH.exists():
        print(f"[SEKTÖR] {SECTORS_PATH} yok; sektör alanları boş kalacak")
        return {}
    try:
        return json.loads(SECTORS_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"[SEKTÖR] harita okunamadı ({e}); sektör alanları boş kalacak")
        return {}


def sector_of(symbol: str) -> str | None:
    return load_sectors().get(symbol)
