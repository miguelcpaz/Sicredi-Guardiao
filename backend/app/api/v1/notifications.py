"""
Notifications API for Sicredi Guardião V2.

Endpoints:
  GET    /notifications            — list current user's notifications
  PATCH  /notifications/{id}/read  — mark as read
  POST   /notifications/{id}/respond — associate responds to a security notification
  POST   /notifications/send       — analyst sends a notification to an associate
  GET    /notifications/sse        — SSE stream for real-time updates
"""
import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.db.database import get_db
from app.models.models import (
    Alert, AlertResponse, AlertStatus, Associate, AuditLog,
    ManagerWallet, Notification, Transaction, TransactionStatus, User, UserRole,
)
from app.services import notification_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ---------------------------------------------------------------------------
# List notifications
# ---------------------------------------------------------------------------

@router.get("", response_model=list[dict])
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all notifications for the current user, newest first."""
    notifs = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "alert_id": n.alert_id,
        }
        for n in notifs
    ]


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .count()
    )
    return {"count": count}


@router.patch("/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if notif is None:
        raise HTTPException(status_code=404, detail="Notificação não encontrada.")
    if notif.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado.")
    notif.is_read = True
    db.commit()
    return {"message": "Notificação marcada como lida."}


@router.patch("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "Todas as notificações marcadas como lidas."}


# ---------------------------------------------------------------------------
# Associate responds to a security notification
# ---------------------------------------------------------------------------

@router.post("/{notification_id}/respond")
def respond_to_notification(
    notification_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.associate)),
):
    """
    Associate responds 'recognized' or 'unrecognized' to a security notification.
    Response is immutable once set — prevents duplicate responses.
    Does NOT automatically release a blocked transaction.
    """
    response_value = payload.get("response", "")
    if response_value not in ("recognized", "unrecognized"):
        raise HTTPException(
            status_code=422,
            detail="Resposta inválida. Use 'recognized' ou 'unrecognized'.",
        )

    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if notif is None:
        raise HTTPException(status_code=404, detail="Notificação não encontrada.")
    if notif.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado.")

    if notif.alert_id is None:
        raise HTTPException(status_code=400, detail="Esta notificação não está associada a um alerta.")

    alert = db.query(Alert).filter(Alert.id == notif.alert_id).first()
    if alert is None:
        raise HTTPException(status_code=404, detail="Alerta não encontrado.")

    # Idempotency: if already responded, reject duplicate
    if alert.response is not None:
        raise HTTPException(
            status_code=409,
            detail="Esta ocorrência já possui uma resposta registrada.",
        )

    # Map frontend value to AlertResponse enum
    alert_response = AlertResponse.confirmed if response_value == "recognized" else AlertResponse.disputed
    alert.response = alert_response

    # Update alert status
    alert.status = AlertStatus.confirmed if response_value == "recognized" else AlertStatus.disputed

    # Mark notification as read
    notif.is_read = True

    # Audit
    db.add(AuditLog(
        actor=current_user.username,
        action="associate_response",
        entity_type="alert",
        entity_id=alert.id,
        from_status="pending",
        to_status=alert.status.value,
        justification=f"Associado respondeu: {response_value}",
    ))

    db.commit()

    # Notify analyst(s) of the response
    transaction = db.query(Transaction).filter(Transaction.id == alert.transaction_id).first()
    if transaction:
        associate = db.query(Associate).filter(Associate.id == transaction.associate_id).first()
        if associate:
            _notify_analysts_of_response(db, associate, alert, response_value, current_user)
            db.commit()

    return {"message": "Resposta registrada com sucesso."}


def _notify_analysts_of_response(
    db: Session,
    associate: Associate,
    alert: Alert,
    response_value: str,
    user: User,
) -> None:
    resp_label = "RECONHECEU" if response_value == "recognized" else "NÃO RECONHECEU"
    wallet_links = (
        db.query(ManagerWallet)
        .filter(ManagerWallet.associate_id == associate.id)
        .all()
    )
    for link in wallet_links:
        notif = Notification(
            user_id=link.analyst_id,
            alert_id=alert.id,
            title=f"Resposta do Associado — Alerta #{alert.id}",
            message=(
                f"{associate.user.full_name} {resp_label} a transação relacionada ao "
                f"Alerta #{alert.id} (risco {alert.risk_level}, score {alert.risk_score}/100)."
            ),
            is_read=False,
        )
        db.add(notif)
        # Push SSE event
        notification_service.push_event(link.analyst_id, "alert_response", {
            "alert_id": alert.id,
            "associate_name": associate.user.full_name,
            "response": response_value,
        })


# ---------------------------------------------------------------------------
# Analyst sends notification to an associate
# ---------------------------------------------------------------------------

@router.post("/send")
def send_notification_to_associate(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.analyst, UserRole.admin)),
):
    """
    Analyst sends a notification to an associate.
    Required: associate_user_id, title, message.
    Optional: alert_id.
    Validates wallet access.
    """
    associate_user_id = payload.get("associate_user_id")
    title = payload.get("title", "").strip()
    message = payload.get("message", "").strip()
    alert_id = payload.get("alert_id")

    if not associate_user_id or not title or not message:
        raise HTTPException(status_code=422, detail="associate_user_id, title e message são obrigatórios.")

    # Validate wallet access (unless admin)
    if current_user.role != UserRole.admin:
        target_associate = db.query(Associate).filter(Associate.user_id == associate_user_id).first()
        if target_associate is None:
            raise HTTPException(status_code=404, detail="Associado não encontrado.")

        wallet_link = db.query(ManagerWallet).filter(
            ManagerWallet.analyst_id == current_user.id,
            ManagerWallet.associate_id == target_associate.id,
        ).first()
        if wallet_link is None:
            raise HTTPException(status_code=403, detail="Associado não pertence à sua carteira.")

    notif = Notification(
        user_id=associate_user_id,
        alert_id=alert_id,
        title=title,
        message=message,
        is_read=False,
    )
    db.add(notif)
    db.add(AuditLog(
        actor=current_user.username,
        action="notification_sent",
        entity_type="notification",
        entity_id=None,
        justification=f"Para usuário {associate_user_id}: {title}",
    ))
    db.commit()
    db.refresh(notif)

    # Push SSE event to associate
    notification_service.push_event(associate_user_id, "notification", {
        "id": notif.id,
        "title": notif.title,
        "message": notif.message,
        "alert_id": notif.alert_id,
        "created_at": notif.created_at.isoformat() if notif.created_at else None,
    })

    return {"message": "Notificação enviada.", "notification_id": notif.id}


# ---------------------------------------------------------------------------
# SSE stream
# ---------------------------------------------------------------------------

@router.get("/sse")
async def sse_stream(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Server-Sent Events stream for real-time notifications.
    Authentication via JWT Bearer (same as all other endpoints).
    """
    user_id = current_user.id
    queue = notification_service.subscribe(user_id)

    async def generate():
        async for chunk in notification_service.event_stream(user_id, queue):
            # Check if client disconnected
            if await request.is_disconnected():
                break
            yield chunk

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
