from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Borsa Tarama Servisi"
    cors_origins: list[str] = ["http://localhost:5173"]  # Vite dev sunucusu

    class Config:
        env_file = ".env"


settings = Settings()
