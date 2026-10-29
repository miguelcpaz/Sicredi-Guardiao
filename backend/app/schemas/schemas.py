"""
Pydantic schemas for Sicredi Guardião V2 — Etapa 1.

Monetary fields (amount, balance) use float in JSON responses for frontend
compatibility. The service layer converts Decimal → float before serialization.
Internal Python code always uses Decimal for arithmetic.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, field_validator


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str
    full_name: str


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Associate
# ---------------------------------------------------------------------------

class AssociateOut(BaseModel):
    id: int
    user_id: int
    account_number: str
    balance: float
    is_active: bool
    username: str
    full_name: str
    email: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------

class TransactionCreate(BaseModel):
    amount: Decimal
    merchant: str
    category: str
    location: str = ""
    mode: str = "pix"
    device_id: str = ""
    timestamp: Optional[datetime] = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= Decimal("0"):
            raise ValueError("amount must be positive")
        return v


class RiskSignalOut(BaseModel):
    rule_id: str
    rule_name: str
    triggered: bool
    score_contribution: int
    evidence: str


class TransactionAnalysisOut(BaseModel):
    transaction_id: int
    status: str
    risk_score: int
    risk_level: str
    risk_factors: list[str]
    risk_signals: list[RiskSignalOut]
    explanation: str
    ai_provider: str
    alert_id: Optional[int] = None
    incident_id: Optional[int] = None


class TransactionOut(BaseModel):
    id: int
    associate_id: int
    amount: float
    merchant: str
    category: str
    location: str
    mode: str
    status: str
    timestamp: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# PIX Transfers (scaffolded — fully wired in Etapa 2)
# ---------------------------------------------------------------------------

class PixTransferRequest(BaseModel):
    pix_key: str
    recipient_name: str
    amount: Decimal
    description: str = ""

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= Decimal("0"):
            raise ValueError("amount must be positive")
        return v


class PixTransferResponse(BaseModel):
    pix_transfer_id: int
    status: str              # approved | retained | blocked
    result_screen: str       # "approved" | "retained" | "blocked"
    transaction_id: Optional[int] = None
    risk_score: Optional[int] = None
    risk_level: Optional[str] = None
    message: str
    alert_id: Optional[int] = None


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

class AlertOut(BaseModel):
    id: int
    transaction_id: int
    risk_score: int
    risk_level: str
    status: str
    response: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertResponseRequest(BaseModel):
    response: str   # "confirmed" | "disputed"


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    is_read: bool
    created_at: datetime
    alert_id: Optional[int] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# AI Analysis
# ---------------------------------------------------------------------------

class AIAnalysisOut(BaseModel):
    explanation: str
    risk_score: int
    risk_level: str
    provider: str


# ---------------------------------------------------------------------------
# Generic responses
# ---------------------------------------------------------------------------

class MessageResponse(BaseModel):
    message: str

class HealthResponse(BaseModel):
    status: str
    version: str
    ai_provider: str
