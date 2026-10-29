"""
Sicredi Guardião V2 — Agentic Tools for Fraud Investigation.

This module provides the tool catalog for the Guardião AI agent.
Tools are divided into:
  - Read tools: fetch authorized data from the database
  - Intervention tools: request actions (validated and executed by FastAPI, not the AI)

Security design:
  - All tools receive the caller's User object and validate permissions.
  - Associates can only access their own data.
  - Analysts can only access data in their wallet.
  - Admins can access all data.
  - The AI cannot call tools directly — it requests them via function calling.
    The backend executes the actual tool and returns structured results.
  - Tool results sent back to the AI contain only what is needed, not raw DB rows.
  - Intervention tools never execute silently — they create audit records.
  - Maximum 10 tool calls per agent invocation to prevent runaway quota usage.
"""
import json
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.models import (
    Alert, AlertStatus, Associate, AuditLog, BehaviorProfile,
    Incident, IncidentEvent, IncidentStatus, ManagerWallet,
    Notification, RiskAnalysis, Transaction, TransactionStatus, User, UserRole,
)

logger = logging.getLogger(__name__)

# Maximum number of tool calls allowed per agent invocation
MAX_TOOL_CALLS = 10


# ---------------------------------------------------------------------------
# Authorization helpers
# ---------------------------------------------------------------------------

def _check_analyst_access_to_associate(db: Session, analyst: User, associate_id: int) -> bool:
    """Return True if analyst has wallet access to associate_id, or is admin."""
    if analyst.role == UserRole.admin:
        return True
    link = db.query(ManagerWallet).filter(
        ManagerWallet.analyst_id == analyst.id,
        ManagerWallet.associate_id == associate_id,
    ).first()
    return link is not None


def _check_analyst_access_to_transaction(db: Session, analyst: User, transaction_id: int) -> tuple[bool, Optional[Transaction]]:
    """Return (has_access, transaction) for a given analyst and transaction_id."""
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if tx is None:
        return False, None
    has_access = _check_analyst_access_to_associate(db, analyst, tx.associate_id)
    return has_access, tx


def _check_associate_owns_transaction(db: Session, user: User, transaction_id: int) -> tuple[bool, Optional[Transaction]]:
    """Return (owns, transaction) for an associate."""
    assoc = db.query(Associate).filter(Associate.user_id == user.id).first()
    if assoc is None:
        return False, None
    tx = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.associate_id == assoc.id,
    ).first()
    return (tx is not None), tx


# ---------------------------------------------------------------------------
# Read tools — analyst
# ---------------------------------------------------------------------------

def get_transaction_details(
    db: Session,
    caller: User,
    transaction_id: int,
) -> dict:
    """
    Fetch full transaction details (analyst or admin only).
    Returns structured dict safe to send to AI model.
    """
    has_access, tx = _check_analyst_access_to_transaction(db, caller, transaction_id)
    if not has_access or tx is None:
        return {"error": f"Transação {transaction_id} não encontrada ou acesso negado."}

    assoc = db.query(Associate).filter(Associate.id == tx.associate_id).first()
    return {
        "transaction_id": tx.id,
        "associate_name": assoc.user.full_name if assoc else "desconhecido",
        "account_number": assoc.account_number if assoc else "desconhecido",
        "amount": float(tx.amount),
        "merchant": tx.merchant,
        "category": tx.category,
        "location": tx.location or "",
        "mode": tx.mode,
        "status": tx.status.value,
        "timestamp": tx.timestamp.strftime("%d/%m/%Y %H:%M") if tx.timestamp else "",
    }


