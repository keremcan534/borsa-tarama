from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Borsa Tarama Servisi"
    cors_origins: list[str] = ["http://localhost:5173"]  # Vite dev sunucusu

    # Likidite tabanı: son 20 mumun ortalama günlük cirosu (hacim x kapanış)
    # bu eşiğin altındaysa hisse listeye giremez. Birim markete göre yerel
    # para birimidir (BIST: TRY, S&P: USD). Muhafazakar/koruyucu değerlerdir.
    min_daily_turnover: dict[str, float] = {
        "bist100": 50_000_000.0,  # 50M TRY
        "sp500": 10_000_000.0,  # 10M USD
    }

    class Config:
        env_file = ".env"


settings = Settings()
