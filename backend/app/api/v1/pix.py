"""
PIX Transfer API for Sicredi Guardião V2.

Endpoints:
  POST /pix/transfer     — initiate a PIX transfer (associate only)
  GET  /pix/transfers    — list associate's PIX transfers
  GET  /pix/transfers/{id} — detail
"""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.db.database import get_db
from app.models.models import Associate, PixTransfer, User, UserRole
from app.schemas.schemas import PixTransferRequest, PixTransferResponse
from app.services.pix_service import process_pix_transfer

router = APIRouter(prefix="/pix", tags=["pix"])


@router.post("/transfer", response_model=PixTransferResponse, status_code=status.HTTP_201_CREATED)
def initiate_pix_transfer(
    payload: PixTransferRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.associate)),
):
    """
    Initiate a PIX transfer. Runs fraud analysis and returns the outcome.
    Only the authenticated associate can initiate; score is calculated server-side.
    """
    associate = db.query(Associate).filter(Associate.user_id == current_user.id).first()
    if associate is None:
        raise HTTPException(status_code=404, detail="Perfil de associado não encontrado.")

    return process_pix_transfer(
        db=db,
        associate=associate,
        pix_key=payload.pix_key,
        recipient_name=payload.recipient_name,
        amount=payload.amount,
        description=payload.description,
        actor_username=current_user.username,
    )


@router.get("/transfers", response_model=list[dict])
def list_pix_transfers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.associate)),
):
    """List the authenticated associate's PIX transfers."""
    associate = db.query(Associate).filter(Associate.user_id == current_user.id).first()
    if associate is None:
        return []

    transfers = (
        db.query(PixTransfer)
        .filter(PixTransfer.associate_id == associate.id)
        .order_by(PixTransfer.initiated_at.desc())
        .limit(50)
        .all()
    )

    result = []
    for t in transfers:
        result.append({
            "id": t.id,
            "pix_key": t.pix_key,
            "recipient_name": t.recipient_name,
            "amount": float(t.amount),
            "description": t.description,
            "status": t.status.value,
            "transaction_id": t.transaction_id,
            "initiated_at": t.initiated_at.isoformat() if t.initiated_at else None,
            "processed_at": t.processed_at.isoformat() if t.processed_at else None,
        })
    return result


@router.get("/transfers/{pix_id}", response_model=dict)
def get_pix_transfer(
    pix_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific PIX transfer. Associates only see their own."""
    transfer = db.query(PixTransfer).filter(PixTransfer.id == pix_id).first()
    if transfer is None:
        raise HTTPException(status_code=404, detail="Transferência PIX não encontrada.")

    if current_user.role == UserRole.associate:
        associate = db.query(Associate).filter(Associate.user_id == current_user.id).first()
        if associate is None or transfer.associate_id != associate.id:
            raise HTTPException(status_code=403, detail="Acesso negado.")

    return {
        "id": transfer.id,
        "pix_key": transfer.pix_key,
        "recipient_name": transfer.recipient_name,
        "amount": float(transfer.amount),
        "description": transfer.description,
        "status": transfer.status.value,
        "transaction_id": transfer.transaction_id,
        "initiated_at": transfer.initiated_at.isoformat() if transfer.initiated_at else None,
        "processed_at": transfer.processed_at.isoformat() if transfer.processed_at else None,
    }
