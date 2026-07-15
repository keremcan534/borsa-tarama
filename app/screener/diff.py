"""Ardışık taramalar arasındaki farkı çıkarır (yeni sinyal tespiti)."""


def mark_new_signals(stocks: list[dict], previous_symbols: set[str] | None) -> int:
    """
    Her hisseye is_new alanı ekler: bir önceki taramanın sinyal listesinde
    YOKSA yeni sinyaldir. Önceki liste bilinmiyorsa (ilk çalıştırma / erişim
    hatası) hiçbiri yeni sayılmaz. Yeni sinyal sayısını döner.
    """
    if previous_symbols is None:
        for stock in stocks:
            stock["is_new"] = False
        return 0

    new_count = 0
    for stock in stocks:
        is_new = stock["symbol"] not in previous_symbols
        stock["is_new"] = is_new
        if is_new:
            new_count += 1
    return new_count
