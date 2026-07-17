from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Borsa Tarama Servisi"
    cors_origins: list[str] = ["http://localhost:5173"]  # Vite dev sunucusu

    # Taranacak marketler. S&P 500 kapalı: 503 sembol x 4 zaman dilimi = tüm
    # taramanın ~%76'sı ve bu her deploy'u ~23 dakikaya çıkarıyordu. ETF de
    # kapalı: vizyon hisse + emtia/kripto + TEFAS fonlarına odaklanıyor; kod ve
    # sembol listeleri duruyor — geri açmak için listeye "sp500" / "etf" eklemek
    # yeterli.
    enabled_markets: list[str] = ["bist100", "commodity"]

    # Likidite tabanı: son 20 mumun ortalama günlük cirosu (hacim x kapanış)
    # bu eşiğin altındaysa hisse listeye giremez. Birim markete göre yerel
    # para birimidir (BIST: TRY, S&P: USD). Muhafazakar/koruyucu değerlerdir.
    min_daily_turnover: dict[str, float] = {
        "bist100": 50_000_000.0,  # 50M TRY
        "sp500": 10_000_000.0,  # 10M USD
        "etf": 5_000_000.0,  # 5M USD (ETF'ler genelde çok likit)
    }

    class Config:
        env_file = ".env"


settings = Settings()
