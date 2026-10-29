"""
Alembic migration environment for Sicredi Guardião V2.

Reads DATABASE_URL from environment (via app settings) so migrations
work with both SQLite (local/test) and PostgreSQL (Neon production).

Usage:
  # Apply all pending migrations
  python -m alembic upgrade head

  # Generate a new migration from model changes
  python -m alembic revision --autogenerate -m "description"

  # Downgrade one step
  python -m alembic downgrade -1
"""
import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# Make sure the app package is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# This is the Alembic Config object
config = context.config

# Set up logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import app models so alembic can detect schema changes
from app.db.database import Base  # noqa: E402
import app.models.models  # noqa: E402, F401 — registers all models

target_metadata = Base.metadata


def get_url() -> str:
    """Read DATABASE_URL from environment or app settings."""
    # Allow override via ALEMBIC_DATABASE_URL env var
    url = os.environ.get("ALEMBIC_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if url:
        return url
    # Fall back to app settings
    from app.core.config import settings
    return settings.DATABASE_URL


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (generates SQL without a live connection)."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (applies to live DB)."""
    url = get_url()
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = url

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
