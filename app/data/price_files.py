"""Sembol -> fiyat serisi dosya adı eşlemesi.

Neden var: fiyat serileri eskiden TEK bir `stock_prices.json` dosyasındaydı
(611 sembol x 270 mum = **8,4 MB ham / 2,6 MB sıkıştırılmış**). Kullanıcı tek bir
hisseye tıkladığında bu dosyanın TAMAMI iniyordu — yani en yüksek niyetli an
(grafiği açmak) sitenin en yavaş anıydı. Artık her sembol kendi dosyasında:
grafik açmak ~4 KB indiriyor.

Sembol adları dosya adı olarak doğrudan kullanılamaz (`GC=F`, `^GSPC`, `THYAO.IS`),
bu yüzden güvenli bir ada çevrilir. Eşlemenin AYNISI arayüzde de var
(`frontend/src/api.js::priceFileName`) — biri değişirse diğeri de değişmeli.
"""

import re

# Dosya adında güvenle durabilecek karakterler dışındaki her şey alt çizgi olur.
_UNSAFE = re.compile(r"[^A-Za-z0-9-]")


def price_file_name(symbol: str) -> str:
    """`THYAO.IS` -> `THYAO_IS`, `GC=F` -> `GC_F`, `^GSPC` -> `_GSPC`."""
    return _UNSAFE.sub("_", symbol)


def assert_unique_file_names(symbols) -> None:
    """İki sembol aynı dosya adına düşerse taramayı durdurur.

    Sessizce üzerine yazmak, bir hissenin grafiğinde BAŞKA bir hissenin fiyatını
    göstermek demek olurdu — sessiz kalmasındansa taramanın patlaması yeğdir.
    """
    seen: dict[str, str] = {}
    for symbol in symbols:
        name = price_file_name(symbol)
        if name in seen and seen[name] != symbol:
            raise ValueError(
                f"Fiyat dosyası adı çakışması: {seen[name]!r} ve {symbol!r} ikisi de {name!r} veriyor"
            )
        seen[name] = symbol
