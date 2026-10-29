"""
Transactions API — Etapa 1.

Fully implemented:
  - POST /transactions        Create + run fraud analysis (associate)
  - GET  /transactions        List (filtered by role/associate)
  - GET  /transactions/{id}   Detail with risk analysis

Scaffolded for future etapas (returns 501):
  - PATCH /transactions/{id}/status  (Etapa 2 — state machine)
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.db.database import get_db
from app.models.models import Associate, RiskAnalysis, Transaction, TransactionStatus, User, UserRole
from app.schemas.schemas import TransactionAnalysisOut, TransactionCreate, TransactionOut
from app.services.fraud_service import analyze_transaction

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post("", response_model=TransactionAnalysisOut, status_code=status.HTTP_201_CREATED)
def create_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.associate, UserRole.admin)),
):
    """
    Create a new transaction and immediately run fraud analysis.
    Only associates can submit transactions through this endpoint.
    (Analysts use the simulator; PIX flow uses /pix/transfer — Etapa 3.)
    """
    associate = db.query(Associate).filter(Associate.user_id == current_user.id).first()
    if associate is None:
        raise HTTPException(status_code=404, detail="Perfil de associado não encontrado.")

    tx_time = payload.timestamp or datetime.now(timezone.utc)
    transaction = Transaction(
        associate_id=associate.id,
        amount=payload.amount,
        merchant=payload.merchant,
        category=payload.category,
        location=payload.location,
        mode=payload.mode,
        device_id=payload.device_id,
        timestamp=tx_time,
    )
    db.add(transaction)
    db.flush()  # get transaction.id before analysis

    return analyze_transaction(db, transaction, actor_username=current_user.username)


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    associate_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List transactions.
    - Associates see only their own.
    - Analysts see by associate_id (wallet filtering — Etapa 2).
    - Admin sees all.
    """
    query = db.query(Transaction)

    if current_user.role == UserRole.associate:
        assoc = db.query(Associate).filter(Associate.user_id == current_user.id).first()
        if assoc is None:
            return []
        query = query.filter(Transaction.associate_id == assoc.id)
    elif current_user.role == UserRole.analyst:
        if associate_id:
            # Wallet access will be enforced in Etapa 2 — for now allow if associate_id provided
            query = query.filter(Transaction.associate_id == associate_id)
        else:
            return []  # Analyst must specify an associate — wallet page in Etapa 2
    # admin: no filter

    return query.order_by(Transaction.created_at.desc()).limit(100).all()


@router.get("/{transaction_id}", response_model=TransactionOut)
def get_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if tx is None:
        raise HTTPException(status_code=404, detail="Transação não encontrada.")

    # Associates can only see their own
    if current_user.role == UserRole.associate:
        assoc = db.query(Associate).filter(Associate.user_id == current_user.id).first()
        if assoc is None or tx.associate_id != assoc.id:
            raise HTTPException(status_code=403, detail="Acesso negado.")

    return tx
