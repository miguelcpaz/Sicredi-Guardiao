"""
Sicredi Guardião V2 — FastAPI application entry point.
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import Base, engine

# Import all models so SQLAlchemy registers them before create_all
import app.models.models  # noqa: F401

from app.api.v1 import auth, transactions, alerts, dashboard, pix, notifications, wallet, analyst, ai_chat, simulator, associate_ai_chat, admin, agent

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Create tables and seed demo data on startup (idempotent — skips if data exists)
# ---------------------------------------------------------------------------
try:
    from app.db.seed import safe_seed
    safe_seed()
except Exception as _seed_err:  # noqa: BLE001
    logger.error("Seed failed at startup: %s", _seed_err)

# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
API_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(transactions.router, prefix=API_PREFIX)
app.include_router(alerts.router, prefix=API_PREFIX)
app.include_router(dashboard.router, prefix=API_PREFIX)
app.include_router(pix.router, prefix=API_PREFIX)
app.include_router(notifications.router, prefix=API_PREFIX)
app.include_router(wallet.router, prefix=API_PREFIX)
app.include_router(analyst.router, prefix=API_PREFIX)
app.include_router(ai_chat.router, prefix=API_PREFIX)
app.include_router(simulator.router, prefix=API_PREFIX)
app.include_router(associate_ai_chat.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)
app.include_router(agent.router, prefix=API_PREFIX)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    db_status = "ok"
    try:
        from app.db.database import engine
        with engine.connect() as conn:
            conn.execute(__import__("sqlalchemy").text("SELECT 1"))
    except Exception:
        db_status = "error"

    return {
        "status": "ok",
        "version": settings.APP_VERSION,
        "ai_provider": settings.AI_PROVIDER,
        "database": db_status,
    }


@app.get("/")
def root():
    return {"message": f"{settings.APP_NAME} — API Running", "docs": "/docs"}
