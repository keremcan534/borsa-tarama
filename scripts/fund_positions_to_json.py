"""Normalize KAP fon portföy satırlarını statik site JSON'una dönüştürür.

Bu komut veri kaynağından bağımsızdır. KAP rapor ayrıştırıcısının ürettiği CSV
veya JSON satırlarını alır:

    python scripts/fund_positions_to_json.py positions.csv \
        frontend/public/data/fund_stock_positions.json

Zorunlu alanlar: fund_code, symbol, month (veya date)
Opsiyonel alanlar: fund_name, weight, shares
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.funds.positions import build_position_payload


def read_records(path: Path) -> list[dict]:
    if path.suffix.lower() == ".json":
        value = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(value, dict):
            value = value.get("records", [])
        if not isinstance(value, list):
            raise ValueError("JSON bir liste veya {records: [...]} olmalı")
        return value

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit(
            "Kullanım: python scripts/fund_positions_to_json.py "
            "<positions.csv|json> <output.json>"
        )
    source = Path(sys.argv[1])
    output = Path(sys.argv[2])
    records = read_records(source)
    payload = build_position_payload(records)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(
        f"[FON POZİSYON] {len(records)} satır -> "
        f"{len(payload['stocks'])} hisse / {len(payload['months'])} ay -> {output}"
    )


if __name__ == "__main__":
    main()
