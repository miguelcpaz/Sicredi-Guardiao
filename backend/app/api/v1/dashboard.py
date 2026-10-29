"""
Dashboard API — V2.

Fully implemented:
  - GET /dashboard/associate   Summary for the associate portal
  - GET /dashboard/analyst     Summary for the analyst portal (wallet-filtered)
"""
import json
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import require_role
from app.db.database import get_db
from app.models.models import (
    Alert, AlertStatus, Associate, Incident, IncidentStatus,
    ManagerWallet, Notification, PixTransfer, RiskAnalysis, Transaction,
    TransactionStatus, User, UserRole,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/associate")
def associate_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.associate)),
):
    assoc = db.query(Associate).filter(Associate.user_id == current_user.id).first()
    if assoc is None:
        return {"balance": 0.0, "pending_alerts": 0, "total_transactions": 0}

    total_tx = db.query(Transaction).filter(Transaction.associate_id == assoc.id).count()
    pending_alerts = (
        db.query(Alert)
        .join(Transaction)
        .filter(Transaction.associate_id == assoc.id, Alert.status == AlertStatus.pending)
        .count()
    )
    recent_txs = (
        db.query(Transaction)
        .filter(Transaction.associate_id == assoc.id)
        .order_by(Transaction.created_at.desc())
        .limit(5)
        .all()
    )
    unread_notifs = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .count()
    )

    return {
        "balance": float(assoc.balance or 0),
        "account_number": assoc.account_number,
        "full_name": current_user.full_name,
        "pending_alerts": pending_alerts,
        "total_transactions": total_tx,
        "unread_notifications": unread_notifs,
        "recent_transactions": [
            {
                "id": t.id,
                "amount": float(t.amount),
                "merchant": t.merchant,
                "status": t.status.value,
                "timestamp": t.timestamp.isoformat() if t.timestamp else None,
                "mode": t.mode,
            }
            for t in recent_txs
        ],
    }


@router.get("/analyst")
def analyst_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.analyst, UserRole.admin)),
):
    # Get wallet associate IDs
    if current_user.role == UserRole.admin:
        wallet_associate_ids = [a.id for a in db.query(Associate).all()]
    else:
        links = db.query(ManagerWallet).filter(ManagerWallet.analyst_id == current_user.id).all()
        wallet_associate_ids = [link.associate_id for link in links]

    # Stats for wallet
    total_transactions = (
        db.query(Transaction)
        .filter(Transaction.associate_id.in_(wallet_associate_ids))
        .count()
    )
    pending_alerts = (
        db.query(Alert)
        .join(Transaction)
        .filter(
            Transaction.associate_id.in_(wallet_associate_ids),
            Alert.status == AlertStatus.pending,
        )
        .count()
    )
    retained_count = (
        db.query(Transaction)
        .filter(
            Transaction.associate_id.in_(wallet_associate_ids),
            Transaction.status == TransactionStatus.pending_review,
        )
        .count()
    )
    blocked_count = (
        db.query(Transaction)
        .filter(
            Transaction.associate_id.in_(wallet_associate_ids),
            Transaction.status == TransactionStatus.blocked,
        )
        .count()
    )
    investigating_count = (
        db.query(Incident)
        .join(Transaction)
        .filter(
            Transaction.associate_id.in_(wallet_associate_ids),
            Incident.status == IncidentStatus.investigating,
        )
        .count()
    )
    unread_notifications = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
        .count()
    )

    # Total volume
    volume_row = (
        db.query(func.sum(Transaction.amount))
        .filter(Transaction.associate_id.in_(wallet_associate_ids))
        .scalar()
    )
    total_volume = float(volume_row or 0)

    # Resolved/closed incidents
    resolved_count = (
        db.query(Incident)
        .join(Transaction)
        .filter(
            Transaction.associate_id.in_(wallet_associate_ids),
            Incident.status.in_([IncidentStatus.resolved, IncidentStatus.closed]),
        )
        .count()
    )

    # Risk distribution: count alerts by risk level
    risk_dist_rows = (
        db.query(Alert.risk_level, func.count(Alert.id))
        .join(Transaction)
        .filter(Transaction.associate_id.in_(wallet_associate_ids))
        .group_by(Alert.risk_level)
        .all()
    )
    risk_distribution = {row[0]: row[1] for row in risk_dist_rows}

    # Time-series: transactions per day for last 14 days
    cutoff = datetime.now(timezone.utc) - timedelta(days=14)
    daily_rows = (
        db.query(
            func.strftime("%Y-%m-%d", Transaction.timestamp).label("day"),
            func.count(Transaction.id).label("count"),
            func.sum(Transaction.amount).label("volume"),
        )
        .filter(
            Transaction.associate_id.in_(wallet_associate_ids),
            Transaction.timestamp >= cutoff,
        )
        .group_by(func.strftime("%Y-%m-%d", Transaction.timestamp))
        .order_by(func.strftime("%Y-%m-%d", Transaction.timestamp))
        .all()
    )
    time_series = [
        {"date": row.day, "count": row.count, "volume": float(row.volume or 0)}
        for row in daily_rows
    ]

    # Recent alerts (all statuses, for dashboard display)
    recent_alerts = (
        db.query(Alert)
        .join(Transaction)
        .filter(Transaction.associate_id.in_(wallet_associate_ids))
        .order_by(Alert.created_at.desc())
        .limit(10)
        .all()
    )

    recent_alert_list = []
    for a in recent_alerts:
        t = a.transaction
        assoc = db.query(Associate).filter(Associate.id == t.associate_id).first() if t else None
        recent_alert_list.append({
            "id": a.id,
            "risk_score": a.risk_score,
            "risk_level": a.risk_level,
            "status": a.status.value,
            "amount": float(t.amount) if t else None,
            "merchant": t.merchant if t else None,
            "associate_name": assoc.user.full_name if assoc else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })

    return {
        "full_name": current_user.full_name,
        "total_transactions": total_transactions,
        "total_volume": total_volume,
        "pending_alerts": pending_alerts,
        "retained_transactions": retained_count,
        "blocked_transactions": blocked_count,
        "investigating_count": investigating_count,
        "resolved_count": resolved_count,
        "unread_notifications": unread_notifications,
        "associates_count": len(wallet_associate_ids),
        "risk_distribution": risk_distribution,
        "time_series": time_series,
        "recent_alerts": recent_alert_list,
    }