def get_transaction_risk(
    db: Session,
    caller: User,
    transaction_id: int,
) -> dict:
    """Fetch risk analysis for a transaction (analyst or admin only)."""
    has_access, tx = _check_analyst_access_to_transaction(db, caller, transaction_id)
    if not has_access or tx is None:
        return {"error": f"Transação {transaction_id} não encontrada ou acesso negado."}

    risk = db.query(RiskAnalysis).filter(RiskAnalysis.transaction_id == transaction_id).first()
    if risk is None:
        return {"error": "Análise de risco não disponível para esta transação."}

    signals = []
    try:
        raw = json.loads(risk.risk_signals or "[]")
        for s in raw:
            if s.get("triggered"):
                signals.append({
                    "rule": s.get("rule_name"),
                    "evidence": s.get("evidence"),
                    "contribution": s.get("score_contribution", 0),
                })
    except (json.JSONDecodeError, KeyError):
        pass

    return {
        "transaction_id": transaction_id,
        "risk_score": risk.risk_score,
        "risk_level": risk.risk_level,
        "triggered_signals": signals,
        "explanation": risk.explanation[:500] if risk.explanation else "",
    }


def get_associate_transaction_history(
    db: Session,
    caller: User,
    associate_id: int,
    limit: int = 20,
) -> dict:
    """Fetch recent transaction history for an associate (analyst or admin only)."""
    if not _check_analyst_access_to_associate(db, caller, associate_id):
        return {"error": f"Acesso negado ao associado {associate_id}."}

    assoc = db.query(Associate).filter(Associate.id == associate_id).first()
    if assoc is None:
        return {"error": f"Associado {associate_id} não encontrado."}

    txs = (
        db.query(Transaction)
        .filter(Transaction.associate_id == associate_id)
        .order_by(Transaction.timestamp.desc())
        .limit(min(limit, 50))
        .all()
    )

    return {
        "associate_id": associate_id,
        "associate_name": assoc.user.full_name,
        "transaction_count": len(txs),
        "transactions": [
            {
                "id": tx.id,
                "amount": float(tx.amount),
                "merchant": tx.merchant,
                "category": tx.category,
                "status": tx.status.value,
                "timestamp": tx.timestamp.strftime("%d/%m/%Y %H:%M") if tx.timestamp else "",
            }
            for tx in txs
        ],
    }


def get_behavior_profile(
    db: Session,
    caller: User,
    associate_id: int,
) -> dict:
    """Fetch behavioral profile for an associate (analyst or admin only)."""
    if not _check_analyst_access_to_associate(db, caller, associate_id):
        return {"error": f"Acesso negado ao associado {associate_id}."}

    profile = db.query(BehaviorProfile).filter(
        BehaviorProfile.associate_id == associate_id
    ).first()
    if profile is None:
        return {"error": "Perfil comportamental não disponível para este associado."}

    return {
        "associate_id": associate_id,
        "avg_transaction_value": float(profile.avg_transaction_value or 0),
        "max_transaction_value": float(profile.max_transaction_value or 0),
        "typical_hours": profile.typical_hours,
        "typical_categories": profile.typical_categories,
        "known_merchants": profile.known_merchants,
        "typical_locations": profile.typical_locations,
    }


def get_related_alerts(
    db: Session,
    caller: User,
    transaction_id: int,
) -> dict:
    """Fetch alerts related to a transaction (analyst or admin only)."""
    has_access, tx = _check_analyst_access_to_transaction(db, caller, transaction_id)
    if not has_access or tx is None:
        return {"error": f"Transação {transaction_id} não encontrada ou acesso negado."}

    alerts = db.query(Alert).filter(Alert.transaction_id == transaction_id).all()
    return {
        "transaction_id": transaction_id,
        "alerts": [
            {
                "id": a.id,
                "risk_score": a.risk_score,
                "risk_level": a.risk_level,
                "status": a.status.value,
                "response": a.response.value if a.response else None,
                "created_at": a.created_at.strftime("%d/%m/%Y %H:%M") if a.created_at else "",
            }
            for a in alerts
        ],
    }


