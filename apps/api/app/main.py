from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import Base, engine
from .routers import auth, balls, sessions, shots
from .seed import seed_demo_data

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Alembic handles production migrations. create_all keeps a fresh SQLite dev start frictionless.
    if settings.sqlalchemy_database_url.startswith("sqlite"):
        Base.metadata.create_all(bind=engine)
    if settings.seed_demo:
        seed_demo_data()
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(balls.router)
app.include_router(sessions.router)
app.include_router(shots.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "strikepath-api", "version": "0.1.0"}


@app.get("/")
def root():
    return {"name": settings.app_name, "docs": "/docs", "health": "/health"}
