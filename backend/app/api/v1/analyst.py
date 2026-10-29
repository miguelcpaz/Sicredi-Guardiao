"""
Analyst Actions API for Sicredi Guardião V2.

Handles analyst decisions on alerts/incidents:
  GET    /analyst/alerts                       — all alerts in analyst's wallet
  GET    /analyst/alerts/{id}                  — alert detail with full context
  PATCH  /analyst/alerts/{id}/action           — take action on alert
  GET    /analyst/incidents                    — incidents in analyst's wallet
  PATCH  /analyst/incidents/{id}/update        — update incident
  GET    /analyst/transactions/{id}/detail     — full transaction detail with risk
"""
import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.db.database import get_db
from app.models.models import (
    Alert, AlertStatus, Associate, AuditLog, Incident, IncidentStatus,
    ManagerWallet, Notification, RiskAnalysis, Transaction, TransactionStatus, User, UserRole,
)
from app.services import notification_service

router = APIRouter(prefix="/analyst", tags=["analyst"])


def _check_alert_access(db: Session, analyst: User, alert_id: int) -> tuple[Alert, Associate]:
    """Validate analyst has wallet access to this alert. Returns (alert, associate)."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if alert is None:
        raise HTTPException(status_code=404, detail="Alerta não encontrado.")

    transaction = db.query(Transaction).filter(Transaction.id == alert.transaction_id).first()
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transação não encontrada.")

    associate = db.query(Associate).filter(Associate.id == transaction.associate_id).first()
    if associate is None:
        raise HTTPException(status_code=404, detail="Associado não encontrado.")

    if analyst.role != UserRole.admin:
        wallet_link = db.query(ManagerWallet).filter(
            ManagerWallet.analyst_id == analyst.id,
            ManagerWallet.associate_id == associate.id,
        ).first()
        if wallet_link is None:
            raise HTTPException(status_code=403, detail="Alerta não pertence à sua carteira.")

    return alert, associate


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

@router.get("/alerts")
def list_analyst_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.analyst, UserRole.admin)),
):
    """List all alerts in the analyst's wallet, ordered by severity."""
    if current_user.role == UserRole.admin:
        wallet_associate_ids = [a.id for a in db.query(Associate).all()]
    else:
        links = db.query(ManagerWallet).filter(ManagerWallet.analyst_id == current_user.id).all()
        wallet_associate_ids = [link.associate_id for link in links]

    alerts = (
        db.query(Alert)
        .join(Transaction)
        .filter(Transaction.associate_id.in_(wallet_associate_ids))
        .order_by(Alert.created_at.desc())
        .all()
    )

    result = []
    for a in alerts:
        t = a.transaction
        assoc = db.query(Associate).filter(Associate.id == t.associate_id).first() if t else None
        result.append({
            "id": a.id,
            "transaction_id": a.transaction_id,
            "risk_score": a.risk_score,
            "risk_level": a.risk_level,
            "status": a.status.value,
            "response": a.response.value if a.response else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "amount": float(t.amount) if t else None,
            "merchant": t.merchant if t else None,
            "associate_name": assoc.user.full_name if assoc else None,
            "associate_id": assoc.id if assoc else None,
        })
    return result