def get_related_incidents(
    db: Session,
    caller: User,
    transaction_id: int,
) -> dict:
    """Fetch incidents related to a transaction (analyst or admin only)."""
    has_access, tx = _check_analyst_access_to_transaction(db, caller, transaction_id)
    if not has_access or tx is None:
        return {"error": f"Transação {transaction_id} não encontrada ou acesso negado."}

    incidents = db.query(Incident).filter(Incident.transaction_id == transaction_id).all()
    result = []
    for inc in incidents:
        events = db.query(IncidentEvent).filter(
            IncidentEvent.incident_id == inc.id
        ).order_by(IncidentEvent.created_at.asc()).all()
        result.append({
            "id": inc.id,
            "status": inc.status.value,
            "description": inc.description[:300] if inc.description else "",
            "resolution": inc.resolution[:300] if inc.resolution else "",
            "event_count": len(events),
            "events": [
                {
                    "actor": ev.actor,
                    "event_type": ev.event_type,
                    "description": ev.description[:200] if ev.description else "",
                }
                for ev in events[-5:]  # last 5 events
            ],
        })

    return {
        "transaction_id": transaction_id,
        "incidents": result,
    }


def get_recent_transactions(
    db: Session,
    caller: User,
    associate_id: int,
    hours: int = 24,
) -> dict:
    """Fetch transactions in the last N hours for velocity analysis (analyst/admin)."""
    if not _check_analyst_access_to_associate(db, caller, associate_id):
        return {"error": f"Acesso negado ao associado {associate_id}."}

    since = datetime.now(timezone.utc) - timedelta(hours=min(hours, 168))
    txs = (
        db.query(Transaction)
        .filter(
            Transaction.associate_id == associate_id,
            Transaction.timestamp >= since,
        )
        .order_by(Transaction.timestamp.desc())
        .all()
    )

    return {
        "associate_id": associate_id,
        "window_hours": hours,
        "transaction_count": len(txs),
        "transactions": [
            {
                "id": tx.id,
                "amount": float(tx.amount),
                "merchant": tx.merchant,
                "status": tx.status.value,
                "timestamp": tx.timestamp.strftime("%d/%m/%Y %H:%M") if tx.timestamp else "",
            }
            for tx in txs
        ],
    }


# ---------------------------------------------------------------------------
# Read tools — associate (limited view, no internal scores)
# ---------------------------------------------------------------------------

def get_own_transaction_status(
    db: Session,
    caller: User,
    transaction_id: int,
) -> dict:
    """Fetch transaction status for the authenticated associate (own transactions only)."""
    owns, tx = _check_associate_owns_transaction(db, caller, transaction_id)
    if not owns or tx is None:
        return {"error": "Transação não encontrada."}

    status_labels = {
        "approved": "aprovada",
        "blocked": "bloqueada por segurança",
        "pending_review": "em análise de segurança",
        "confirmed": "confirmada por você",
        "disputed": "contestada",
        "investigating": "em investigação",
        "resolved": "resolvida",
        "closed": "encerrada",
    }

    return {
        "transaction_id": tx.id,
        "amount": float(tx.amount),
        "merchant": tx.merchant,
        "status": tx.status.value,
        "status_label": status_labels.get(tx.status.value, tx.status.value),
        "timestamp": tx.timestamp.strftime("%d/%m/%Y %H:%M") if tx.timestamp else "",
    }


# ---------------------------------------------------------------------------
# Intervention tools (analyst only — backend executes, not AI)
# ---------------------------------------------------------------------------

