"""
Admin API endpoints for Sicredi Guardião V2.
Provides system stats, audit log access, user management, and demo reset.
All endpoints require admin role.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.config import settings
from app.db.database import get_db
from app.models.models import (
    Alert, AlertStatus, AuditLog, Associate, Incident, IncidentStatus,
    Transaction, User, UserRole,
)

# Confirmation token required to prevent accidental resets
_RESET_CONFIRM_TOKEN = "RESET-DEMO-CONFIRMAR"

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
def get_admin_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """System overview statistics for admin dashboard."""
    total_users = db.query(User).count()
    active_associates = db.query(Associate).filter(Associate.is_active == True).count()
    total_analysts = db.query(User).filter(User.role == UserRole.analyst).count()
    total_transactions = db.query(Transaction).count()
    total_alerts = db.query(Alert).count()
    pending_alerts = db.query(Alert).filter(Alert.status == AlertStatus.pending).count()
    total_incidents = db.query(Incident).count()
    open_incidents = db.query(Incident).filter(
        Incident.status.in_([IncidentStatus.open, IncidentStatus.investigating])
    ).count()

    return {
        "total_users": total_users,
        "active_associates": active_associates,
        "total_analysts": total_analysts,
        "total_transactions": total_transactions,
        "total_alerts": total_alerts,
        "pending_alerts": pending_alerts,
        "total_incidents": total_incidents,
        "open_incidents": open_incidents,
        "ai_provider": settings.AI_PROVIDER,
        "app_version": settings.APP_VERSION,
    }


@router.get("/audit-log")
def get_audit_log(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Recent audit log entries."""
    limit = min(limit, 200)  # cap at 200
    entries = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": e.id,
            "actor": e.actor,
            "action": e.action,
            "entity_type": e.entity_type,
            "entity_id": e.entity_id,
            "from_status": e.from_status,
            "to_status": e.to_status,
            "justification": e.justification,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in entries
    ]


@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """List all users (admin only). Passwords are never returned."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role.value,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.patch("/users/{user_id}/toggle-active")
def toggle_user_active(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Toggle a user's active status. Cannot deactivate self."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Não é possível desativar o próprio usuário.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    user.is_active = not user.is_active

    db.add(AuditLog(
        actor=current_user.username,
        action="toggle_user_active",
        entity_type="user",
        entity_id=user_id,
        to_status="active" if user.is_active else "inactive",
        justification=f"Admin toggled active status for user {user.username}",
    ))
    db.commit()

    return {"user_id": user_id, "is_active": user.is_active, "username": user.username}


@router.post("/reset-demo")
def reset_demo_data(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """
    Reset the database to the full demo state.
    Requires explicit confirmation token to prevent accidental data loss.

    Body: { "confirm": "RESET-DEMO-CONFIRMAR" }
    """
    confirm = payload.get("confirm", "")
    if confirm != _RESET_CONFIRM_TOKEN:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Confirmação inválida. Envie {{ \"confirm\": \"{_RESET_CONFIRM_TOKEN}\" }} "
                "para confirmar o reset."
            ),
        )

    try:
        from app.db.seed import reset_and_seed
        # Close current session before dropping tables
        db.close()
        reset_and_seed()
        logger.info("Demo reset executed by admin: %s", current_user.username)
        return {
            "message": "Base de dados reinicializada com dados demonstrativos completos.",
            "executed_by": current_user.username,
        }
    except Exception as e:
        logger.error("Reset failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Erro ao reinicializar banco: {type(e).__name__}")
