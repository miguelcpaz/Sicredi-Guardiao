"""
Alerts API — Etapa 1.

Fully implemented:
  - GET  /alerts              List alerts (role-filtered)
  - GET  /alerts/{id}         Alert detail
  - POST /alerts/{id}/respond Associate responds (confirmed/disputed) — immutable after set

Scaffolded for Etapa 3:
  - POST /alerts/{id}/notify-associate  (analyst sends notification to associate)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.db.database import get_db
from app.models.models import (
    Alert, AlertResponse, AlertStatus, Associate, AuditLog,
    Transaction, User, UserRole,
)
from app.schemas.schemas import AlertOut, AlertResponseRequest, MessageResponse

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
def list_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Alert)
    if current_user.role == UserRole.associate:
        assoc = db.query(Associate).filter(Associate.user_id == current_user.id).first()
        if assoc is None:
            return []
        query = query.join(Transaction).filter(Transaction.associate_id == assoc.id)
    # analyst/admin: all alerts (wallet filter in Etapa 2)
    return query.order_by(Alert.created_at.desc()).limit(100).all()


@router.get("/{alert_id}", response_model=AlertOut)
def get_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if alert is None:
        raise HTTPException(status_code=404, detail="Alerta não encontrado.")

    if current_user.role == UserRole.associate:
        assoc = db.query(Associate).filter(Associate.user_id == current_user.id).first()
        tx = db.query(Transaction).filter(Transaction.id == alert.transaction_id).first()
        if assoc is None or tx is None or tx.associate_id != assoc.id:
            raise HTTPException(status_code=403, detail="Acesso negado.")

    return alert


@router.post("/{alert_id}/respond", response_model=AlertOut)
def respond_to_alert(
    alert_id: int,
    payload: AlertResponseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.associate)),
):
    """
    Associate responds to an alert. Response is IMMUTABLE once set.
    Accepted values: "confirmed" | "disputed"
    """
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if alert is None:
        raise HTTPException(status_code=404, detail="Alerta não encontrado.")

    # Ownership check
    assoc = db.query(Associate).filter(Associate.user_id == current_user.id).first()
    tx = db.query(Transaction).filter(Transaction.id == alert.transaction_id).first()
    if assoc is None or tx is None or tx.associate_id != assoc.id:
        raise HTTPException(status_code=403, detail="Acesso negado.")

    # Immutability check
    if alert.response is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Resposta já registrada. Não é possível alterar.",
        )

    # Validate value
    if payload.response not in ("confirmed", "disputed"):
        raise HTTPException(status_code=422, detail="Resposta deve ser 'confirmed' ou 'disputed'.")

    alert.response = AlertResponse(payload.response)
    alert.status = AlertStatus(payload.response)  # confirmed or disputed

    audit = AuditLog(
        actor=current_user.username,
        action="alert_responded",
        entity_type="alert",
        entity_id=alert.id,
        from_status="pending",
        to_status=payload.response,
        justification=f"Associado respondeu: {payload.response}",
    )
    db.add(audit)
    db.commit()
    db.refresh(alert)
    return alert
