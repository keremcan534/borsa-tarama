from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import screener
from app.core.config import settings
from app.core.scheduler import start_scheduler

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(screener.router)


@app.on_event("startup")
def on_startup():
    start_scheduler()


@app.get("/health")
def health_check():
    return {"status": "ok"}
