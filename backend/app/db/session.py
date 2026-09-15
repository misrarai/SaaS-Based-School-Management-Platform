from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings


def build_engine(database_url: str | None = None) -> Engine:
    url = database_url or settings.DATABASE_URL
    if not url.startswith("sqlite"):
        return create_engine(url)

    kwargs = {"connect_args": {"check_same_thread": False}}
    if ":memory:" in url:
        # In-memory SQLite is per-connection; pin a single shared connection via
        # StaticPool so the FastAPI test client (which runs endpoints in a worker
        # thread) sees the same database instead of a fresh empty one each time.
        kwargs["poolclass"] = StaticPool
    return create_engine(url, **kwargs)


engine = build_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
