"""
SQLAlchemy models for Sicredi Guardião V2.

PostgreSQL/SQLite compatibility notes:
- amount columns use Numeric(12, 2) instead of Float (no floating-point drift).
- DateTime(timezone=True) stores timezone-aware timestamps in PostgreSQL.
  SQLite ignores timezone info but stores correctly for our purposes.
- Enum columns use native_enum=False for PostgreSQL compatibility without
  requiring CREATE TYPE commands (uses VARCHAR with check constraint instead).
- hashed_password uses String(200); bcrypt hashes are 60 chars so this fits.
"""
import enum
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey, Integer,
    Numeric, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class UserRole(str, enum.Enum):
    associate = "associate"
    analyst = "analyst"
    admin = "admin"


class TransactionStatus(str, enum.Enum):
    pending_review = "pending_review"
    approved = "approved"
    blocked = "blocked"
    confirmed = "confirmed"
    disputed = "disputed"
    investigating = "investigating"
    resolved = "resolved"
    closed = "closed"


class AlertStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    disputed = "disputed"
    resolved = "resolved"


class AlertResponse(str, enum.Enum):
    confirmed = "confirmed"
    disputed = "disputed"


class IncidentStatus(str, enum.Enum):
    open = "open"
    investigating = "investigating"
    resolved = "resolved"
    closed = "closed"


class PixTransferStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    approved = "approved"
    retained = "retained"
    blocked = "blocked"


class ChatRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"
    system = "system"


# ---------------------------------------------------------------------------
# Core user / associate / card tables
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    email = Column(String(120), unique=True, nullable=False)
    full_name = Column(String(200), nullable=False)
    hashed_password = Column(String(200), nullable=False)  # bcrypt; 60 chars; 200 is safe
    role = Column(Enum(UserRole), nullable=False, default=UserRole.associate)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utcnow)

    associate = relationship("Associate", back_populates="user", uselist=False)
    wallet_links = relationship("ManagerWallet", back_populates="analyst", foreign_keys="ManagerWallet.analyst_id")
    chat_sessions = relationship("ChatSession", back_populates="analyst")


class Associate(Base):
    __tablename__ = "associates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    account_number = Column(String(20), unique=True, nullable=False)
    # Fictitious balance for demo — not a real financial field
    balance = Column(Numeric(12, 2), default=Decimal("12450.00"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utcnow)

    user = relationship("User", back_populates="associate")
    cards = relationship("Card", back_populates="associate")
    behavior_profile = relationship("BehaviorProfile", back_populates="associate", uselist=False)
    transactions = relationship("Transaction", back_populates="associate")
    pix_transfers = relationship("PixTransfer", back_populates="associate")
    wallet_links = relationship("ManagerWallet", back_populates="associate")


class Card(Base):
    __tablename__ = "cards"

    id = Column(Integer, primary_key=True, index=True)
    associate_id = Column(Integer, ForeignKey("associates.id"), nullable=False)
    last_four = Column(String(4), nullable=False)
    card_type = Column(String(20), default="debit")
    is_restricted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=_utcnow)

    associate = relationship("Associate", back_populates="cards")


# ---------------------------------------------------------------------------
# Behavior profile
# ---------------------------------------------------------------------------

class BehaviorProfile(Base):
    __tablename__ = "behavior_profiles"

    id = Column(Integer, primary_key=True, index=True)
    associate_id = Column(Integer, ForeignKey("associates.id"), unique=True, nullable=False)
    avg_transaction_value = Column(Numeric(12, 2), default=Decimal("0.00"))  # Numeric replaces Float
    max_transaction_value = Column(Numeric(12, 2), default=Decimal("0.00"))  # Numeric replaces Float
    typical_hours = Column(String(200), default="08:00-22:00")
    typical_categories = Column(Text, default="")
    known_merchants = Column(Text, default="")
    typical_locations = Column(String(200), default="")
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    associate = relationship("Associate", back_populates="behavior_profile")


# ---------------------------------------------------------------------------
# Transactions and risk analysis
# ---------------------------------------------------------------------------

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    associate_id = Column(Integer, ForeignKey("associates.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)  # Numeric(12,2) replaces Float
    merchant = Column(String(200), nullable=False)
    category = Column(String(100), nullable=False)
    location = Column(String(200), default="")
    mode = Column(String(50), default="pix")
    status = Column(Enum(TransactionStatus), nullable=False, default=TransactionStatus.pending_review)
    device_id = Column(String(100), default="")
    timestamp = Column(DateTime, nullable=False, default=_utcnow)
    created_at = Column(DateTime, default=_utcnow)

    associate = relationship("Associate", back_populates="transactions")
    risk_analysis = relationship("RiskAnalysis", back_populates="transaction", uselist=False)
    alerts = relationship("Alert", back_populates="transaction")
    incidents = relationship("Incident", back_populates="transaction")
    pix_transfer = relationship("PixTransfer", back_populates="transaction", uselist=False)
    chat_sessions = relationship("ChatSession", back_populates="transaction")


class RiskAnalysis(Base):
    __tablename__ = "risk_analyses"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), unique=True, nullable=False)
    risk_score = Column(Integer, nullable=False)   # 0–100
    risk_level = Column(String(20), nullable=False)  # low / medium / high
    risk_factors = Column(Text, default="")         # JSON list of factor names
    risk_signals = Column(Text, default="")         # JSON list of signal dicts with evidence
    explanation = Column(Text, default="")          # AI-generated explanation
    provider = Column(String(50), default="mock")
    created_at = Column(DateTime, default=_utcnow)

    transaction = relationship("Transaction", back_populates="risk_analysis")


