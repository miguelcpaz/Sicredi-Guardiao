"""
Simulator API for Sicredi Guardião V2.

Analyst-only technical simulator for preparing demo scenarios.
Endpoints:
  POST /simulator/reset        — reset to clean seed state
  POST /simulator/scenario/{n} — prepare a specific demo scenario
  GET  /simulator/scenarios    — list available scenarios
"""
import json
import logging
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.db.database import get_db
from app.models.models import (
    Alert, AlertStatus, Associate, AuditLog, BehaviorProfile,
    Incident, IncidentStatus, ManagerWallet, Notification, PixTransfer,
    RiskAnalysis, Transaction, TransactionStatus, User, UserRole,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/simulator", tags=["simulator"])

SCENARIOS = {
    "A": {
        "name": "PIX Aprovado",
        "description": "Carlos realiza uma transferência de baixo risco (R$ 50 para um destinatário conhecido).",
        "associate": "carlos",
        "recipient": "Padaria Central",
        "amount": "50.00",
        "expected_risk": "low",
    },
    "B": {
        "name": "PIX em Verificação",
        "description": "Mariana realiza uma transferência com indicadores moderados.",
        "associate": "mariana",
        "recipient": "Loja Desconhecida",
        "amount": "320.00",
        "expected_risk": "medium",
    },
    "C": {
        "name": "PIX de Alto Risco",
        "description": "João realiza um PIX de R$ 8.500 para destinatário novo fora do horário típico.",
        "associate": "joao",
        "recipient": "Investimentos Rápidos LTDA",
        "amount": "8500.00",
        "expected_risk": "high",
    },
}


@router.get("/scenarios")
def list_scenarios(
    current_user: User = Depends(require_role(UserRole.analyst, UserRole.admin)),
):
    """List available demo scenarios."""
    return [
        {"id": k, **v}
        for k, v in SCENARIOS.items()
    ]


@router.post("/reset")
def reset_simulator(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.analyst, UserRole.admin)),
):
    """
    Reset database to clean seed state for demo.
    WARNING: Deletes all PIX transfers, transactions, alerts, incidents, notifications.
    Preserves user accounts, associates, behavior profiles, and wallet links.
    """
    # Delete in dependency order
    db.query(Notification).delete()
    db.query(Incident).delete()
    db.query(Alert).delete()
    db.query(RiskAnalysis).delete()
    db.query(PixTransfer).delete()
    db.query(Transaction).delete()

    # Reset balances to original values
    balance_map = {
        "carlos": Decimal("12450.00"),
        "mariana": Decimal("8320.50"),
        "joao": Decimal("5100.00"),
        "beatriz": Decimal("15800.00"),
        "lucas": Decimal("3200.00"),
    }
    from app.models.models import User as UserModel
    for username, balance in balance_map.items():
        user = db.query(UserModel).filter(UserModel.username == username).first()
        if user and user.associate:
            user.associate.balance = balance

    db.add(AuditLog(
        actor=current_user.username,
        action="simulator_reset",
        entity_type="database",
        justification="Demo reset via simulator API",
    ))
    db.commit()
    return {"message": "Simulador reiniciado. Banco de dados limpo para demonstração."}


@router.post("/scenario/{scenario_id}")
def prepare_scenario(
    scenario_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.analyst, UserRole.admin)),
):
    """
    Prepare a specific demo scenario by injecting the right transaction data.
    Does NOT bypass the fraud engine — sets up the associate's profile data
    to naturally trigger the expected risk level.
    """
    scenario_id = scenario_id.upper()
    if scenario_id not in SCENARIOS:
        raise HTTPException(status_code=404, detail=f"Cenário '{scenario_id}' não encontrado.")

    scenario = SCENARIOS[scenario_id]

    if scenario_id == "A":
        _prepare_scenario_a(db, current_user.username)
    elif scenario_id == "B":
        _prepare_scenario_b(db, current_user.username)
    elif scenario_id == "C":
        _prepare_scenario_c(db, current_user.username)

    db.add(AuditLog(
        actor=current_user.username,
        action=f"simulator_scenario_{scenario_id}",
        entity_type="simulator",
        justification=f"Cenário {scenario_id}: {scenario['name']}",
    ))
    db.commit()

    return {
        "message": f"Cenário {scenario_id} preparado: {scenario['name']}",
        "scenario": scenario,
        "instructions": _get_scenario_instructions(scenario_id),
    }