def request_transaction_review(
    db: Session,
    caller: User,
    transaction_id: int,
    reason: str,
) -> dict:
    """
    Flag a transaction for human review. Creates an IncidentEvent.
    This is an observation action — does not change transaction status.
    Caller must be analyst or admin.
    """
    if caller.role not in (UserRole.analyst, UserRole.admin):
        return {"error": "Apenas analistas podem solicitar revisão."}

    has_access, tx = _check_analyst_access_to_transaction(db, caller, transaction_id)
    if not has_access or tx is None:
        return {"error": f"Transação {transaction_id} não encontrada ou acesso negado."}

    # Find or create an incident
    incident = db.query(Incident).filter(Incident.transaction_id == transaction_id).first()
    if incident is None:
        alert = db.query(Alert).filter(Alert.transaction_id == transaction_id).first()
        incident = Incident(
            transaction_id=transaction_id,
            alert_id=alert.id if alert else None,
            status=IncidentStatus.open,
            description=f"Revisão solicitada: {reason[:500]}",
        )
        db.add(incident)
        db.flush()

    db.add(IncidentEvent(
        incident_id=incident.id,
        actor=caller.username,
        event_type="review_requested",
        description=f"Guardião AI solicitou revisão: {reason[:500]}",
    ))
    db.add(AuditLog(
        actor=caller.username,
        action="ai_requested_review",
        entity_type="transaction",
        entity_id=transaction_id,
        justification=f"AI review request: {reason[:200]}",
    ))
    db.commit()

    return {
        "success": True,
        "action": "review_requested",
        "transaction_id": transaction_id,
        "incident_id": incident.id,
        "message": f"Revisão solicitada para transação {transaction_id}.",
    }


def request_transaction_hold(
    db: Session,
    caller: User,
    transaction_id: int,
    reason: str,
) -> dict:
    """
    Request a simulated hold on a transaction (pending_review status).
    The AI recommends this action — the backend validates and executes.
    Caller must be analyst or admin.
    Only applicable to transactions currently approved or pending_review.
    """
    if caller.role not in (UserRole.analyst, UserRole.admin):
        return {"error": "Apenas analistas podem solicitar retenção de transação."}

    has_access, tx = _check_analyst_access_to_transaction(db, caller, transaction_id)
    if not has_access or tx is None:
        return {"error": f"Transação {transaction_id} não encontrada ou acesso negado."}

    # Only hold transactions that are not already blocked/resolved
    holdable = {TransactionStatus.approved, TransactionStatus.pending_review}
    if tx.status not in holdable:
        return {
            "error": f"Transação com status '{tx.status.value}' não pode ser retida. "
                     f"Apenas transações aprovadas ou em análise podem ser retidas.",
        }

    from_status = tx.status.value
    tx.status = TransactionStatus.pending_review
    db.add(tx)

    incident = db.query(Incident).filter(Incident.transaction_id == transaction_id).first()
    if incident is None:
        alert = db.query(Alert).filter(Alert.transaction_id == transaction_id).first()
        incident = Incident(
            transaction_id=transaction_id,
            alert_id=alert.id if alert else None,
            status=IncidentStatus.open,
            description=f"Retenção solicitada pelo Guardião AI: {reason[:500]}",
        )
        db.add(incident)
        db.flush()

    db.add(IncidentEvent(
        incident_id=incident.id,
        actor=caller.username,
        event_type="hold_requested",
        description=f"Guardião AI solicitou retenção. Motivo: {reason[:500]}",
    ))
    db.add(AuditLog(
        actor=caller.username,
        action="ai_requested_hold",
        entity_type="transaction",
        entity_id=transaction_id,
        from_status=from_status,
        to_status=TransactionStatus.pending_review.value,
        justification=f"AI hold request: {reason[:200]}",
    ))
    db.commit()

    return {
        "success": True,
        "action": "hold_applied",
        "transaction_id": transaction_id,
        "previous_status": from_status,
        "new_status": "pending_review",
        "message": f"Transação {transaction_id} retida para revisão. [SIMULADO]",
    }