# ---------------------------------------------------------------------------
# Alerts and incidents
# ---------------------------------------------------------------------------

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=False)
    risk_score = Column(Integer, nullable=False)
    risk_level = Column(String(20), nullable=False)
    status = Column(Enum(AlertStatus), nullable=False, default=AlertStatus.pending)
    # response is immutable once set — enforced at service layer
    response = Column(Enum(AlertResponse), nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    transaction = relationship("Transaction", back_populates="alerts")
    notifications = relationship("Notification", back_populates="alert")


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=False)
    alert_id = Column(Integer, ForeignKey("alerts.id"), nullable=True)
    status = Column(Enum(IncidentStatus), nullable=False, default=IncidentStatus.open)
    description = Column(Text, default="")
    resolution = Column(Text, default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    transaction = relationship("Transaction", back_populates="incidents")
    events = relationship("IncidentEvent", back_populates="incident")
    chat_sessions = relationship("ChatSession", back_populates="incident")


class IncidentEvent(Base):
    __tablename__ = "incident_events"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)
    actor = Column(String(80), nullable=False)
    event_type = Column(String(50), nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=_utcnow)

    incident = relationship("Incident", back_populates="events")


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # recipient
    alert_id = Column(Integer, ForeignKey("alerts.id"), nullable=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=_utcnow)

    alert = relationship("Alert", back_populates="notifications")


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor = Column(String(80), nullable=False)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=True)
    from_status = Column(String(50), nullable=True)
    to_status = Column(String(50), nullable=True)
    justification = Column(Text, default="")
    created_at = Column(DateTime, default=_utcnow)


# ---------------------------------------------------------------------------
# Risk configuration
# ---------------------------------------------------------------------------

class RiskConfig(Base):
    __tablename__ = "risk_configs"

    id = Column(Integer, primary_key=True, index=True)
    rule_name = Column(String(100), unique=True, nullable=False)
    weight = Column(Integer, nullable=False, default=10)
    is_active = Column(Boolean, default=True)
    description = Column(Text, default="")
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


# ---------------------------------------------------------------------------
# V2 New tables: Manager Wallets, PIX Transfers, AI Chat
# ---------------------------------------------------------------------------

class ManagerWallet(Base):
    """Links an analyst to the associates in their portfolio (carteira)."""
    __tablename__ = "manager_wallets"

    id = Column(Integer, primary_key=True, index=True)
    analyst_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    associate_id = Column(Integer, ForeignKey("associates.id"), nullable=False)
    created_at = Column(DateTime, default=_utcnow)

    __table_args__ = (UniqueConstraint("analyst_id", "associate_id", name="uq_wallet_link"),)

    analyst = relationship("User", back_populates="wallet_links", foreign_keys=[analyst_id])
    associate = relationship("Associate", back_populates="wallet_links")


class PixTransfer(Base):
    """Represents a PIX transfer initiated by an associate through the app."""
    __tablename__ = "pix_transfers"

    id = Column(Integer, primary_key=True, index=True)
    associate_id = Column(Integer, ForeignKey("associates.id"), nullable=False)
    pix_key = Column(String(140), nullable=False)       # CPF / email / phone / random key
    recipient_name = Column(String(100), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)     # Numeric(12,2) — no floating-point drift
    description = Column(String(200), default="")
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)
    status = Column(Enum(PixTransferStatus), nullable=False, default=PixTransferStatus.pending)
    initiated_at = Column(DateTime, default=_utcnow)
    processed_at = Column(DateTime, nullable=True)

    associate = relationship("Associate", back_populates="pix_transfers")
    transaction = relationship("Transaction", back_populates="pix_transfer")


class ChatSession(Base):
    """A Guardião AI investigation session tied to an analyst + optional transaction/incident."""
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    analyst_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True)
    title = Column(String(200), default="Nova Análise")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    analyst = relationship("User", back_populates="chat_sessions")
    transaction = relationship("Transaction", back_populates="chat_sessions")
    incident = relationship("Incident", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", order_by="ChatMessage.created_at")


class ChatMessage(Base):
    """A single message in a Guardião AI chat session."""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(Enum(ChatRole), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=_utcnow)

    session = relationship("ChatSession", back_populates="messages")


class AssociateChatSession(Base):
    """A Guardião IA session for associates (security assistant, stateless per associate)."""
    __tablename__ = "associate_chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), default="Nova Conversa")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    user = relationship("User")
    messages = relationship("AssociateChatMessage", back_populates="session", order_by="AssociateChatMessage.created_at")


class AssociateChatMessage(Base):
    """A single message in an associate Guardião IA session."""
    __tablename__ = "associate_chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("associate_chat_sessions.id"), nullable=False)
    role = Column(Enum(ChatRole), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=_utcnow)

    session = relationship("AssociateChatSession", back_populates="messages")
