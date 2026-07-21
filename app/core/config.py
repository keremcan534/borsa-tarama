from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Borsa Tarama Servisi"
    cors_origins: list[str] = ["http://localhost:5173"]  # Vite dev sunucusu

    # Taranacak marketler. S&P 500 açık: 503 sembol taramayı belirgin uzatır
    # (~20 dk), ama zamanlanmış tarama ABD kapanışından sonra da çalıştığı için
    # US hisseleri de kapsansın diye açıldı. ETF hâlâ kapalı (kod + sembol
    # listesi duruyor; açmak için listeye "etf" eklemek yeterli).
    enabled_markets: list[str] = ["bist100", "sp500", "commodity"]

    # Likidite tabanı: son 20 mumun ortalama günlük cirosu (hacim x kapanış)
    # bu eşiğin altındaysa hisse listeye giremez. Birim markete göre yerel
    # para birimidir (BIST: TRY, S&P: USD). Muhafazakar/koruyucu değerlerdir.
    min_daily_turnover: dict[str, float] = {
        "bist100": 50_000_000.0,  # 50M TRY
        "sp500": 10_000_000.0,  # 10M USD
        "etf": 5_000_000.0,  # 5M USD (ETF'ler genelde çok likit)
    }

    # Temel oranlar (F/K, PD/DD, temettü) taranan her sembol için ayrı bir yfinance
    # `.info` isteği gerektirir: ölçülen maliyet sembol başına ~0,43 sn, yani
    # BIST100+S&P500'de taramaya ~4 dk ekler. yfinance resmi bir API olmadığından
    # rate-limit'e takılırsa bu ayar False yapılarak kod değiştirmeden kapatılabilir
    # (arayüz kolonları o durumda '—' gösterir, tarama çalışmaya devam eder).
    fundamentals_enabled: bool = True

    class Config:
        env_file = ".env"


settings = Settings()
