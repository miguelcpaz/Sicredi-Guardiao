"""
Fraud service for Sicredi Guardião V2.

Orchestrates:
  1. FraudRulesEngine.analyze()     — deterministic, no network
  2. AI provider explanation        — network call (Gemini or mock)
  3. Transaction + Alert + Incident creation in DB

The score and risk_level from step 1 are IMMUTABLE throughout steps 2–3.

Fix in this version:
  - _get_behavior_context now receives the DB session and transaction to correctly
    count recent_transactions_last_hour for the R04 high_frequency rule.
    Previously this was always 0 (never triggered from the service layer).
"""
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.models.models import (
    Alert, AlertStatus, AuditLog, BehaviorProfile, Incident, IncidentStatus,
    RiskAnalysis, Transaction, TransactionStatus,
)
from app.providers.ai_provider import (
    AIAnalysisRequest, AIAnalysisResponse,
    BaseAIProvider, MockAIProvider, ProviderUnavailableError, get_ai_provider,
)
from app.rules.fraud_engine import BehaviorContext, FraudRulesEngine, TransactionInput
from app.schemas.schemas import TransactionAnalysisOut, RiskSignalOut

logger = logging.getLogger(__name__)

_engine = FraudRulesEngine()


def _count_recent_transactions(
    db: Session,
    associate_id: int,
    before_timestamp: datetime,
    window_hours: int = 1,
) -> int:
    """
    Count transactions for associate_id in the window_hours before before_timestamp.
    Used to populate recent_transactions_last_hour for the R04 high_frequency rule.
    Excludes the current transaction (which hasn't been flushed yet or is the current one).
    """
    window_start = before_timestamp - timedelta(hours=window_hours)
    count = (
        db.query(Transaction)
        .filter(
            Transaction.associate_id == associate_id,
            Transaction.timestamp >= window_start,
            Transaction.timestamp < before_timestamp,
        )
        .count()
    )
    return count


def _get_behavior_context(
    profile: Optional[BehaviorProfile],
    db: Optional[Session] = None,
    associate_id: Optional[int] = None,
    tx_timestamp: Optional[datetime] = None,
) -> BehaviorContext:
    base = BehaviorContext() if profile is None else BehaviorContext(
        avg_transaction_value=profile.avg_transaction_value or Decimal("0"),
        max_transaction_value=profile.max_transaction_value or Decimal("0"),
        typical_hours=profile.typical_hours or "06:00-22:00",
        typical_categories=[c.strip() for c in (profile.typical_categories or "").split(",") if c.strip()],
        known_merchants=[m.strip() for m in (profile.known_merchants or "").split(",") if m.strip()],
        typical_locations=[l.strip() for l in (profile.typical_locations or "").split(",") if l.strip()],
    )

    # Populate recent_transactions_last_hour for R04 velocity check
    if db is not None and associate_id is not None and tx_timestamp is not None:
        base.recent_transactions_last_hour = _count_recent_transactions(
            db, associate_id, tx_timestamp
        )

    return base


def analyze_transaction(
    db: Session,
    transaction: Transaction,
    actor_username: str,
    ai_provider: Optional[BaseAIProvider] = None,
) -> TransactionAnalysisOut:
    """
    Run fraud analysis on an existing Transaction record.
    Creates RiskAnalysis, Alert, and Incident rows as needed.
    Returns a TransactionAnalysisOut schema.
    """
    # 1. Load behavior profile
    profile = db.query(BehaviorProfile).filter(
        BehaviorProfile.associate_id == transaction.associate_id
    ).first()
    ctx = _get_behavior_context(
        profile,
        db=db,
        associate_id=transaction.associate_id,
        tx_timestamp=transaction.timestamp,
    )

    tx_input = TransactionInput(
        amount=Decimal(str(transaction.amount)),
        merchant=transaction.merchant,
        category=transaction.category,
        location=transaction.location or "",
        timestamp=transaction.timestamp,
        mode=transaction.mode,
        device_id=transaction.device_id or "",
    )

    # 2. Run deterministic engine — score is final here
    result = _engine.analyze(tx_input, ctx)

    # 3. Determine transaction status based on score thresholds
    if result.risk_score < 30:
        new_status = TransactionStatus.approved
    elif result.risk_score < 70:
        new_status = TransactionStatus.pending_review
    else:
        new_status = TransactionStatus.blocked

    transaction.status = new_status
    db.add(transaction)

    # 4. Get AI explanation (score is read-only for the provider)
    provider = ai_provider or get_ai_provider()
    ai_resp: AIAnalysisResponse
    try:
        ai_request = AIAnalysisRequest(
            transaction_id=transaction.id,
            amount=float(transaction.amount),
            merchant=transaction.merchant,
            category=transaction.category,
            location=transaction.location or "",
            mode=transaction.mode,
            timestamp=transaction.timestamp.isoformat(),
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
        ai_resp = provider.analyze(ai_request)
    except ProviderUnavailableError as e:
        logger.warning("AI provider unavailable for transaction %s: %s — using mock fallback",
                       transaction.id, e)
        mock_request = ai_request  # type: ignore[possibly-undefined]
        ai_resp_fallback = MockAIProvider().analyze(mock_request)
        # Mark as fallback so frontend can show "⚠️ Simulado (provider indisponível)"
        ai_resp = AIAnalysisResponse(
            explanation=ai_resp_fallback.explanation,
            risk_score=result.risk_score,
            risk_level=result.risk_level,
            provider="mock_fallback",
        )

    # 5. Persist RiskAnalysis
    import json
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

    # 6. Create Alert if score ≥ 30
    alert_id: Optional[int] = None
    if result.risk_score >= 30:
        alert = Alert(
            transaction_id=transaction.id,
            risk_score=result.risk_score,
            risk_level=result.risk_level,
            status=AlertStatus.pending,
        )
        db.add(alert)
        db.flush()  # get alert.id
        alert_id = alert.id

    # 7. Create Incident if score ≥ 70
    incident_id: Optional[int] = None
    if result.risk_score >= 70 and alert_id is not None:
        incident = Incident(
            transaction_id=transaction.id,
            alert_id=alert_id,
            status=IncidentStatus.open,
            description=f"Transação bloqueada automaticamente. Score: {result.risk_score}/100.",
        )
        db.add(incident)
        db.flush()
        incident_id = incident.id

    # 8. Audit log
    audit = AuditLog(
        actor=actor_username,
        action="transaction_analyzed",
        entity_type="transaction",
        entity_id=transaction.id,
        from_status="pending_review",
        to_status=new_status.value,
        justification=f"Score: {result.risk_score}/100 ({result.risk_level})",
    )
    db.add(audit)
    db.commit()

    return TransactionAnalysisOut(
        transaction_id=transaction.id,
        status=new_status.value,
        risk_score=result.risk_score,
        risk_level=result.risk_level,
        risk_factors=[s.rule_name for s in result.triggered_signals],
        risk_signals=[
            RiskSignalOut(
                rule_id=s.rule_id,
                rule_name=s.rule_name,
                triggered=s.triggered,
                score_contribution=s.score_contribution,
                evidence=s.evidence,
            )
            for s in result.all_signals
        ],
        explanation=ai_resp.explanation,
        ai_provider=ai_resp.provider,
        alert_id=alert_id,
        incident_id=incident_id,
    )