def create_fraud_alert(
    db: Session,
    caller: User,
    transaction_id: int,
    evidence: str,
) -> dict:
    """
    Create a fraud alert for a transaction (if one doesn't exist).
    Caller must be analyst or admin.
    """
    if caller.role not in (UserRole.analyst, UserRole.admin):
        return {"error": "Apenas analistas podem criar alertas."}

    has_access, tx = _check_analyst_access_to_transaction(db, caller, transaction_id)
    if not has_access or tx is None:
        return {"error": f"Transação {transaction_id} não encontrada ou acesso negado."}

    # Check if alert already exists
    existing = db.query(Alert).filter(Alert.transaction_id == transaction_id).first()
    if existing:
        return {
            "success": True,
            "action": "alert_exists",
            "alert_id": existing.id,
            "message": f"Alerta já existe para transação {transaction_id} (ID: {existing.id}).",
        }

    risk = db.query(RiskAnalysis).filter(RiskAnalysis.transaction_id == transaction_id).first()
    risk_score = risk.risk_score if risk else 50
    risk_level = risk.risk_level if risk else "medium"

    alert = Alert(
        transaction_id=transaction_id,
        risk_score=risk_score,
        risk_level=risk_level,
        status=AlertStatus.pending,
    )
    db.add(alert)
    db.flush()

    db.add(AuditLog(
        actor=caller.username,
        action="ai_created_alert",
        entity_type="alert",
        entity_id=alert.id,
        justification=f"AI evidence: {evidence[:200]}",
    ))
    db.commit()

    return {
        "success": True,
        "action": "alert_created",
        "alert_id": alert.id,
        "transaction_id": transaction_id,
        "message": f"Alerta criado para transação {transaction_id}.",
    }


def open_fraud_incident(
    db: Session,
    caller: User,
    transaction_id: int,
    reason: str,
) -> dict:
    """
    Open a formal fraud incident for a transaction (analyst or admin only).
    Creates Incident + IncidentEvent + AuditLog.
    """
    if caller.role not in (UserRole.analyst, UserRole.admin):
        return {"error": "Apenas analistas podem abrir incidentes."}

    has_access, tx = _check_analyst_access_to_transaction(db, caller, transaction_id)
    if not has_access or tx is None:
        return {"error": f"Transação {transaction_id} não encontrada ou acesso negado."}

    # Idempotency: check for existing open/investigating incident
    existing = db.query(Incident).filter(
        Incident.transaction_id == transaction_id,
        Incident.status.in_([IncidentStatus.open, IncidentStatus.investigating]),
    ).first()
    if existing:
        return {
            "success": True,
            "action": "incident_exists",
            "incident_id": existing.id,
            "message": f"Incidente já existe para transação {transaction_id} (ID: {existing.id}).",
        }

    alert = db.query(Alert).filter(Alert.transaction_id == transaction_id).first()
    incident = Incident(
        transaction_id=transaction_id,
        alert_id=alert.id if alert else None,
        status=IncidentStatus.open,
        description=f"Incidente aberto pelo Guardião AI: {reason[:500]}",
    )
    db.add(incident)
    db.flush()

    db.add(IncidentEvent(
        incident_id=incident.id,
        actor=caller.username,
        event_type="incident_opened",
        description=f"Guardião AI identificou padrão de fraude. Motivo: {reason[:500]}",
    ))
    db.add(AuditLog(
        actor=caller.username,
        action="ai_opened_incident",
        entity_type="incident",
        entity_id=incident.id,
        justification=f"AI incident: {reason[:200]}",
    ))
    db.commit()

    return {
        "success": True,
        "action": "incident_opened",
        "incident_id": incident.id,
        "transaction_id": transaction_id,
        "message": f"Incidente {incident.id} aberto para transação {transaction_id}.",
    }