def _prepare_scenario_a(db: Session, actor: str) -> None:
    """Ensure Carlos has a clean state for a low-risk transaction."""
    # Carlos already has the right profile — just ensure balance is adequate
    from app.models.models import User as UserModel
    user = db.query(UserModel).filter(UserModel.username == "carlos").first()
    if user and user.associate:
        if (user.associate.balance or Decimal("0")) < Decimal("50.00"):
            user.associate.balance = Decimal("12450.00")


def _prepare_scenario_b(db: Session, actor: str) -> None:
    """Prepare Mariana for medium-risk: set her profile so R$320 to unknown merchant triggers medium."""
    from app.models.models import User as UserModel
    user = db.query(UserModel).filter(UserModel.username == "mariana").first()
    if user and user.associate:
        profile = db.query(BehaviorProfile).filter(
            BehaviorProfile.associate_id == user.associate.id
        ).first()
        if profile:
            # R$ 320 is ~1.8x her avg of 180 (R01 won't trigger, need unknown merchant + category)
            # Keep existing profile — "Loja Desconhecida" is not in her known_merchants
            pass
        if (user.associate.balance or Decimal("0")) < Decimal("320.00"):
            user.associate.balance = Decimal("8320.50")


def _prepare_scenario_c(db: Session, actor: str) -> None:
    """
    Prepare João for high-risk scenario: R$8500 to unknown recipient.
    João's profile: avg=120, max=400. R$8500 triggers R01 (>3x avg) + R07 (>1.5x max).
    Add unusual hour context if needed, and set balance >= 8500.
    """
    from app.models.models import User as UserModel
    user = db.query(UserModel).filter(UserModel.username == "joao").first()
    if user and user.associate:
        if (user.associate.balance or Decimal("0")) < Decimal("8500.00"):
            user.associate.balance = Decimal("15000.00")


def _get_scenario_instructions(scenario_id: str) -> list[str]:
    instructions = {
        "A": [
            "1. Abra o Portal do Associado e faça login como: carlos / sicredi123",
            "2. Clique em 'Fazer PIX'",
            "3. Destinatário: Padaria Central | Valor: R$ 50,00",
            "4. Confirme a transferência",
            "5. O sistema deve aprovar automaticamente (risco baixo)",
            "6. Verifique o saldo e o extrato atualizados",
        ],
        "B": [
            "1. Abra o Portal do Associado e faça login como: mariana / sicredi123",
            "2. Clique em 'Fazer PIX'",
            "3. Destinatário: Loja Desconhecida | Valor: R$ 320,00",
            "4. Confirme a transferência",
            "5. A transação deve ficar em verificação (risco médio)",
            "6. No Portal do Gerente (ana.ferreira), verifique o alerta recebido",
            "7. Analista solicita confirmação ao associado",
            "8. Mariana responde 'Reconheço' na Central de Segurança",
        ],
        "C": [
            "1. JANELA 1: Portal do Gerente — login: ana.ferreira / sicredi123",
            "2. JANELA 2: Portal do Associado — login: joao / sicredi123",
            "3. [João] Clique em 'Fazer PIX'",
            "4. [João] Destinatário: Investimentos Rápidos LTDA | Valor: R$ 8.500,00",
            "5. [João] Confirme a transferência",
            "6. [João] Sistema exibe mensagem de bloqueio por segurança",
            "7. [Ana] Novo alerta aparece no Portal do Gerente (alto risco)",
            "8. [Ana] Abra o alerta e consulte o Guardião AI",
            "9. [Ana] Clique em 'Manter Bloqueio e Notificar Associado'",
            "10. [João] Recebe notificação em tempo real",
            "11. [João] Acessa Central de Segurança e responde 'Não Reconheço'",
            "12. [Ana] Recebe resposta e encaminha para Investigação",
            "13. [Ana] Verifique o histórico de auditoria",
        ],
    }
    return instructions.get(scenario_id, [])
