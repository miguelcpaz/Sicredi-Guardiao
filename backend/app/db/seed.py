"""
Seed script for Sicredi Guardião V2.

Creates demo users, associates, cards, behavior profiles, rich transaction history,
fraud cases, alerts, incidents, notifications, and audit logs.

All passwords are hashed with bcrypt — no SHA-256.

Demo credentials:
  Associates:   carlos / sicredi123
                mariana / sicredi123
                joao / sicredi123
                beatriz / sicredi123
                lucas / sicredi123

  Analysts:     ana.ferreira / sicredi123   (carteira: carlos, mariana, joao)
                roberto.silva / sicredi123   (carteira: beatriz, lucas)

  Admin:        admin / sicredi123

Public functions:
  reset_and_seed()  — drops all tables, recreates and populates (DESTRUCTIVE).
                      Called explicitly from CLI or admin endpoint with confirmation.
  safe_seed()       — only seeds if the database is empty (idempotent startup safe).
"""
import json
import logging
from decimal import Decimal
from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.db.database import Base, SessionLocal, engine
from app.models.models import (
    Alert, AlertResponse, AlertStatus,
    Associate, AuditLog, BehaviorProfile, Card,
    ChatMessage, ChatSession, ChatRole,
    Incident, IncidentEvent, IncidentStatus,
    ManagerWallet, Notification, PixTransfer, PixTransferStatus,
    RiskAnalysis, RiskConfig, Transaction, TransactionStatus, User, UserRole,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public entry points
# ---------------------------------------------------------------------------

def reset_and_seed():
    """Drop all tables, recreate, and populate with demo data. DESTRUCTIVE."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    try:
        _seed(db)
        logger.info("OK: Banco populado com sucesso.")
        print("OK: Banco populado com sucesso.")
    except Exception as e:
        db.rollback()
        logger.error("ERRO ao popular banco: %s", e)
        print(f"ERRO ao popular banco: {e}")
        raise
    finally:
        db.close()


def safe_seed():
    """
    Idempotent seed: only runs if the database has no users.
    Safe to call on every startup — will never overwrite existing data.
    """
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        existing = db.query(User).count()
        if existing == 0:
            logger.info("Banco vazio detectado — executando seed inicial...")
            _seed(db)
            logger.info("Seed concluído com sucesso.")
        else:
            logger.info("Banco já populado (%d usuários) — seed ignorado.", existing)
    except Exception as e:
        db.rollback()
        logger.error("ERRO no safe_seed: %s", e)
        raise
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _now(delta_hours: float = 0) -> datetime:
    return datetime.now(timezone.utc) - timedelta(hours=delta_hours)


def _seed(db: Session):
    pw = get_password_hash("sicredi123")

    # ------------------------------------------------------------------
    # Users — associates
    # ------------------------------------------------------------------
    u_carlos = User(username="carlos", email="carlos@demo.sicredi.br",
                    full_name="Carlos Mendes", hashed_password=pw, role=UserRole.associate)
    u_mariana = User(username="mariana", email="mariana@demo.sicredi.br",
                     full_name="Mariana Costa", hashed_password=pw, role=UserRole.associate)
    u_joao = User(username="joao", email="joao@demo.sicredi.br",
                  full_name="João Oliveira", hashed_password=pw, role=UserRole.associate)
    u_beatriz = User(username="beatriz", email="beatriz@demo.sicredi.br",
                     full_name="Beatriz Santos", hashed_password=pw, role=UserRole.associate)
    u_lucas = User(username="lucas", email="lucas@demo.sicredi.br",
                   full_name="Lucas Pereira", hashed_password=pw, role=UserRole.associate)

    # Users — analysts
    u_ana = User(username="ana.ferreira", email="ana.ferreira@sicredi.br",
                 full_name="Ana Ferreira", hashed_password=pw, role=UserRole.analyst)
    u_roberto = User(username="roberto.silva", email="roberto.silva@sicredi.br",
                     full_name="Roberto Silva", hashed_password=pw, role=UserRole.analyst)

    # User — admin
    u_admin = User(username="admin", email="admin@sicredi.br",
                   full_name="Administrador", hashed_password=pw, role=UserRole.admin)

    db.add_all([u_carlos, u_mariana, u_joao, u_beatriz, u_lucas,
                u_ana, u_roberto, u_admin])
    db.flush()

    # ------------------------------------------------------------------
    # Associates
    # ------------------------------------------------------------------
    a_carlos = Associate(user_id=u_carlos.id, account_number="0001-1", balance=Decimal("12450.00"))
    a_mariana = Associate(user_id=u_mariana.id, account_number="0002-2", balance=Decimal("8320.50"))
    a_joao = Associate(user_id=u_joao.id, account_number="0003-3", balance=Decimal("5100.00"))
    a_beatriz = Associate(user_id=u_beatriz.id, account_number="0004-4", balance=Decimal("15800.00"))
    a_lucas = Associate(user_id=u_lucas.id, account_number="0005-5", balance=Decimal("3200.00"))

    db.add_all([a_carlos, a_mariana, a_joao, a_beatriz, a_lucas])
    db.flush()

    # ------------------------------------------------------------------
    # Cards
    # ------------------------------------------------------------------
    db.add_all([
        Card(associate_id=a_carlos.id, last_four="4521", card_type="debit"),
        Card(associate_id=a_mariana.id, last_four="7832", card_type="credit"),
        Card(associate_id=a_joao.id, last_four="1094", card_type="debit"),
        Card(associate_id=a_beatriz.id, last_four="6610", card_type="credit"),
        Card(associate_id=a_lucas.id, last_four="3307", card_type="debit"),
    ])

    # ------------------------------------------------------------------
    # Behavior profiles
    # ------------------------------------------------------------------
    db.add_all([
        BehaviorProfile(
            associate_id=a_carlos.id,
            avg_transaction_value=Decimal("250.00"),
            max_transaction_value=Decimal("800.00"),
            typical_hours="08:00-22:00",
            typical_categories="alimentação,supermercado,transporte",
            known_merchants="Supermercado Esperança,Padaria Central,Posto Shell",
            typical_locations="Porto Alegre",
        ),
        BehaviorProfile(
            associate_id=a_mariana.id,
            avg_transaction_value=Decimal("180.00"),
            max_transaction_value=Decimal("600.00"),
            typical_hours="09:00-21:00",
            typical_categories="vestuário,alimentação,beleza",
            known_merchants="Renner,Sephora,iFood",
            typical_locations="Canoas",
        ),
        BehaviorProfile(
            associate_id=a_joao.id,
            avg_transaction_value=Decimal("120.00"),
            max_transaction_value=Decimal("400.00"),
            typical_hours="07:00-20:00",
            typical_categories="alimentação,transporte,educação",
            known_merchants="McDonald's,Uber,PUCRS",
            typical_locations="Porto Alegre",
        ),
        BehaviorProfile(
            associate_id=a_beatriz.id,
            avg_transaction_value=Decimal("400.00"),
            max_transaction_value=Decimal("1200.00"),
            typical_hours="10:00-22:00",
            typical_categories="eletrônicos,alimentação,saúde",
            known_merchants="Magazine Luiza,Rappi,Farmácia São João",
            typical_locations="Novo Hamburgo",
        ),
        BehaviorProfile(
            associate_id=a_lucas.id,
            avg_transaction_value=Decimal("90.00"),
            max_transaction_value=Decimal("300.00"),
            typical_hours="08:00-20:00",
            typical_categories="alimentação,lazer,transporte",
            known_merchants="Subway,Cinema Hoyts,99Táxi",
            typical_locations="São Leopoldo",
        ),
    ])
    db.flush()

    # ------------------------------------------------------------------
    # Manager wallets
    # ------------------------------------------------------------------
    db.add_all([
        ManagerWallet(analyst_id=u_ana.id, associate_id=a_carlos.id),
        ManagerWallet(analyst_id=u_ana.id, associate_id=a_mariana.id),
        ManagerWallet(analyst_id=u_ana.id, associate_id=a_joao.id),
        ManagerWallet(analyst_id=u_roberto.id, associate_id=a_beatriz.id),
        ManagerWallet(analyst_id=u_roberto.id, associate_id=a_lucas.id),
    ])

    # ------------------------------------------------------------------
    # Risk configs
    # ------------------------------------------------------------------
    db.add_all([
        RiskConfig(rule_name="high_amount", weight=25, description="Valor > 3× média histórica"),
        RiskConfig(rule_name="unusual_hour", weight=20, description="Fora do horário típico"),
        RiskConfig(rule_name="unknown_merchant", weight=15, description="Estabelecimento desconhecido"),
        RiskConfig(rule_name="high_frequency", weight=20, description="> 3 transações/hora"),
        RiskConfig(rule_name="unusual_category", weight=10, description="Categoria fora do perfil"),
        RiskConfig(rule_name="unusual_location", weight=10, description="Localização atípica"),
        RiskConfig(rule_name="velocity_amount", weight=20, description="Valor > 1.5× máximo histórico"),
    ])

    db.flush()

    # ------------------------------------------------------------------
    # Historical transactions (background volume — approved, no alerts)
    # These provide dashboard metrics and extrato data.
    # ------------------------------------------------------------------
    approved_txs = []

    # Carlos — 14 days of approved routine transactions
    for i, (merchant, cat, amt, dh) in enumerate([
        ("Supermercado Esperança", "alimentação", "185.00", 336),
        ("Padaria Central", "alimentação", "42.50", 312),
        ("Posto Shell", "transporte", "95.00", 288),
        ("Supermercado Esperança", "alimentação", "210.00", 264),
        ("Farmácia São João", "saúde", "67.30", 240),
        ("Padaria Central", "alimentação", "38.00", 216),
        ("Posto Shell", "transporte", "110.00", 192),
        ("Supermercado Esperança", "alimentação", "195.80", 168),
        ("Padaria Central", "alimentação", "45.00", 144),
        ("Posto Shell", "transporte", "88.00", 120),
        ("Supermercado Esperança", "alimentação", "220.00", 96),
        ("Padaria Central", "alimentação", "52.00", 72),
        ("Posto Shell", "transporte", "102.00", 48),
        ("Supermercado Esperança", "alimentação", "175.00", 24),
    ]):
        t = Transaction(
            associate_id=a_carlos.id,
            amount=Decimal(amt),
            merchant=merchant,
            category=cat,
            location="Porto Alegre",
            mode="debit",
            timestamp=_now(dh),
            status=TransactionStatus.approved,
        )
        approved_txs.append(t)

    # Mariana — 10 approved transactions
    for merchant, cat, amt, dh in [
        ("Renner", "vestuário", "195.00", 300),
        ("iFood", "alimentação", "87.50", 276),
        ("Sephora", "beleza", "145.00", 252),
        ("Renner", "vestuário", "230.00", 228),
        ("iFood", "alimentação", "62.00", 204),
        ("Sephora", "beleza", "78.90", 180),
        ("Renner", "vestuário", "310.00", 156),
        ("iFood", "alimentação", "95.00", 132),
        ("Sephora", "beleza", "120.00", 108),
        ("iFood", "alimentação", "74.30", 84),
    ]:
        t = Transaction(
            associate_id=a_mariana.id,
            amount=Decimal(amt),
            merchant=merchant,
            category=cat,
            location="Canoas",
            mode="credit",
            timestamp=_now(dh),
            status=TransactionStatus.approved,
        )
        approved_txs.append(t)

    # João — 8 approved transactions
    for merchant, cat, amt, dh in [
        ("McDonald's", "alimentação", "45.00", 290),
        ("Uber", "transporte", "32.00", 266),
        ("PUCRS", "educação", "350.00", 242),
        ("McDonald's", "alimentação", "38.50", 218),
        ("Uber", "transporte", "28.00", 194),
        ("McDonald's", "alimentação", "52.00", 170),
        ("Uber", "transporte", "41.00", 146),
        ("PUCRS", "educação", "350.00", 122),
    ]:
        t = Transaction(
            associate_id=a_joao.id,
            amount=Decimal(amt),
            merchant=merchant,
            category=cat,
            location="Porto Alegre",
            mode="pix",
            timestamp=_now(dh),
            status=TransactionStatus.approved,
        )
        approved_txs.append(t)

    # Beatriz — 8 approved transactions
    for merchant, cat, amt, dh in [
        ("Magazine Luiza", "eletrônicos", "850.00", 280),
        ("Rappi", "alimentação", "120.00", 256),
        ("Farmácia São João", "saúde", "95.00", 232),
        ("Magazine Luiza", "eletrônicos", "450.00", 208),
        ("Rappi", "alimentação", "145.00", 184),
        ("Farmácia São João", "saúde", "78.00", 160),
        ("Magazine Luiza", "eletrônicos", "1100.00", 136),
        ("Rappi", "alimentação", "98.00", 112),
    ]:
        t = Transaction(
            associate_id=a_beatriz.id,
            amount=Decimal(amt),
            merchant=merchant,
            category=cat,
            location="Novo Hamburgo",
            mode="credit",
            timestamp=_now(dh),
            status=TransactionStatus.approved,
        )
        approved_txs.append(t)

    # Lucas — 7 approved transactions
    for merchant, cat, amt, dh in [
        ("Subway", "alimentação", "42.00", 270),
        ("Cinema Hoyts", "lazer", "86.00", 246),
        ("99Táxi", "transporte", "35.00", 222),
        ("Subway", "alimentação", "48.50", 198),
        ("Cinema Hoyts", "lazer", "92.00", 174),
        ("99Táxi", "transporte", "28.00", 150),
        ("Subway", "alimentação", "55.00", 126),
    ]:
        t = Transaction(
            associate_id=a_lucas.id,
            amount=Decimal(amt),
            merchant=merchant,
            category=cat,
            location="São Leopoldo",
            mode="debit",
            timestamp=_now(dh),
            status=TransactionStatus.approved,
        )
        approved_txs.append(t)

    db.add_all(approved_txs)
    db.flush()

    # Add RiskAnalysis for all approved transactions (score 0, low risk)
    for t in approved_txs:
        db.add(RiskAnalysis(
            transaction_id=t.id,
            risk_score=0,
            risk_level="low",
            risk_factors=json.dumps([]),
            risk_signals=json.dumps([]),
            explanation="Transação dentro do padrão comportamental. Nenhum fator de risco identificado.",
            provider="engine",
        ))

    db.flush()

    # Add PIX transfer records for the approved PIX transactions of João
    joao_pix_txs = [t for t in approved_txs if t.associate_id == a_joao.id]
    for t in joao_pix_txs[:3]:
        db.add(PixTransfer(
            associate_id=a_joao.id,
            pix_key="pucrs@edu.br",
            recipient_name="PUCRS - Mensalidade",
            amount=t.amount,
            description="Pagamento mensalidade",
            transaction_id=t.id,
            status=PixTransferStatus.approved,
            processed_at=t.timestamp,
        ))

    db.flush()

    # =======================================================================
    # FRAUD CASES — 6 pre-built scenarios
    # =======================================================================

    # -----------------------------------------------------------------------
    # CASO 1 — Transação legítima (Carlos, R$ 85, aprovada)
    # PIX habitual para destinatário conhecido, horário normal, baixo risco.
    # -----------------------------------------------------------------------
    tx1 = Transaction(
        associate_id=a_carlos.id,
        amount=Decimal("85.00"),
        merchant="Supermercado Esperança",
        category="alimentação",
        location="Porto Alegre",
        mode="pix",
        timestamp=_now(18),
        status=TransactionStatus.approved,
    )
    db.add(tx1)
    db.flush()

    db.add(RiskAnalysis(
        transaction_id=tx1.id,
        risk_score=0,
        risk_level="low",
        risk_factors=json.dumps([]),
        risk_signals=json.dumps([
            {"rule_id": "R01", "rule_name": "high_amount", "triggered": False, "score_contribution": 0,
             "evidence": "Valor R$ 85.00 dentro da média histórica de R$ 250.00."},
            {"rule_id": "R02", "rule_name": "unusual_hour", "triggered": False, "score_contribution": 0,
             "evidence": "Horário dentro da janela típica (08:00-22:00)."},
            {"rule_id": "R03", "rule_name": "unknown_merchant", "triggered": False, "score_contribution": 0,
             "evidence": "Estabelecimento 'Supermercado Esperança' é conhecido."},
        ]),
        explanation=(
            "Score de risco: 0/100 (baixo). Nenhum fator de risco identificado. "
            "PIX de R$ 85,00 para o Supermercado Esperança, estabelecimento frequentado por Carlos. "
            "Horário, valor e localização compatíveis com o perfil histórico."
        ),
        provider="engine",
    ))

    db.add(PixTransfer(
        associate_id=a_carlos.id,
        pix_key="supermercadoesperanca@sicredi.br",
        recipient_name="Supermercado Esperança",
        amount=Decimal("85.00"),
        description="Compras do dia",
        transaction_id=tx1.id,
        status=PixTransferStatus.approved,
        processed_at=_now(18),
    ))

    db.add(AuditLog(
        actor="system",
        action="transaction_analyzed",
        entity_type="transaction",
        entity_id=tx1.id,
        from_status="pending_review",
        to_status="approved",
        justification="Score: 0/100 (low) — aprovação automática",
    ))

    db.flush()

    # -----------------------------------------------------------------------
    # CASO 2 — PIX de valor atípico (Mariana, R$ 2.800, retida)
    # Valor ~15,5× a média de R$ 180. Destinatário desconhecido. Score médio-alto.
    # -----------------------------------------------------------------------
    tx2 = Transaction(
        associate_id=a_mariana.id,
        amount=Decimal("2800.00"),
        merchant="Viagens Premium LTDA",
        category="viagem",
        location="Canoas",
        mode="pix",
        timestamp=_now(36),
        status=TransactionStatus.pending_review,
    )
    db.add(tx2)
    db.flush()

    # Score: R01 (25) + R03 (15) + R05 (10) = 50 → medium
    db.add(RiskAnalysis(
        transaction_id=tx2.id,
        risk_score=50,
        risk_level="medium",
        risk_factors=json.dumps(["high_amount", "unknown_merchant", "unusual_category"]),
        risk_signals=json.dumps([
            {"rule_id": "R01", "rule_name": "high_amount", "triggered": True, "score_contribution": 25,
             "evidence": "Valor R$ 2800.00 é 15.6× acima da média histórica de R$ 180.00."},
            {"rule_id": "R02", "rule_name": "unusual_hour", "triggered": False, "score_contribution": 0,
             "evidence": "Horário dentro da janela típica (09:00-21:00)."},
            {"rule_id": "R03", "rule_name": "unknown_merchant", "triggered": True, "score_contribution": 15,
             "evidence": "Estabelecimento 'Viagens Premium LTDA' não consta no histórico da associada."},
            {"rule_id": "R05", "rule_name": "unusual_category", "triggered": True, "score_contribution": 10,
             "evidence": "Categoria 'viagem' não está no perfil habitual da associada."},
            {"rule_id": "R07", "rule_name": "velocity_amount", "triggered": False, "score_contribution": 0,
             "evidence": "Valor R$ 2800.00 supera 1.5× o máximo histórico de R$ 600.00."},
        ]),
        explanation=(
            "Score de risco: 50/100 (médio). Transação retida para confirmação. "
            "Fatores ativos: high_amount, unknown_merchant, unusual_category. "
            "PIX de R$ 2.800,00 para 'Viagens Premium LTDA', destinatário não cadastrado no perfil de Mariana. "
            "Valor é 15,6× superior à média histórica de R$ 180,00. "
            "Recomendação: solicitar confirmação da associada antes de liberar."
        ),
        provider="engine",
    ))

    alert2 = Alert(
        transaction_id=tx2.id,
        risk_score=50,
        risk_level="medium",
        status=AlertStatus.pending,
    )
    db.add(alert2)
    db.flush()

    db.add(Notification(
        user_id=u_mariana.id,
        alert_id=alert2.id,
        title="Transação retida para confirmação",
        message=(
            "Uma transferência PIX de R$ 2.800,00 para 'Viagens Premium LTDA' foi retida. "
            "Score de risco: 50/100 (médio). Por favor, confirme se reconhece esta operação "
            "na Central de Segurança."
        ),
        is_read=False,
    ))

    db.add(Notification(
        user_id=u_ana.id,
        alert_id=alert2.id,
        title="Novo alerta — Mariana Costa (médio risco)",
        message=(
            "PIX de R$ 2.800,00 de Mariana Costa retido automaticamente. "
            "Score 50/100 — valor atípico e destinatário desconhecido. Aguardando resposta da associada."
        ),
        is_read=False,
    ))

    db.add(AuditLog(
        actor="system",
        action="transaction_analyzed",
        entity_type="transaction",
        entity_id=tx2.id,
        from_status="pending_review",
        to_status="pending_review",
        justification="Score: 50/100 (medium) — transação retida, alerta gerado",
    ))

    db.flush()

    # -----------------------------------------------------------------------
    # CASO 3 — Transação em horário incomum (Lucas, R$ 450, score médio)
    # Madrugada + valor acima do máximo histórico + localização atípica.
    # -----------------------------------------------------------------------
    # Create a timestamp at 03:15 local (UTC-3 = 06:15 UTC) two days ago
    ts3 = datetime.now(timezone.utc).replace(hour=6, minute=15, second=0) - timedelta(days=2)
    tx3 = Transaction(
        associate_id=a_lucas.id,
        amount=Decimal("450.00"),
        merchant="Posto 24 Horas",
        category="transporte",
        location="Gravataí",
        mode="debit",
        timestamp=ts3,
        status=TransactionStatus.pending_review,
    )
    db.add(tx3)
    db.flush()

    # Score: R02 (20) + R06 (10) + R07 (20) = 50 → medium
    db.add(RiskAnalysis(
        transaction_id=tx3.id,
        risk_score=45,
        risk_level="medium",
        risk_factors=json.dumps(["unusual_hour", "unusual_location", "velocity_amount"]),
        risk_signals=json.dumps([
            {"rule_id": "R02", "rule_name": "unusual_hour", "triggered": True, "score_contribution": 20,
             "evidence": "Transação às 03h está fora do horário típico (08:00-20:00)."},
            {"rule_id": "R06", "rule_name": "unusual_location", "triggered": True, "score_contribution": 10,
             "evidence": "Localização 'Gravataí' diferente das localidades habituais do associado."},
            {"rule_id": "R07", "rule_name": "velocity_amount", "triggered": True, "score_contribution": 15,
             "evidence": "Valor R$ 450.00 supera 1.5× o máximo histórico de R$ 300.00."},
        ]),
        explanation=(
            "Score de risco: 45/100 (médio). Transação retida para análise. "
            "Fatores: unusual_hour, unusual_location, velocity_amount. "
            "Movimentação às 03h15 em Gravataí, cidade não registrada no perfil de Lucas. "
            "Valor R$ 450,00 acima do seu máximo histórico de R$ 300,00. "
            "Pode indicar viagem não registrada ou uso indevido do cartão."
        ),
        provider="engine",
    ))

    alert3 = Alert(
        transaction_id=tx3.id,
        risk_score=45,
        risk_level="medium",
        status=AlertStatus.pending,
    )
    db.add(alert3)
    db.flush()

    db.add(Notification(
        user_id=u_lucas.id,
        alert_id=alert3.id,
        title="Movimentação suspeita detectada",
        message=(
            "Uma transação de R$ 450,00 no 'Posto 24 Horas' em Gravataí foi retida às 03h15. "
            "Isso está fora do seu padrão habitual. Confirme na Central de Segurança."
        ),
        is_read=True,
    ))

    db.add(Notification(
        user_id=u_roberto.id,
        alert_id=alert3.id,
        title="Alerta — Lucas Pereira (médio risco)",
        message="Transação de Lucas às 03h em localização atípica. Score 45/100. Aguardando análise.",
        is_read=True,
    ))

    db.add(AuditLog(
        actor="system",
        action="transaction_analyzed",
        entity_type="transaction",
        entity_id=tx3.id,
        from_status="pending_review",
        to_status="pending_review",
        justification="Score: 45/100 (medium) — horário incomum + localização atípica",
    ))

    db.flush()

    # -----------------------------------------------------------------------
    # CASO 4 — Suspeita de fraude (João, R$ 8.500, bloqueada)
    # Destinatário desconhecido, valor muito alto, múltiplos fatores de risco.
    # -----------------------------------------------------------------------
    # Timestamp at 02:30 UTC (23:30 local BRT) — outside João's window
    ts4 = datetime.now(timezone.utc).replace(hour=2, minute=30, second=0) - timedelta(days=3)
    tx4 = Transaction(
        associate_id=a_joao.id,
        amount=Decimal("8500.00"),
        merchant="Investimentos Rápidos LTDA",
        category="investimento",
        location="São Paulo",
        mode="pix",
        timestamp=ts4,
        status=TransactionStatus.blocked,
    )
    db.add(tx4)
    db.flush()

    # Score: R01 (25) + R02 (20) + R03 (15) + R05 (10) + R06 (10) + R07 (20) = 100 → high
    db.add(RiskAnalysis(
        transaction_id=tx4.id,
        risk_score=100,
        risk_level="high",
        risk_factors=json.dumps(["high_amount", "unusual_hour", "unknown_merchant",
                                  "unusual_category", "unusual_location", "velocity_amount"]),
        risk_signals=json.dumps([
            {"rule_id": "R01", "rule_name": "high_amount", "triggered": True, "score_contribution": 25,
             "evidence": "Valor R$ 8500.00 é 70.8× acima da média histórica de R$ 120.00."},
            {"rule_id": "R02", "rule_name": "unusual_hour", "triggered": True, "score_contribution": 20,
             "evidence": "Transação às 23h está fora do horário típico (07:00-20:00)."},
            {"rule_id": "R03", "rule_name": "unknown_merchant", "triggered": True, "score_contribution": 15,
             "evidence": "Estabelecimento 'Investimentos Rápidos LTDA' não consta no histórico do associado."},
            {"rule_id": "R05", "rule_name": "unusual_category", "triggered": True, "score_contribution": 10,
             "evidence": "Categoria 'investimento' não está no perfil habitual do associado."},
            {"rule_id": "R06", "rule_name": "unusual_location", "triggered": True, "score_contribution": 10,
             "evidence": "Localização 'São Paulo' diferente das localidades habituais."},
            {"rule_id": "R07", "rule_name": "velocity_amount", "triggered": True, "score_contribution": 20,
             "evidence": "Valor R$ 8500.00 supera 1.5× o máximo histórico de R$ 400.00."},
        ]),
        explanation=(
            "Score de risco: 100/100 (alto). Transação bloqueada automaticamente. "
            "6 fatores de risco ativos: valor 70,8× acima da média, horário noturno fora da janela típica, "
            "destinatário desconhecido, categoria incomum, localização fora do padrão e valor acima do máximo histórico. "
            "Padrão altamente consistente com fraude por engenharia social ou account takeover. "
            "Recomendação: bloquear, abrir investigação e contatar o associado imediatamente."
        ),
        provider="engine",
    ))

    alert4 = Alert(
        transaction_id=tx4.id,
        risk_score=100,
        risk_level="high",
        status=AlertStatus.pending,
    )
    db.add(alert4)
    db.flush()

    incident4 = Incident(
        transaction_id=tx4.id,
        alert_id=alert4.id,
        status=IncidentStatus.open,
        description=(
            "Transação bloqueada automaticamente. Score: 100/100. "
            "PIX de R$ 8.500,00 para destinatário desconhecido em horário atípico. "
            "Todos os 6 indicadores de risco ativados. Aguarda análise do analista."
        ),
    )
    db.add(incident4)
    db.flush()

    db.add(IncidentEvent(
        incident_id=incident4.id,
        actor="system",
        event_type="auto_block",
        description="Transação bloqueada automaticamente pelo motor antifraude. Score 100/100.",
    ))

    db.add(Notification(
        user_id=u_joao.id,
        alert_id=alert4.id,
        title="⚠ Transação bloqueada por segurança",
        message=(
            "Uma transferência PIX de R$ 8.500,00 para 'Investimentos Rápidos LTDA' foi bloqueada. "
            "Nossa equipe de segurança está analisando a ocorrência. "
            "Se você não reconhece esta operação, acesse a Central de Segurança."
        ),
        is_read=False,
    ))

    db.add(Notification(
        user_id=u_ana.id,
        alert_id=alert4.id,
        title="🚨 ALERTA CRÍTICO — João Oliveira",
        message=(
            "PIX de R$ 8.500,00 de João Oliveira bloqueado automaticamente. "
            "Score 100/100 — 6 fatores de risco ativos. Investigação aberta. Ação imediata recomendada."
        ),
        is_read=False,
    ))

    db.add(AuditLog(
        actor="system",
        action="transaction_blocked",
        entity_type="transaction",
        entity_id=tx4.id,
        from_status="pending_review",
        to_status="blocked",
        justification="Score: 100/100 (high) — bloqueio automático, investigação aberta",
    ))

    db.flush()

    # -----------------------------------------------------------------------
    # CASO 5 — Fraude contestada (Beatriz, R$ 3.200, investigação em andamento)
    # Associada não reconhece a transação. Investigação com histórico de ações.
    # -----------------------------------------------------------------------
    ts5 = datetime.now(timezone.utc).replace(hour=1, minute=45, second=0) - timedelta(days=5)
    tx5 = Transaction(
        associate_id=a_beatriz.id,
        amount=Decimal("3200.00"),
        merchant="Eletrônicos Express",
        category="eletrônicos",
        location="Recife",
        mode="pix",
        timestamp=ts5,
        status=TransactionStatus.investigating,
    )
    db.add(tx5)
    db.flush()

    # Score: R01 (25) + R02 (20) + R03 (15) + R06 (10) = 70 → high
    db.add(RiskAnalysis(
        transaction_id=tx5.id,
        risk_score=70,
        risk_level="high",
        risk_factors=json.dumps(["high_amount", "unusual_hour", "unknown_merchant", "unusual_location"]),
        risk_signals=json.dumps([
            {"rule_id": "R01", "rule_name": "high_amount", "triggered": True, "score_contribution": 25,
             "evidence": "Valor R$ 3200.00 é 8.0× acima da média histórica de R$ 400.00."},
            {"rule_id": "R02", "rule_name": "unusual_hour", "triggered": True, "score_contribution": 20,
             "evidence": "Transação às 01h45 fora do horário típico (10:00-22:00)."},
            {"rule_id": "R03", "rule_name": "unknown_merchant", "triggered": True, "score_contribution": 15,
             "evidence": "Estabelecimento 'Eletrônicos Express' não consta no histórico da associada."},
            {"rule_id": "R06", "rule_name": "unusual_location", "triggered": True, "score_contribution": 10,
             "evidence": "Localização 'Recife' diferente das localidades habituais da associada."},
        ]),
        explanation=(
            "Score de risco: 70/100 (alto). Transação bloqueada e investigação aberta. "
            "Fatores: high_amount (8× a média), unusual_hour (01h45), unknown_merchant, unusual_location (Recife). "
            "Padrão consistente com clonagem de chave PIX ou account takeover. "
            "Associada contestou a transação — investigação em andamento."
        ),
        provider="engine",
    ))

    alert5 = Alert(
        transaction_id=tx5.id,
        risk_score=70,
        risk_level="high",
        status=AlertStatus.disputed,
        response=AlertResponse.disputed,
    )
    db.add(alert5)
    db.flush()

    incident5 = Incident(
        transaction_id=tx5.id,
        alert_id=alert5.id,
        status=IncidentStatus.investigating,
        description=(
            "Associada Beatriz Santos não reconhece transferência de R$ 3.200,00 para "
            "'Eletrônicos Express' em Recife. Possível clonagem de chave PIX. "
            "Conta em restrição preventiva enquanto investigação prossegue."
        ),
    )
    db.add(incident5)
    db.flush()

    # Rich event history for case 5
    db.add_all([
        IncidentEvent(
            incident_id=incident5.id,
            actor="system",
            event_type="auto_block",
            description="Transação bloqueada automaticamente. Score 70/100.",
            created_at=ts5 + timedelta(seconds=5),
        ),
        IncidentEvent(
            incident_id=incident5.id,
            actor="roberto.silva",
            event_type="alert_reviewed",
            description="Analista revisou alerta. Notificação enviada à associada para confirmação.",
            created_at=ts5 + timedelta(hours=1),
        ),
        IncidentEvent(
            incident_id=incident5.id,
            actor="beatriz",
            event_type="associate_response",
            description="Associada respondeu: 'NÃO RECONHEÇO esta transação. Nunca estive em Recife.'",
            created_at=ts5 + timedelta(hours=2, minutes=30),
        ),
        IncidentEvent(
            incident_id=incident5.id,
            actor="roberto.silva",
            event_type="investigation_opened",
            description=(
                "Investigação aberta formalmente. Conta de Beatriz com restrição preventiva de PIX. "
                "Acionado processo de contestação junto ao Banco Central."
            ),
            created_at=ts5 + timedelta(hours=3),
        ),
        IncidentEvent(
            incident_id=incident5.id,
            actor="roberto.silva",
            event_type="ai_consultation",
            description=(
                "Guardião IA consultado: análise confirma padrão de account takeover. "
                "Recomendação: manter restrição, iniciar processo de estorno."
            ),
            created_at=ts5 + timedelta(hours=4),
        ),
    ])

    # Restrict Beatriz's card
    beatriz_card = db.query(Card).filter(Card.associate_id == a_beatriz.id).first()
    if beatriz_card:
        beatriz_card.is_restricted = True

    db.add(Notification(
        user_id=u_beatriz.id,
        alert_id=alert5.id,
        title="Conta com restrição preventiva",
        message=(
            "Sua conta está com restrição preventiva de transferências PIX enquanto investigamos "
            "a transação contestada de R$ 3.200,00. Nossa equipe entrará em contato em até 24h."
        ),
        is_read=True,
    ))

    db.add(Notification(
        user_id=u_roberto.id,
        alert_id=alert5.id,
        title="Beatriz contestou transação — investigação ativa",
        message="Beatriz Santos não reconhece PIX de R$ 3.200,00 para Recife. Investigação em andamento. Restrição aplicada.",
        is_read=True,
    ))

    db.add_all([
        AuditLog(
            actor="system",
            action="transaction_blocked",
            entity_type="transaction",
            entity_id=tx5.id,
            from_status="pending_review",
            to_status="blocked",
            justification="Score: 70/100 (high) — bloqueio automático",
            created_at=ts5 + timedelta(seconds=5),
        ),
        AuditLog(
            actor="beatriz",
            action="associate_response",
            entity_type="alert",
            entity_id=alert5.id,
            from_status="pending",
            to_status="disputed",
            justification="Associada não reconhece transação",
            created_at=ts5 + timedelta(hours=2, minutes=30),
        ),
        AuditLog(
            actor="roberto.silva",
            action="investigation_opened",
            entity_type="incident",
            entity_id=incident5.id,
            from_status="open",
            to_status="investigating",
            justification="Contestação confirmada. Restrição preventiva aplicada.",
            created_at=ts5 + timedelta(hours=3),
        ),
    ])

    db.flush()

    # -----------------------------------------------------------------------
    # CASO 6 — Investigação concluída (Carlos, R$ 1.500, resolvida)
    # Histórico completo, análise do Guardião IA, decisão do analista, trilha de auditoria.
    # -----------------------------------------------------------------------
    ts6 = datetime.now(timezone.utc).replace(hour=22, minute=10, second=0) - timedelta(days=10)
    tx6 = Transaction(
        associate_id=a_carlos.id,
        amount=Decimal("1500.00"),
        merchant="Importados Online",
        category="importados",
        location="São Paulo",
        mode="pix",
        timestamp=ts6,
        status=TransactionStatus.resolved,
    )
    db.add(tx6)
    db.flush()

    # Score: R01 (25) + R03 (15) + R05 (10) + R06 (10) = 60 → medium
    db.add(RiskAnalysis(
        transaction_id=tx6.id,
        risk_score=60,
        risk_level="medium",
        risk_factors=json.dumps(["high_amount", "unknown_merchant", "unusual_category", "unusual_location"]),
        risk_signals=json.dumps([
            {"rule_id": "R01", "rule_name": "high_amount", "triggered": True, "score_contribution": 25,
             "evidence": "Valor R$ 1500.00 é 6.0× acima da média histórica de R$ 250.00."},
            {"rule_id": "R03", "rule_name": "unknown_merchant", "triggered": True, "score_contribution": 15,
             "evidence": "Estabelecimento 'Importados Online' não consta no histórico do associado."},
            {"rule_id": "R05", "rule_name": "unusual_category", "triggered": True, "score_contribution": 10,
             "evidence": "Categoria 'importados' não está no perfil habitual do associado."},
            {"rule_id": "R06", "rule_name": "unusual_location", "triggered": True, "score_contribution": 10,
             "evidence": "Localização 'São Paulo' diferente das localidades habituais."},
        ]),
        explanation=(
            "Score de risco: 60/100 (médio). Transação retida para análise. "
            "Carlos realizou compra online de R$ 1.500,00 em estabelecimento desconhecido em São Paulo. "
            "Após confirmação do associado e análise do Guardião IA, transação liberada como legítima."
        ),
        provider="engine",
    ))

    alert6 = Alert(
        transaction_id=tx6.id,
        risk_score=60,
        risk_level="medium",
        status=AlertStatus.confirmed,
        response=AlertResponse.confirmed,
    )
    db.add(alert6)
    db.flush()

    incident6 = Incident(
        transaction_id=tx6.id,
        alert_id=alert6.id,
        status=IncidentStatus.closed,
        description=(
            "Transação de R$ 1.500,00 em 'Importados Online' retida por score 60/100. "
            "Associado Carlos Mendes confirmou reconhecer a compra (presente de aniversário). "
            "Investigação encerrada — transação liberada."
        ),
        resolution=(
            "Transação confirmada pelo associado como legítima. "
            "Compra de produto importado como presente. "
            "Destinatário adicionado à lista de conhecidos para futuras análises. "
            "Caso encerrado sem pendências."
        ),
    )
    db.add(incident6)
    db.flush()

    # Complete event history for case 6
    db.add_all([
        IncidentEvent(
            incident_id=incident6.id,
            actor="system",
            event_type="auto_retain",
            description="Transação retida automaticamente. Score 60/100 (médio).",
            created_at=ts6 + timedelta(seconds=3),
        ),
        IncidentEvent(
            incident_id=incident6.id,
            actor="ana.ferreira",
            event_type="alert_reviewed",
            description="Ana Ferreira revisou alerta. Score médio — solicitando confirmação do associado.",
            created_at=ts6 + timedelta(hours=1),
        ),
        IncidentEvent(
            incident_id=incident6.id,
            actor="ana.ferreira",
            event_type="ai_consultation",
            description=(
                "[Guardião IA] Análise da transação: Score 60/100. Padrão divergente do histórico de Carlos "
                "(compra online em SP, categoria nova, valor 6× a média). "
                "Porém, sem indicadores de account takeover — comportamento coerente com compra ocasional. "
                "Recomendação: confirmar com o associado antes de liberar ou bloquear."
            ),
            created_at=ts6 + timedelta(hours=1, minutes=30),
        ),
        IncidentEvent(
            incident_id=incident6.id,
            actor="carlos",
            event_type="associate_response",
            description="Associado confirmou: 'Reconheço a transação. É um presente de aniversário que comprei.'",
            created_at=ts6 + timedelta(hours=3),
        ),
        IncidentEvent(
            incident_id=incident6.id,
            actor="ana.ferreira",
            event_type="resolution",
            description=(
                "Analista Ana Ferreira liberou a transação após confirmação do associado. "
                "Decisão: transação legítima. Encaminhando para liberação do valor. "
                "Destinatário marcado para análise comportamental futura."
            ),
            created_at=ts6 + timedelta(hours=3, minutes=15),
        ),
        IncidentEvent(
            incident_id=incident6.id,
            actor="system",
            event_type="case_closed",
            description="Caso encerrado. Transação liberada. Trilha de auditoria registrada.",
            created_at=ts6 + timedelta(hours=3, minutes=20),
        ),
    ])

    # Chat session for case 6 (AI consultation record)
    chat6 = ChatSession(
        analyst_id=u_ana.id,
        transaction_id=tx6.id,
        incident_id=incident6.id,
        created_at=ts6 + timedelta(hours=1, minutes=28),
    )
    db.add(chat6)
    db.flush()

    db.add_all([
        ChatMessage(
            session_id=chat6.id,
            role=ChatRole.user,
            content=(
                "Guardião, analise esta transação. Carlos Mendes realizou um PIX de R$ 1.500,00 "
                "para 'Importados Online' em São Paulo. Score 60/100. Devo bloquear ou liberar?"
            ),
            created_at=ts6 + timedelta(hours=1, minutes=30),
        ),
        ChatMessage(
            session_id=chat6.id,
            role=ChatRole.assistant,
            content=(
                "Análise da transação de Carlos Mendes (Score: 60/100 — médio):\n\n"
                "**Fatores de risco identificados:**\n"
                "- Valor R$ 1.500,00 representa 6× a média histórica do associado (R$ 250,00)\n"
                "- Destinatário 'Importados Online' não consta no histórico\n"
                "- Categoria 'importados' é nova no perfil de Carlos\n"
                "- Localização São Paulo fora do padrão habitual (Porto Alegre)\n\n"
                "**Análise contextual:**\n"
                "O perfil de Carlos não apresenta indicadores de account takeover — "
                "horário normal (22h), dentro da janela típica. O comportamento é consistente "
                "com uma compra online ocasional, não com fraude ativa.\n\n"
                "**Recomendação:**\n"
                "Solicite confirmação ao associado antes de tomar decisão. "
                "Se Carlos confirmar a compra, libere a transação. "
                "Se negar, bloqueie e inicie investigação formal.\n\n"
                "*Score calculado pelo motor antifraude: 60/100 — imutável.*"
            ),
            created_at=ts6 + timedelta(hours=1, minutes=35),
        ),
        ChatMessage(
            session_id=chat6.id,
            role=ChatRole.user,
            content="Carlos confirmou a transação. Posso liberar agora?",
            created_at=ts6 + timedelta(hours=3, minutes=5),
        ),
        ChatMessage(
            session_id=chat6.id,
            role=ChatRole.assistant,
            content=(
                "Confirmação do associado registrada. Com base na resposta de Carlos e na análise "
                "do motor antifraude, a liberação da transação é tecnicamente suportada.\n\n"
                "**Próximos passos recomendados:**\n"
                "1. Registre a decisão de liberação na ocorrência com justificativa\n"
                "2. Adicione 'Importados Online' ao monitoramento para futuras análises\n"
                "3. Feche o caso com status 'resolvido'\n\n"
                "*Lembro que a decisão final é sempre do analista humano.*"
            ),
            created_at=ts6 + timedelta(hours=3, minutes=8),
        ),
    ])

    db.add(Notification(
        user_id=u_carlos.id,
        alert_id=alert6.id,
        title="Transação liberada",
        message=(
            "Sua transação PIX de R$ 1.500,00 para 'Importados Online' foi liberada após "
            "sua confirmação. O valor será creditado em breve. Obrigado pela colaboração."
        ),
        is_read=True,
    ))

    # Audit trail for case 6
    db.add_all([
        AuditLog(
            actor="system",
            action="transaction_retained",
            entity_type="transaction",
            entity_id=tx6.id,
            from_status="pending_review",
            to_status="pending_review",
            justification="Score: 60/100 (medium) — retenção automática para análise",
            created_at=ts6 + timedelta(seconds=3),
        ),
        AuditLog(
            actor="ana.ferreira",
            action="ai_consultation",
            entity_type="incident",
            entity_id=incident6.id,
            justification="Guardião IA consultado para apoio à decisão",
            created_at=ts6 + timedelta(hours=1, minutes=30),
        ),
        AuditLog(
            actor="carlos",
            action="associate_response",
            entity_type="alert",
            entity_id=alert6.id,
            from_status="pending",
            to_status="confirmed",
            justification="Associado reconheceu transação",
            created_at=ts6 + timedelta(hours=3),
        ),
        AuditLog(
            actor="ana.ferreira",
            action="transaction_released",
            entity_type="transaction",
            entity_id=tx6.id,
            from_status="pending_review",
            to_status="resolved",
            justification="Transação confirmada pelo associado. Análise IA consultada. Caso encerrado.",
            created_at=ts6 + timedelta(hours=3, minutes=15),
        ),
        AuditLog(
            actor="system",
            action="incident_closed",
            entity_type="incident",
            entity_id=incident6.id,
            from_status="investigating",
            to_status="closed",
            justification="Caso encerrado após confirmação do associado e decisão do analista",
            created_at=ts6 + timedelta(hours=3, minutes=20),
        ),
    ])

    db.flush()

    # =======================================================================
    # CASO 7 — Cenário de demonstração obrigatório (IBM AI Lab 2026)
    # Associado com histórico de baixo valor, compra atípica de R$ 5.800
    # Horário incomum, estabelecimento desconhecido, múltiplos indicadores.
    # Este caso é projetado para demonstrar o fluxo completo do Guardião AI.
    # =======================================================================
    # Carlos: avg R$250, max R$800. R$5800 = 23.2× avg, 7.25× max — ambas regras disparam
    ts7 = datetime.now(timezone.utc).replace(hour=3, minute=22, second=0) - timedelta(days=1)
    tx7 = Transaction(
        associate_id=a_carlos.id,
        amount=Decimal("5800.00"),
        merchant="TechStore Premium",
        category="eletrônicos",
        location="Florianópolis",
        mode="credit",
        timestamp=ts7,
        status=TransactionStatus.blocked,
    )
    db.add(tx7)
    db.flush()

    # Score real: R01(25) + R02(20) + R03(15) + R05(10) + R06(10) + R07(20) = 100
    db.add(RiskAnalysis(
        transaction_id=tx7.id,
        risk_score=100,
        risk_level="high",
        risk_factors=json.dumps([
            "high_amount", "unusual_hour", "unknown_merchant",
            "unusual_category", "unusual_location", "velocity_amount",
        ]),
        risk_signals=json.dumps([
            {"rule_id": "R01", "rule_name": "high_amount", "triggered": True, "score_contribution": 25,
             "evidence": "Valor R$ 5800.00 é 23.2× acima da média histórica de R$ 250.00."},
            {"rule_id": "R02", "rule_name": "unusual_hour", "triggered": True, "score_contribution": 20,
             "evidence": "Transação às 03h22 está fora do horário típico (08:00-22:00)."},
            {"rule_id": "R03", "rule_name": "unknown_merchant", "triggered": True, "score_contribution": 15,
             "evidence": "Estabelecimento 'TechStore Premium' não consta no histórico de Carlos."},
            {"rule_id": "R05", "rule_name": "unusual_category", "triggered": True, "score_contribution": 10,
             "evidence": "Categoria 'eletrônicos' não está no perfil habitual de Carlos."},
            {"rule_id": "R06", "rule_name": "unusual_location", "triggered": True, "score_contribution": 10,
             "evidence": "Localização 'Florianópolis' diferente das localidades habituais (Porto Alegre)."},
            {"rule_id": "R07", "rule_name": "velocity_amount", "triggered": True, "score_contribution": 20,
             "evidence": "Valor R$ 5800.00 supera 1.5× o máximo histórico de R$ 800.00."},
        ]),
        explanation=(
            "Score de risco: 100/100 (alto). Transação bloqueada automaticamente. "
            "CASO DE DEMONSTRAÇÃO — IBM AI Experiential Learning Lab 2026. "
            "6 fatores de risco ativos: Carlos Mendes (histórico médio R$250) realizou compra de R$5.800 "
            "em 'TechStore Premium' (estabelecimento desconhecido) em Florianópolis às 03h22. "
            "Valor é 23,2× sua média histórica e 7,25× seu máximo registrado. "
            "Categoria eletrônicos e localização Florianópolis são atípicas para este associado. "
            "Padrão consistente com fraude por clonagem de cartão ou account takeover."
        ),
        provider="engine",
    ))

    alert7 = Alert(
        transaction_id=tx7.id,
        risk_score=100,
        risk_level="high",
        status=AlertStatus.pending,
    )
    db.add(alert7)
    db.flush()

    incident7 = Incident(
        transaction_id=tx7.id,
        alert_id=alert7.id,
        status=IncidentStatus.open,
        description=(
            "DEMO IBM AI LAB — Transação bloqueada automaticamente. Score: 100/100. "
            "Compra de R$ 5.800,00 em 'TechStore Premium' (Florianópolis) às 03h22. "
            "6 indicadores de risco ativos. Aguarda análise do Guardião AI e revisão humana."
        ),
    )
    db.add(incident7)
    db.flush()

    db.add(IncidentEvent(
        incident_id=incident7.id,
        actor="system",
        event_type="auto_block",
        description="Transação bloqueada automaticamente pelo motor antifraude. Score 100/100. DEMO.",
        created_at=ts7 + timedelta(seconds=2),
    ))

    db.add(Notification(
        user_id=u_carlos.id,
        alert_id=alert7.id,
        title="⚠ Transação bloqueada — ação necessária",
        message=(
            "Uma compra de R$ 5.800,00 na 'TechStore Premium' em Florianópolis foi bloqueada "
            "às 03h22. Nosso sistema identificou padrão de risco elevado. "
            "Acesse a Central de Segurança para confirmar ou contestar esta operação."
        ),
        is_read=False,
    ))

    db.add(Notification(
        user_id=u_ana.id,
        alert_id=alert7.id,
        title="🚨 DEMO — Carlos Mendes: compra de R$5.800 bloqueada",
        message=(
            "Caso de demonstração IBM AI Lab. "
            "Carlos Mendes: R$5.800 em TechStore Premium (Florianópolis, 03h22). "
            "Score 100/100 — 6 fatores de risco. Use o Guardião AI para investigar: "
            "'Analise a transação " + str(tx7.id) + " e recomende ações.'"
        ),
        is_read=False,
    ))

    db.add_all([
        AuditLog(
            actor="system",
            action="transaction_blocked",
            entity_type="transaction",
            entity_id=tx7.id,
            from_status="pending_review",
            to_status="blocked",
            justification="Score: 100/100 (high) — bloqueio automático. DEMO IBM AI LAB 2026.",
            created_at=ts7 + timedelta(seconds=2),
        ),
    ])

    db.flush()

    # ------------------------------------------------------------------
    # Initial audit log
    # ------------------------------------------------------------------
    db.add(AuditLog(
        actor="system",
        action="seed_executed",
        entity_type="database",
        justification=(
            "Base de dados inicializada com dados demonstrativos. "
            "7 casos de fraude pré-cadastrados (incluindo Caso 7 DEMO IBM AI Lab). "
            "47 transações históricas. 7 alertas. 4 investigações."
        ),
    ))

    db.commit()
    logger.info("Seed completo: 7 casos de fraude, %d transações históricas.", len(approved_txs))


if __name__ == "__main__":
    import sys
    if "--reset" in sys.argv:
        confirm = input("ATENÇÃO: Isso apagará todos os dados. Digite 'CONFIRMAR' para prosseguir: ")
        if confirm == "CONFIRMAR":
            reset_and_seed()
        else:
            print("Operação cancelada.")
    else:
        safe_seed()
