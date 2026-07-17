"""Fon portföy raporlarını hisse bazlı aylık matrise dönüştürür.

Girdi, KAP rapor ayrıştırıcısından gelen normalize satırlardır:
fund_code, fund_name, symbol, month, weight, shares.
"""

from __future__ import annotations

import math
import re
from collections.abc import Iterable, Mapping
from datetime import datetime, timezone

_SYMBOL_RE = re.compile(r"^[A-Z0-9]{2,10}$")


def normalize_symbol(value: object) -> str | None:
    """KAP raporlarındaki ``THYAO``, ``THYAO.E`` gibi kodları normalize eder."""
    if value is None:
        return None
    symbol = str(value).strip().upper()
    symbol = symbol.removesuffix(".E").removesuffix(".IS")
    symbol = re.sub(r"[^A-Z0-9]", "", symbol)
    return symbol if _SYMBOL_RE.fullmatch(symbol) else None


def normalize_month(value: object) -> str | None:
    """Tarih / YYYY-MM değerini aylık anahtara dönüştürür."""
    if value is None:
        return None
    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m")
    text = str(value).strip()
    match = re.match(r"^(\d{4})[-/.](\d{1,2})", text)
    if match:
        year, month = int(match.group(1)), int(match.group(2))
        if 1 <= month <= 12:
            return f"{year:04d}-{month:02d}"
    return None


def _number(value: object) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, str):
        text = value.strip().replace("%", "").replace(" ", "")
        # TR raporlarında 1.234,56; API/CSV'de 1234.56 olabilir.
        if "," in text:
            text = text.replace(".", "").replace(",", ".")
        elif text.count(".") > 1:
            text = text.replace(".", "")
        value = text
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def build_position_payload(
    records: Iterable[Mapping[str, object]],
    *,
    stock_names: Mapping[str, str] | None = None,
    max_months: int = 12,
    generated_at: str | None = None,
) -> dict:
    """Normalize pozisyon satırlarını frontend'in kullandığı ters indekse çevirir."""
    names = stock_names or {}
    normalized: list[dict] = []
    all_months: set[str] = set()

    for raw in records:
        symbol = normalize_symbol(raw.get("symbol"))
        month = normalize_month(raw.get("month") or raw.get("date"))
        fund_code = str(raw.get("fund_code") or "").strip().upper()
        if not symbol or not month or not fund_code:
            continue

        weight = _number(raw.get("weight"))
        shares = _number(raw.get("shares"))
        if weight is None and shares is None:
            continue

        normalized.append(
            {
                "symbol": symbol,
                "month": month,
                "fund_code": fund_code,
                "fund_name": str(raw.get("fund_name") or fund_code).strip(),
                "weight": round(weight, 4) if weight is not None else None,
                "shares": round(shares, 2) if shares is not None else None,
            }
        )
        all_months.add(month)

    months = sorted(all_months)[-max_months:]
    keep_months = set(months)
    stocks: dict[str, dict] = {}
    fund_indexes: dict[str, dict[str, dict]] = {}

    for row in normalized:
        if row["month"] not in keep_months:
            continue
        symbol = row["symbol"]
        stock = stocks.setdefault(
            symbol,
            {"name": names.get(symbol, symbol), "funds": []},
        )
        by_fund = fund_indexes.setdefault(symbol, {})
        fund = by_fund.get(row["fund_code"])
        if fund is None:
            fund = {
                "fund_code": row["fund_code"],
                "fund_name": row["fund_name"],
                "positions": {},
            }
            by_fund[row["fund_code"]] = fund
            stock["funds"].append(fund)
        fund["positions"][row["month"]] = {
            "weight": row["weight"],
            "shares": row["shares"],
        }

    # Boş hisseleri at ve en güncel ağırlığa göre deterministik sırala.
    for symbol in list(stocks):
        funds = stocks[symbol]["funds"]
        if not funds:
            del stocks[symbol]
            continue
        funds.sort(
            key=lambda fund: (
                fund["positions"].get(months[-1], {}).get("weight") or -1,
                fund["fund_code"],
            ),
            reverse=True,
        )

    return {
        "generated_at": generated_at
        or datetime.now(timezone.utc).isoformat(),
        "months": months,
        "stocks": dict(sorted(stocks.items())),
    }
