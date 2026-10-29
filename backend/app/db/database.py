"""
Database configuration for Sicredi Guardião V2.

Supports:
  - SQLite (default, for local dev and tests)
  - PostgreSQL via psycopg 3 driver (for Neon cloud hosting)

PostgreSQL URL format:
  postgresql+psycopg://USER:PASSWORD@HOST/DATABASE?sslmode=require

The connect_args and engine parameters are adjusted automatically based
on the database type detected from the URL prefix.
"""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import settings


def _is_postgres() -> bool:
    return settings.DATABASE_URL.startswith("postgresql")


def _is_sqlite() -> bool:
    return settings.DATABASE_URL.startswith("sqlite")


def _build_engine():
    url = settings.DATABASE_URL

    if _is_sqlite():
        return create_engine(
            url,
            connect_args={"check_same_thread": False},
            echo=settings.DEBUG,
        )

    if _is_postgres():
        # psycopg 3 driver: postgresql+psycopg://...
        # For Neon serverless PostgreSQL: use pool_pre_ping and a small pool
        # sslmode=require must be in the URL query string
        engine = create_engine(
            url,
            echo=settings.DEBUG,
            pool_pre_ping=True,       # detect stale connections (important for Neon)
            pool_size=5,              # small pool — Neon free tier limits connections
            max_overflow=2,
            pool_recycle=300,         # recycle connections every 5 min
            connect_args={
                "connect_timeout": 10,
            },
        )
        return engine

    # Fallback (other DB types)
    return create_engine(url, echo=settings.DEBUG)


engine = _build_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency that yields a database session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