def notify_associate(
    db: Session,
    caller: User,
    transaction_id: int,
    message: str,
) -> dict:
    """
    Send a security notification to the associate about a transaction.
    Caller must be analyst or admin.
    """
    if caller.role not in (UserRole.analyst, UserRole.admin):
        return {"error": "Apenas analistas podem enviar notificações."}

    has_access, tx = _check_analyst_access_to_transaction(db, caller, transaction_id)
    if not has_access or tx is None:
        return {"error": f"Transação {transaction_id} não encontrada ou acesso negado."}

    assoc = db.query(Associate).filter(Associate.id == tx.associate_id).first()
    if assoc is None:
        return {"error": "Associado não encontrado."}

    alert = db.query(Alert).filter(Alert.transaction_id == transaction_id).first()
    notif = Notification(
        user_id=assoc.user_id,
        alert_id=alert.id if alert else None,
        title="Notificação de segurança — Guardião Sicredi",
        message=f"{message[:500]}",
        is_read=False,
    )
    db.add(notif)
    db.add(AuditLog(
        actor=caller.username,
        action="ai_notified_associate",
        entity_type="transaction",
        entity_id=transaction_id,
        justification=f"AI notification sent to associate {assoc.user_id}",
    ))
    db.commit()

    return {
        "success": True,
        "action": "associate_notified",
        "notification_id": notif.id,
        "associate_name": assoc.user.full_name,
        "message": "Notificação enviada ao associado.",
    }


# ---------------------------------------------------------------------------
# Tool dispatcher — called by the agent endpoint
# ---------------------------------------------------------------------------

# Map tool names to their functions
_READ_TOOLS = {
    "get_transaction_details": get_transaction_details,
    "get_transaction_risk": get_transaction_risk,
    "get_associate_transaction_history": get_associate_transaction_history,
    "get_behavior_profile": get_behavior_profile,
    "get_related_alerts": get_related_alerts,
    "get_related_incidents": get_related_incidents,
    "get_recent_transactions": get_recent_transactions,
}

_INTERVENTION_TOOLS = {
    "request_transaction_review": request_transaction_review,
    "request_transaction_hold": request_transaction_hold,
    "create_fraud_alert": create_fraud_alert,
    "open_fraud_incident": open_fraud_incident,
    "notify_associate": notify_associate,
}

ALL_TOOLS = {**_READ_TOOLS, **_INTERVENTION_TOOLS}


def dispatch_tool(
    db: Session,
    caller: User,
    tool_name: str,
    tool_args: dict,
) -> dict:
    """
    Execute a named tool with given args, applying authorization.
    Returns structured result dict.
    Intervention tools require analyst/admin role — checked per-function.
    """
    if tool_name not in ALL_TOOLS:
        return {"error": f"Ferramenta '{tool_name}' não reconhecida ou não autorizada."}

    fn = ALL_TOOLS[tool_name]
    try:
        # Inject db and caller as first positional args
        return fn(db=db, caller=caller, **tool_args)
    except TypeError as e:
        logger.error("Tool %s called with wrong args %s: %s", tool_name, tool_args, e)
        return {"error": f"Parâmetros inválidos para ferramenta '{tool_name}'."}
    except Exception as e:
        logger.error("Tool %s execution error: %s", tool_name, type(e).__name__)
        return {"error": f"Erro ao executar ferramenta '{tool_name}'."}


# ---------------------------------------------------------------------------
# Gemini function declarations (schema for function calling)
# ---------------------------------------------------------------------------

