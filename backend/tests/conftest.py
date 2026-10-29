"""
conftest.py — shared pytest fixtures for Sicredi Guardião V2.

Isolation strategy:
  - A unique per-test SQLite file is created via tempfile.mkstemp() so
    each test gets a completely independent database.
  - The engine and session factory are rebuilt for every test function.
  - app.dependency_overrides is always cleared in a finally block.
  - AI provider is forced to "mock" via environment variable so real
    providers (Ollama, Groq) are never called during automated tests.
  - A session-scoped fixture cleans up legacy stale DB files from
    interrupted previous runs before the test session begins.

Why file-based SQLite (not ":memory:"):
  The FastAPI TestClient runs handlers in the same thread as the test but
  uses SQLAlchemy sessions that may open multiple connections. SQLite
  ":memory:" databases are not shared across different connection objects,
  so multiple requests in a single test would each see an empty DB.
  A file-based path shared by all connections within a test solves this.
"""
import os
import tempfile
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Force mock provider BEFORE importing the app module so that app startup
# (safe_seed, config) never calls a real AI provider during tests.
os.environ["AI_PROVIDER"] = "mock"

from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.models.models import Associate, BehaviorProfile, Card, User, UserRole  # noqa: E402


# ---------------------------------------------------------------------------
# Session-scoped: clean up stale databases from interrupted previous runs
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def _cleanup_stale_test_dbs():
    """
    Remove legacy test database files before and after the test session.
    This handles the case where a previous run was interrupted (e.g. by
    a network reset) and left behind a stale .db file that would corrupt
    the next run's fixture IDs.
    """
    _LEGACY_PATHS = [
        os.path.join(os.path.dirname(__file__), "..", "test_guardiao.db"),
        os.path.join(os.path.dirname(__file__), "..", "test_seed_validate.db"),
    ]
    for p in _LEGACY_PATHS:
        abs_p = os.path.abspath(p)
        if os.path.exists(abs_p):
            try:
                os.remove(abs_p)
            except OSError:
                pass
    yield
    for p in _LEGACY_PATHS:
        abs_p = os.path.abspath(p)
        if os.path.exists(abs_p):
            try:
                os.remove(abs_p)
            except OSError:
                pass


# ---------------------------------------------------------------------------
# Per-test database fixture
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function", autouse=False)
def db():
    """
    Provide a completely isolated SQLite database for a single test.

    Creates a unique temporary file via tempfile.mkstemp(), builds a
    fresh engine + session factory, creates all tables, and yields the
    session. On teardown the file is deleted.

    The session carries .._test_session_factory so the client fixture
    can inject the same engine into FastAPI request handlers.
    """
    fd, db_path = tempfile.mkstemp(suffix=".db", prefix="guardiao_test_")
    os.close(fd)  # close the OS file descriptor; SQLAlchemy will open it
    db_url = f"sqlite:///{db_path}"

    engine = create_engine(
        db_url,
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()

    # Attach metadata so the client fixture can reuse the same factory
    session._test_session_factory = SessionLocal

    try:
        yield session
    finally:
        session.close()
        engine.dispose()
        try:
            os.remove(db_path)
        except OSError:
            pass  # file already gone or locked — ignore on Windows


# ---------------------------------------------------------------------------
# Per-test HTTP client fixture
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
def client(db):
    """
    Provide a FastAPI TestClient wired to the test's isolated database.

    Overrides the get_db dependency so every HTTP request handler opens
    a session against the same SQLite file used by the test's db session.
    The override is always removed in a finally block so it never leaks.
    """
    SessionLocal = db._test_session_factory

    def override_get_db():
        request_session = SessionLocal()
        try:
            yield request_session
        finally:
            request_session.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.pop(get_db, None)


# ---------------------------------------------------------------------------
# Data-creation helpers (used by fixtures and directly in test files)
# ---------------------------------------------------------------------------

def _create_user(db, username, role, full_name=None, email=None):
    """Insert a User row and flush (does not commit)."""
    pw = get_password_hash("sicredi123")
    user = User(
        username=username,
        email=email or f"{username}@test.sicredi.br",
        full_name=full_name or username.title(),
        hashed_password=pw,
        role=role,
    )
    db.add(user)
    db.flush()
    return user


def _create_associate(db, user):
    """Insert Associate, BehaviorProfile and Card rows, then commit."""
    from decimal import Decimal
    assoc = Associate(
        user_id=user.id,
        account_number=f"TEST-{user.id:04d}",
        balance=Decimal("10000.00"),
    )
    db.add(assoc)
    db.flush()
    profile = BehaviorProfile(
        associate_id=assoc.id,
        avg_transaction_value=Decimal("200.00"),
        max_transaction_value=Decimal("600.00"),
        typical_hours="08:00-22:00",
        typical_categories="alimentação,supermercado",
        known_merchants="Supermercado Esperança,Padaria Central",
        typical_locations="Porto Alegre",
    )
    db.add(profile)
    card = Card(associate_id=assoc.id, last_four="0001", card_type="debit")
    db.add(card)
    db.commit()
    return assoc


# ---------------------------------------------------------------------------
# Standard persona fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def associate_user(db):
    user = _create_user(db, "carlos_test", UserRole.associate, "Carlos Test")
    assoc = _create_associate(db, user)
    return user, assoc


@pytest.fixture
def analyst_user(db):
    user = _create_user(db, "ana_test", UserRole.analyst, "Ana Test")
    db.commit()
    return user


@pytest.fixture
def admin_user(db):
    user = _create_user(db, "admin_test", UserRole.admin, "Admin Test")
    db.commit()
    return user


# ---------------------------------------------------------------------------
# JWT helper (used by tests directly)
# ---------------------------------------------------------------------------

def get_token(client, username, password="sicredi123"):
    resp = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    return resp.json()["access_token"]
