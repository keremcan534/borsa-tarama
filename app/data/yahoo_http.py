"""Yahoo Finance'in JSON uçlarına düz HTTP ile erişim (yfinance'siz).

Neden ayrı bir yol: `yfinance` isteklerini `curl_cffi` ile atıyor, yani tarayıcı TLS
parmak izini taklit ediyor. Bu bazı ağların (kurumsal proxy, CI runner) arkasında
tamamen bloklanıyor — ölçüldü, bu geliştirme ortamında her yfinance çağrısı
"Connection reset by peer" veriyor, oysa aynı uçlar `requests` ile 200 dönüyor.

Bu modül yfinance'i DEĞİŞTİRMEZ; taramanın fiyat yolu hâlâ `YFinanceFetcher`.
Buradaki istemci, yfinance'in çalışmadığı ortamlarda çalışması gereken **yardımcı
script'ler** (sektör haritası üretimi gibi) ve `.info`'nun vermediği modüller için var.

## Crumb el sıkışması

`quoteSummary` ucu çerez + "crumb" ister; ikisi olmadan 401 "Invalid Crumb" döner:

1. `finance.yahoo.com` ziyaret edilir -> oturum çerezi düşer,
2. `/v1/test/getcrumb` çağrılır -> kısa bir token döner,
3. Her `quoteSummary` isteğine `crumb` parametresi eklenir.

Token oturum boyunca geçerlidir, bu yüzden istemci onu bir kez alıp saklar.
"""

import time

import requests

CRUMB_URL = "https://query2.finance.yahoo.com/v1/test/getcrumb"
QUOTE_SUMMARY_URL = "https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}"
CHART_URL = "https://query2.finance.yahoo.com/v8/finance/chart/{symbol}"
# Çerezi asıl bu host bırakıyor. 404 dönmesi normal ve sorun değil — istenen şey
# yanıt değil, `Set-Cookie`. Ölçüldü: yalnızca finance.yahoo.com ziyaret edildiğinde
# hiç çerez düşmüyor ve getcrumb 401 veriyor; fc.yahoo.com ile 200 dönüyor.
SEED_URLS = ("https://fc.yahoo.com", "https://finance.yahoo.com/quote/AAPL")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


class YahooHttpClient:
    """quoteSummary/chart uçlarına erişen küçük istemci. Hata durumunda None döner.

    Hiçbir metot exception sızdırmaz: bu istemci yardımcı veri (sektör, analist
    hedefi) için kullanılıyor ve o veri gelmediğinde tarama/script durmamalı,
    yalnızca ilgili alan boş kalmalı.
    """

    def __init__(self, session: requests.Session | None = None, timeout: int = 30) -> None:
        self.session = session or requests.Session()
        # setdefault DEĞİL: requests.Session zaten "python-requests/x.y" User-Agent'ı
        # taşıdığından setdefault hiçbir şey yapmaz ve Yahoo o UA'ya crumb vermez
        # (ölçüldü: getcrumb 401). Başlık açıkça ezilmeli.
        self.session.headers["User-Agent"] = USER_AGENT
        self.timeout = timeout
        self._crumb: str | None = None

    def crumb(self) -> str | None:
        if self._crumb:
            return self._crumb
        try:
            for seed in SEED_URLS:
                try:
                    self.session.get(seed, timeout=self.timeout)
                except Exception:
                    continue  # biri düşerse diğeri çerezi bırakabilir
            response = self.session.get(CRUMB_URL, timeout=self.timeout)
            if response.status_code != 200:
                return None
            token = response.text.strip()
            # Yahoo hata durumunda HTML döndürebiliyor; crumb kısa bir token'dır.
            self._crumb = token if token and len(token) < 64 and "<" not in token else None
        except Exception:
            self._crumb = None
        return self._crumb

    def quote_summary(self, symbol: str, modules: list[str], retries: int = 2) -> dict | None:
        """İstenen modülleri döner: {"assetProfile": {...}, ...}. Başarısızsa None."""
        crumb = self.crumb()
        if not crumb:
            return None

        for attempt in range(retries + 1):
            try:
                response = self.session.get(
                    QUOTE_SUMMARY_URL.format(symbol=symbol),
                    params={"modules": ",".join(modules), "crumb": crumb},
                    timeout=self.timeout,
                )
                if response.status_code == 401:
                    # Crumb bayatlamış olabilir: bir kez tazeleyip tekrar dene
                    self._crumb = None
                    crumb = self.crumb()
                    if not crumb:
                        return None
                    continue
                if response.status_code == 429:
                    time.sleep(2 * (attempt + 1))
                    continue
                if response.status_code != 200:
                    return None
                result = ((response.json().get("quoteSummary") or {}).get("result")) or []
                return result[0] if result else None
            except Exception:
                if attempt == retries:
                    return None
                time.sleep(1)
        return None


def raw_value(field):
    """Yahoo sayıları {"raw": 1.23, "fmt": "1.23"} sarmalıyla gelir; içindekini alır.

    Sarmalı açmadan saklamak, arayüzde her sayı için ayrı bir "raw mı düz mü?"
    kontrolü gerektirirdi — normalizasyon tek yerde yapılır.
    """
    if isinstance(field, dict):
        field = field.get("raw")
    return float(field) if isinstance(field, (int, float)) and not isinstance(field, bool) else None
