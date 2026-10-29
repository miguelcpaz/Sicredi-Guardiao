"""
PIX Service for Sicredi Guardião V2.

Handles the full PIX transfer flow:
  1. Validate request (balance, input)
  2. Run fraud analysis
  3. Apply state machine transitions
  4. Persist PIX transfer + Transaction + RiskAnalysis
  5. Create alerts/incidents as needed
  6. Return structured result for frontend

Financial consistency rules:
  - APPROVED: balance is debited immediately.
  - RETAINED: balance is NOT debited (held preventively).
  - BLOCKED:  balance is NOT debited.
"""
import json
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.models.models import (
    Alert, AlertStatus, Associate, AuditLog, BehaviorProfile,
    Incident, IncidentStatus, ManagerWallet, Notification,
    PixTransfer, PixTransferStatus, RiskAnalysis, Transaction,
    TransactionStatus, User,
)
from app.providers.ai_provider import (
    AIAnalysisRequest, AIAnalysisResponse, MockAIProvider,
    ProviderUnavailableError, get_ai_provider,
)
from app.rules.fraud_engine import BehaviorContext, FraudRulesEngine, TransactionInput
from app.schemas.schemas import PixTransferResponse, RiskSignalOut

logger = logging.getLogger(__name__)

_engine = FraudRulesEngine()


def _get_behavior_context(profile: Optional[BehaviorProfile], recent_count: int = 0) -> BehaviorContext:
    if profile is None:
        return BehaviorContext()
    return BehaviorContext(
        avg_transaction_value=profile.avg_transaction_value or Decimal("0"),
        max_transaction_value=profile.max_transaction_value or Decimal("0"),
        typical_hours=profile.typical_hours or "06:00-22:00",
        typical_categories=[c.strip() for c in (profile.typical_categories or "").split(",") if c.strip()],
        known_merchants=[m.strip() for m in (profile.known_merchants or "").split(",") if m.strip()],
        typical_locations=[l.strip() for l in (profile.typical_locations or "").split(",") if l.strip()],
        recent_transactions_last_hour=recent_count,
    )


def _count_recent_transactions(db: Session, associate_id: int) -> int:
    from datetime import timedelta
    from sqlalchemy import func
    cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
    return (
        db.query(Transaction)
        .filter(
            Transaction.associate_id == associate_id,
            Transaction.timestamp >= cutoff,
        )
        .count()
    )