GEMINI_TOOL_DECLARATIONS = [
    {
        "name": "get_transaction_details",
        "description": "Obtém os detalhes completos de uma transação: valor, estabelecimento, categoria, horário, status.",
        "parameters": {
            "type": "object",
            "properties": {
                "transaction_id": {"type": "integer", "description": "ID da transação a consultar."},
            },
            "required": ["transaction_id"],
        },
    },
    {
        "name": "get_transaction_risk",
        "description": "Obtém a análise de risco de uma transação: score, nível, fatores e evidências.",
        "parameters": {
            "type": "object",
            "properties": {
                "transaction_id": {"type": "integer", "description": "ID da transação a consultar."},
            },
            "required": ["transaction_id"],
        },
    },
    {
        "name": "get_associate_transaction_history",
        "description": "Obtém o histórico de transações de um associado para análise de padrão.",
        "parameters": {
            "type": "object",
            "properties": {
                "associate_id": {"type": "integer", "description": "ID do associado."},
                "limit": {"type": "integer", "description": "Número máximo de transações (padrão 20, máximo 50)."},
            },
            "required": ["associate_id"],
        },
    },
    {
        "name": "get_behavior_profile",
        "description": "Obtém o perfil comportamental de um associado: médias, horários típicos, estabelecimentos conhecidos.",
        "parameters": {
            "type": "object",
            "properties": {
                "associate_id": {"type": "integer", "description": "ID do associado."},
            },
            "required": ["associate_id"],
        },
    },
    {
        "name": "get_related_alerts",
        "description": "Obtém os alertas relacionados a uma transação.",
        "parameters": {
            "type": "object",
            "properties": {
                "transaction_id": {"type": "integer", "description": "ID da transação."},
            },
            "required": ["transaction_id"],
        },
    },
    {
        "name": "get_related_incidents",
        "description": "Obtém os incidentes e histórico de eventos relacionados a uma transação.",
        "parameters": {
            "type": "object",
            "properties": {
                "transaction_id": {"type": "integer", "description": "ID da transação."},
            },
            "required": ["transaction_id"],
        },
    },
    {
        "name": "get_recent_transactions",
        "description": "Obtém as transações recentes de um associado em uma janela de tempo (para análise de velocidade).",
        "parameters": {
            "type": "object",
            "properties": {
                "associate_id": {"type": "integer", "description": "ID do associado."},
                "hours": {"type": "integer", "description": "Janela em horas (padrão 24, máximo 168)."},
            },
            "required": ["associate_id"],
        },
    },
    {
        "name": "request_transaction_review",
        "description": "Solicita revisão humana de uma transação suspeita. Registra evento no incidente.",
        "parameters": {
            "type": "object",
            "properties": {
                "transaction_id": {"type": "integer", "description": "ID da transação a revisar."},
                "reason": {"type": "string", "description": "Motivo da solicitação de revisão."},
            },
            "required": ["transaction_id", "reason"],
        },
    },
    {
        "name": "request_transaction_hold",
        "description": "Solicita retenção simulada de uma transação (muda status para pending_review). AÇÃO REVERSÍVEL. Use apenas quando há evidências sólidas de risco.",
        "parameters": {
            "type": "object",
            "properties": {
                "transaction_id": {"type": "integer", "description": "ID da transação a reter."},
                "reason": {"type": "string", "description": "Justificativa para a retenção."},
            },
            "required": ["transaction_id", "reason"],
        },
    },
    {
        "name": "create_fraud_alert",
        "description": "Cria um alerta de fraude para uma transação que ainda não possui alerta.",
        "parameters": {
            "type": "object",
            "properties": {
                "transaction_id": {"type": "integer", "description": "ID da transação."},
                "evidence": {"type": "string", "description": "Evidências que justificam o alerta."},
            },
            "required": ["transaction_id", "evidence"],
        },
    },
    {
        "name": "open_fraud_incident",
        "description": "Abre um incidente formal de fraude. Use quando há evidências suficientes para investigação.",
        "parameters": {
            "type": "object",
            "properties": {
                "transaction_id": {"type": "integer", "description": "ID da transação."},
                "reason": {"type": "string", "description": "Justificativa para abrir o incidente."},
            },
            "required": ["transaction_id", "reason"],
        },
    },
    {
        "name": "notify_associate",
        "description": "Envia notificação de segurança ao associado sobre a transação.",
        "parameters": {
            "type": "object",
            "properties": {
                "transaction_id": {"type": "integer", "description": "ID da transação."},
                "message": {"type": "string", "description": "Mensagem de segurança para o associado."},
            },
            "required": ["transaction_id", "message"],
        },
    },
]