@router.get("/alerts/{alert_id}")
def get_alert_detail(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.analyst, UserRole.admin)),
):
    """Full alert detail including transaction, risk analysis, and associate info."""
    alert, associate = _check_alert_access(db, current_user, alert_id)
    transaction = alert.transaction
    risk = db.query(RiskAnalysis).filter(RiskAnalysis.transaction_id == transaction.id).first()

    signals = []
    if risk and risk.risk_signals:
        try:
            signals = json.loads(risk.risk_signals)
        except json.JSONDecodeError:
            pass

    incidents = db.query(Incident).filter(Incident.alert_id == alert_id).all()

    return {
        "alert": {
            "id": alert.id,
            "risk_score": alert.risk_score,
            "risk_level": alert.risk_level,
            "status": alert.status.value,
            "response": alert.response.value if alert.response else None,
            "created_at": alert.created_at.isoformat() if alert.created_at else None,
        },
        "transaction": {
            "id": transaction.id,
            "amount": float(transaction.amount),
            "merchant": transaction.merchant,
            "category": transaction.category,
            "location": transaction.location,
            "mode": transaction.mode,
            "status": transaction.status.value,
            "timestamp": transaction.timestamp.isoformat() if transaction.timestamp else None,
        },
        "associate": {
            "id": associate.id,
            "full_name": associate.user.full_name,
            "username": associate.user.username,
            "account_number": associate.account_number,
            "user_id": associate.user_id,
        },
        "risk_analysis": {
            "risk_score": risk.risk_score if risk else None,
            "risk_level": risk.risk_level if risk else None,
            "explanation": risk.explanation if risk else None,
            "provider": risk.provider if risk else None,
            "signals": signals,
        } if risk else None,
        "incidents": [
            {
                "id": inc.id,
                "status": inc.status.value,
                "description": inc.description,
                "created_at": inc.created_at.isoformat() if inc.created_at else None,
            }
            for inc in incidents
        ],
    }


@router.patch("/alerts/{alert_id}/action")
def take_alert_action(
    alert_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.analyst, UserRole.admin)),
):
    """
    Take an action on an alert.
    Actions: 'maintain_block' | 'request_confirmation' | 'escalate_investigation' | 'resolve'
    """
    action = payload.get("action", "")
    justification = payload.get("justification", "").strip()
    notification_message = payload.get("notification_message", "").strip()

    valid_actions = {"maintain_block", "request_confirmation", "escalate_investigation", "resolve"}
    if action not in valid_actions:
        raise HTTPException(status_code=422, detail=f"Ação inválida. Use: {valid_actions}")

    alert, associate = _check_alert_access(db, current_user, alert_id)
    transaction = alert.transaction

    from_status = alert.status.value

    if action == "maintain_block":
        # Keep blocked status, possibly with a message to associate
        if notification_message:
            notif = Notification(
                user_id=associate.user_id,
                alert_id=alert_id,
                title="Verificação de Segurança",
                message=notification_message,
                is_read=False,
            )
            db.add(notif)
            db.flush()
            # Push SSE
            notification_service.push_event(associate.user_id, "notification", {
                "id": notif.id,
                "title": notif.title,
                "message": notif.message,
                "alert_id": notif.alert_id,
            })

    elif action == "request_confirmation":
        # Send confirmation request to associate
        msg = notification_message or (
            f"Por segurança, sua transferência de R$ {float(transaction.amount):.2f} "
            f"não foi concluída. Acesse a Central de Segurança para informar se reconhece a operação."
        )
        notif = Notification(
            user_id=associate.user_id,
            alert_id=alert_id,
            title="Confirmação Necessária",
            message=msg,
            is_read=False,
        )
        db.add(notif)
        db.flush()
        notification_service.push_event(associate.user_id, "notification", {
            "id": notif.id,
            "title": notif.title,
            "message": notif.message,
            "alert_id": notif.alert_id,
        })

    elif action == "escalate_investigation":
        # Create or update incident
        existing_incident = db.query(Incident).filter(
            Incident.alert_id == alert_id
        ).first()
        if existing_incident:
            existing_incident.status = IncidentStatus.investigating
        else:
            incident = Incident(
                transaction_id=transaction.id,
                alert_id=alert_id,
                status=IncidentStatus.investigating,
                description=justification or "Encaminhado para investigação pelo analista.",
            )
            db.add(incident)
        alert.status = AlertStatus.confirmed

        # Notify associate
        msg = notification_message or (
            "Sua operação foi encaminhada para investigação pela equipe de segurança."
        )
        notif = Notification(
            user_id=associate.user_id,
            alert_id=alert_id,
            title="Operação em Investigação",
            message=msg,
            is_read=False,
        )
        db.add(notif)
        db.flush()
        notification_service.push_event(associate.user_id, "notification", {
            "id": notif.id,
            "title": notif.title,
            "message": notif.message,
            "alert_id": notif.alert_id,
        })

    elif action == "resolve":
        alert.status = AlertStatus.resolved
        transaction.status = TransactionStatus.resolved

    # Audit log
    db.add(AuditLog(
        actor=current_user.username,
        action=f"alert_action_{action}",
        entity_type="alert",
        entity_id=alert_id,
        from_status=from_status,
        to_status=alert.status.value,
        justification=justification,
    ))

    db.commit()
    return {"message": f"Ação '{action}' executada com sucesso.", "alert_status": alert.status.value}