def process_pix_transfer(
    db: Session,
    associate: Associate,
    pix_key: str,
    recipient_name: str,
    amount: Decimal,
    description: str,
    actor_username: str,
) -> PixTransferResponse:
    """
    Full PIX transfer flow. Returns PixTransferResponse with result for frontend.
    """
    # --- 1. Balance check ---
    if (associate.balance or Decimal("0")) < amount:
        return PixTransferResponse(
            pix_transfer_id=0,
            status="rejected",
            result_screen="insufficient_funds",
            message="Saldo insuficiente para realizar esta transferência.",
        )

    # --- 2. Create pending PixTransfer record ---
    pix = PixTransfer(
        associate_id=associate.id,
        pix_key=pix_key,
        recipient_name=recipient_name,
        amount=amount,
        description=description,
        status=PixTransferStatus.processing,
    )
    db.add(pix)
    db.flush()

    # --- 3. Create Transaction record (base for fraud analysis) ---
    now = datetime.now(timezone.utc)
    transaction = Transaction(
        associate_id=associate.id,
        amount=amount,
        merchant=recipient_name,
        category="pix",
        location="",
        mode="pix",
        device_id="",
        timestamp=now,
        status=TransactionStatus.pending_review,
    )
    db.add(transaction)
    db.flush()

    # Link PIX to transaction
    pix.transaction_id = transaction.id

    # --- 4. Fraud analysis ---
    profile = db.query(BehaviorProfile).filter(
        BehaviorProfile.associate_id == associate.id
    ).first()
    recent_count = _count_recent_transactions(db, associate.id)
    ctx = _get_behavior_context(profile, recent_count)

    tx_input = TransactionInput(
        amount=amount,
        merchant=recipient_name,
        category="pix",
        location="",
        timestamp=now,
        mode="pix",
    )
    result = _engine.analyze(tx_input, ctx)

    # --- 5. AI explanation ---
    provider = get_ai_provider()
    try:
        ai_req = AIAnalysisRequest(
            transaction_id=transaction.id,
            amount=float(amount),
            merchant=recipient_name,
            category="pix",
            location="",
            mode="pix",
            timestamp=now.isoformat(),
            risk_score=result.risk_score,
            risk_level=result.risk_level,
            risk_factors=[s.rule_name for s in result.triggered_signals],
            risk_signals=[
                {"rule_id": s.rule_id, "rule_name": s.rule_name, "evidence": s.evidence}
                for s in result.triggered_signals
            ],
            associate_username=actor_username,
            avg_amount=float(ctx.avg_transaction_value),
            max_amount=float(ctx.max_transaction_value),
            typical_hours=ctx.typical_hours,
            typical_categories=ctx.typical_categories,
            known_merchants=ctx.known_merchants,
        )
        ai_resp = provider.analyze(ai_req)
    except ProviderUnavailableError as e:
        logger.warning("AI provider unavailable for pix %s: %s", pix.id, e)
        ai_resp = AIAnalysisResponse(
            explanation=MockAIProvider().analyze(ai_req).explanation,  # type: ignore[possibly-undefined]
            risk_score=result.risk_score,
            risk_level=result.risk_level,
            provider="mock_fallback",
        )

    # --- 6. Persist RiskAnalysis ---
    risk_analysis = RiskAnalysis(
        transaction_id=transaction.id,
        risk_score=result.risk_score,
        risk_level=result.risk_level,
        risk_factors=json.dumps([s.rule_name for s in result.triggered_signals]),
        risk_signals=json.dumps([
            {"rule_id": s.rule_id, "rule_name": s.rule_name,
             "triggered": s.triggered, "score_contribution": s.score_contribution,
             "evidence": s.evidence}
            for s in result.all_signals
        ]),
        explanation=ai_resp.explanation,
        provider=ai_resp.provider,
    )
    db.add(risk_analysis)

    # --- 7. State machine: determine outcome ---
    alert_id: Optional[int] = None
    incident_id: Optional[int] = None

    if result.risk_score < 30:
        # LOW RISK — approve and debit
        pix.status = PixTransferStatus.approved
        pix.processed_at = now
        transaction.status = TransactionStatus.approved
        associate.balance = (associate.balance or Decimal("0")) - amount
        result_screen = "approved"
        message = "Seu PIX foi realizado com sucesso."

    elif result.risk_score < 70:
        # MEDIUM RISK — retain, no debit
        pix.status = PixTransferStatus.retained
        transaction.status = TransactionStatus.pending_review
        result_screen = "retained"
        message = "Sua transação está aguardando uma verificação de segurança."

        alert = Alert(
            transaction_id=transaction.id,
            risk_score=result.risk_score,
            risk_level=result.risk_level,
            status=AlertStatus.pending,
        )
        db.add(alert)
        db.flush()
        alert_id = alert.id

    else:
        # HIGH RISK — block, no debit
        pix.status = PixTransferStatus.blocked
        transaction.status = TransactionStatus.blocked
        result_screen = "blocked"
        message = "Sua transferência não foi concluída por motivos de segurança."

        alert = Alert(
            transaction_id=transaction.id,
            risk_score=result.risk_score,
            risk_level=result.risk_level,
            status=AlertStatus.pending,
        )
        db.add(alert)
        db.flush()
        alert_id = alert.id

        incident = Incident(
            transaction_id=transaction.id,
            alert_id=alert_id,
            status=IncidentStatus.open,
            description=f"PIX bloqueado automaticamente. Score: {result.risk_score}/100.",
        )
        db.add(incident)
        db.flush()
        incident_id = incident.id

    # --- 8. Notify analyst(s) if alert created ---
    if alert_id is not None:
        _notify_analysts(db, associate, transaction, result.risk_score, result.risk_level, alert_id)

    # --- 9. Audit log ---
    db.add(AuditLog(
        actor=actor_username,
        action="pix_processed",
        entity_type="pix_transfer",
        entity_id=pix.id,
        from_status="processing",
        to_status=pix.status.value,
        justification=f"Score: {result.risk_score}/100 ({result.risk_level})",
    ))

    db.commit()

    return PixTransferResponse(
        pix_transfer_id=pix.id,
        status=pix.status.value,
        result_screen=result_screen,
        transaction_id=transaction.id,
        risk_score=result.risk_score,
        risk_level=result.risk_level,
        message=message,
        alert_id=alert_id,
    )


def _notify_analysts(
    db: Session,
    associate: Associate,
    transaction: Transaction,
    risk_score: int,
    risk_level: str,
    alert_id: int,
) -> None:
    """Create a notification for each analyst in the associate's wallet."""
    level_label = {"low": "Baixo", "medium": "Médio", "high": "Alto"}.get(risk_level, risk_level)
    wallet_links = (
        db.query(ManagerWallet)
        .filter(ManagerWallet.associate_id == associate.id)
        .all()
    )
    for link in wallet_links:
        notif = Notification(
            user_id=link.analyst_id,
            alert_id=alert_id,
            title=f"Alerta de Segurança — {level_label} Risco",
            message=(
                f"Uma transação PIX do associado {associate.user.full_name} "
                f"foi identificada com risco {level_label.lower()} "
                f"(score {risk_score}/100). Valor: R$ {float(transaction.amount):.2f}."
            ),
            is_read=False,
        )
        db.add(notif)
