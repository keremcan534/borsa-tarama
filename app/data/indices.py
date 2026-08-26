"""Endeks üyeliği: bir hisse BIST 100'de mi?

Tarama artık borsanın tamamını (610 hisse) tarıyor, yalnızca endeksi değil. Bu iyi
bir şey — ama endeks bileşeni olmak hâlâ bir bilgi: BIST 100'deki hisse fon
akımlarına, endeks fonlarına ve haber akışına farklı maruz kalır. Kapsamı açarken
bu ayrımı kaybetmemek için her hisseye üyelik bayrağı eklenir; arayüz "yalnızca
BIST 100" filtresini bundan üretir.

Üyelik listesi zaten repoda duran `bist100.json`'dan okunur — ayrı bir kaynak ya da
istek gerekmez, sektör haritasıyla aynı desen (`app/data/sectors.py`).
"""

import json
from functools import lru_cache
from pathlib import Path

SYMBOLS_DIR = Path(__file__).resolve().parent / "symbols"

# Bayrak adı -> sembol dosyası. Yeni bir endeks (BIST 30, BIST 50) eklemek için
# sembol listesini koyup buraya bir satır eklemek yeterli.
INDEX_FILES: dict[str, str] = {"in_bist100": "bist100.json"}


@lru_cache(maxsize=None)
def _members(file_name: str) -> frozenset[str]:
    path = SYMBOLS_DIR / file_name
    if not path.exists():
        print(f"[ENDEKS] {path} yok; üyelik bayrağı boş kalacak")
        return frozenset()
    try:
        return frozenset(json.loads(path.read_text(encoding="utf-8")))
    except (OSError, json.JSONDecodeError) as e:
        print(f"[ENDEKS] {path} okunamadı ({e}); üyelik bayrağı boş kalacak")
        return frozenset()


def index_flags(symbol: str) -> dict[str, bool]:
    """Sembolün endeks üyelik bayrakları, ör. {"in_bist100": True}.

    Üye OLMAYAN hisseler için de bayrak (False olarak) döner — arayüzde "bilinmiyor"
    ile "üye değil" ayrımı kalsın diye alanın hep var olması gerekiyor. BIST dışı
    sembollerde (S&P, emtia) bayrak anlamsız olduğundan hiç eklenmez.
    """
    if not symbol.endswith(".IS"):
        return {}
    return {flag: symbol in _members(file_name) for flag, file_name in INDEX_FILES.items()}