# ---------------------------------------------------------------------------
# Incidents
# ---------------------------------------------------------------------------

@router.get("/incidents")
def list_incidents(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.analyst, UserRole.admin)),
):
    """List incidents in the analyst's wallet."""
    if current_user.role == UserRole.admin:
        wallet_associate_ids = [a.id for a in db.query(Associate).all()]
    else:
        links = db.query(ManagerWallet).filter(ManagerWallet.analyst_id == current_user.id).all()
        wallet_associate_ids = [link.associate_id for link in links]

    incidents = (
        db.query(Incident)
        .join(Transaction)
        .filter(Transaction.associate_id.in_(wallet_associate_ids))
        .order_by(Incident.created_at.desc())
        .all()
    )

    result = []
    for inc in incidents:
        t = inc.transaction
        assoc = db.query(Associate).filter(Associate.id == t.associate_id).first() if t else None
        result.append({
            "id": inc.id,
            "transaction_id": inc.transaction_id,
            "alert_id": inc.alert_id,
            "status": inc.status.value,
            "description": inc.description,
            "created_at": inc.created_at.isoformat() if inc.created_at else None,
            "amount": float(t.amount) if t else None,
            "associate_name": assoc.user.full_name if assoc else None,
        })
    return result


# ---------------------------------------------------------------------------
# Transaction detail for analyst
# ---------------------------------------------------------------------------

@router.get("/transactions/{transaction_id}/detail")
def get_transaction_detail(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.analyst, UserRole.admin)),
):
    """Full transaction detail with risk analysis for analyst."""
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transação não encontrada.")

    associate = db.query(Associate).filter(Associate.id == transaction.associate_id).first()
    if associate is None:
        raise HTTPException(status_code=404, detail="Associado não encontrado.")

    # Wallet access check
    if current_user.role != UserRole.admin:
        wallet_link = db.query(ManagerWallet).filter(
            ManagerWallet.analyst_id == current_user.id,
            ManagerWallet.associate_id == associate.id,
        ).first()
        if wallet_link is None:
            raise HTTPException(status_code=403, detail="Transação não pertence à sua carteira.")

    risk = db.query(RiskAnalysis).filter(RiskAnalysis.transaction_id == transaction_id).first()

    signals = []
    if risk and risk.risk_signals:
        try:
            signals = json.loads(risk.risk_signals)
        except json.JSONDecodeError:
            pass

    alerts = db.query(Alert).filter(Alert.transaction_id == transaction_id).all()

    return {
        "transaction": {
            "id": transaction.id,
            "amount": float(transaction.amount),
            "merchant": transaction.merchant,
            "category": transaction.category,
            "location": transaction.location,
            "mode": transaction.mode,
            "status": transaction.status.value,
            "timestamp": transaction.timestamp.isoformat() if transaction.timestamp else None,
        },
        "associate": {
            "id": associate.id,
            "full_name": associate.user.full_name,
            "username": associate.user.username,
            "account_number": associate.account_number,
            "user_id": associate.user_id,
        },
        "risk_analysis": {
            "risk_score": risk.risk_score if risk else None,
            "risk_level": risk.risk_level if risk else None,
            "explanation": risk.explanation if risk else None,
            "provider": risk.provider if risk else None,
            "signals": signals,
        } if risk else None,
        "alerts": [
            {
                "id": a.id,
                "status": a.status.value,
                "response": a.response.value if a.response else None,
                "risk_score": a.risk_score,
            }
            for a in alerts
        ],
    }
