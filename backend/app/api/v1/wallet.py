"""
Wallet API for Sicredi Guardião V2.

Endpoints:
  GET /wallet/associates          — analyst's wallet (associates in their portfolio)
  GET /wallet/associates/{id}     — associate detail (wallet access validated)
  GET /wallet/associates/{id}/transactions — associate's transactions
  GET /wallet/associates/{id}/alerts       — associate's alerts
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.db.database import get_db
from app.models.models import (
    Alert, Associate, BehaviorProfile, ManagerWallet, RiskAnalysis,
    Transaction, User, UserRole,
)

router = APIRouter(prefix="/wallet", tags=["wallet"])


def _check_wallet_access(db: Session, analyst: User, associate_id: int) -> Associate:
    """Validate analyst has wallet access to this associate. Returns Associate or raises 403."""
    associate = db.query(Associate).filter(Associate.id == associate_id).first()
    if associate is None:
        raise HTTPException(status_code=404, detail="Associado não encontrado.")

    if analyst.role == UserRole.admin:
        return associate

    wallet_link = db.query(ManagerWallet).filter(
        ManagerWallet.analyst_id == analyst.id,
        ManagerWallet.associate_id == associate_id,
    ).first()
    if wallet_link is None:
        raise HTTPException(status_code=403, detail="Associado não pertence à sua carteira.")
    return associate


@router.get("/associates")
def list_wallet_associates(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.analyst, UserRole.admin)),
):
    """List all associates in the analyst's wallet."""
    if current_user.role == UserRole.admin:
        associates = db.query(Associate).all()
    else:
        links = (
            db.query(ManagerWallet)
            .filter(ManagerWallet.analyst_id == current_user.id)
            .all()
        )
        associate_ids = [link.associate_id for link in links]
        associates = db.query(Associate).filter(Associate.id.in_(associate_ids)).all()

    result = []
    for a in associates:
        # Count pending alerts for this associate
        pending_alerts = (
            db.query(Alert)
            .join(Transaction)
            .filter(
                Transaction.associate_id == a.id,
                Alert.status.in_(["pending"]),
            )
            .count()
        )
        total_tx = db.query(Transaction).filter(Transaction.associate_id == a.id).count()
        result.append({
            "id": a.id,
            "user_id": a.user_id,
            "account_number": a.account_number,
            "balance": float(a.balance or 0),
            "full_name": a.user.full_name,
            "username": a.user.username,
            "email": a.user.email,
            "is_active": a.is_active,
            "pending_alerts": pending_alerts,
            "total_transactions": total_tx,
        })
    return result


@router.get("/associates/{associate_id}")
def get_associate_detail(
    associate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.analyst, UserRole.admin)),
):
    """Get detailed info about a specific associate in the analyst's wallet."""
    associate = _check_wallet_access(db, current_user, associate_id)
    profile = db.query(BehaviorProfile).filter(
        BehaviorProfile.associate_id == associate_id
    ).first()

    return {
        "id": associate.id,
        "user_id": associate.user_id,
        "account_number": associate.account_number,
        "balance": float(associate.balance or 0),
        "full_name": associate.user.full_name,
        "username": associate.user.username,
        "email": associate.user.email,
        "is_active": associate.is_active,
        "behavior_profile": {
            "avg_transaction_value": float(profile.avg_transaction_value or 0) if profile else 0,
            "max_transaction_value": float(profile.max_transaction_value or 0) if profile else 0,
            "typical_hours": profile.typical_hours if profile else "N/A",
            "typical_categories": profile.typical_categories if profile else "",
            "known_merchants": profile.known_merchants if profile else "",
            "typical_locations": profile.typical_locations if profile else "",
        } if profile else None,
    }


@router.get("/associates/{associate_id}/transactions")
def get_associate_transactions(
    associate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.analyst, UserRole.admin)),
):
    """List transactions for an associate in the analyst's wallet."""
    associate = _check_wallet_access(db, current_user, associate_id)

    transactions = (
        db.query(Transaction)
        .filter(Transaction.associate_id == associate.id)
        .order_by(Transaction.created_at.desc())
        .limit(100)
        .all()
    )

    result = []
    for t in transactions:
        risk = db.query(RiskAnalysis).filter(RiskAnalysis.transaction_id == t.id).first()
        result.append({
            "id": t.id,
            "amount": float(t.amount),
            "merchant": t.merchant,
            "category": t.category,
            "location": t.location,
            "mode": t.mode,
            "status": t.status.value,
            "timestamp": t.timestamp.isoformat() if t.timestamp else None,
            "risk_score": risk.risk_score if risk else None,
            "risk_level": risk.risk_level if risk else None,
        })
    return result


@router.get("/associates/{associate_id}/alerts")
def get_associate_alerts(
    associate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.analyst, UserRole.admin)),
):
    """List alerts for an associate in the analyst's wallet."""
    associate = _check_wallet_access(db, current_user, associate_id)

    alerts = (
        db.query(Alert)
        .join(Transaction)
        .filter(Transaction.associate_id == associate.id)
        .order_by(Alert.created_at.desc())
        .all()
    )

    result = []
    for a in alerts:
        result.append({
            "id": a.id,
            "transaction_id": a.transaction_id,
            "risk_score": a.risk_score,
            "risk_level": a.risk_level,
            "status": a.status.value,
            "response": a.response.value if a.response else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "amount": float(a.transaction.amount) if a.transaction else None,
            "merchant": a.transaction.merchant if a.transaction else None,
        })
    return result
