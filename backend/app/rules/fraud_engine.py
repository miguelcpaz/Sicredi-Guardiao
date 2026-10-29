"""
Sicredi Guardião V2 — Fraud Rules Engine
=========================================

IMPORTANT: This is a clean-room reimplementation for V2.
The original V1 fraud engine is not available in this workspace.
Rules below are documented and testable, and align with the V1 functional
description (7 risk signals, scores 0–100, thresholds at 30 and 70).

Rule design:
- Each rule returns a RuleSignal with a score contribution and text evidence.
- The engine sums contributions (capped at 100) to produce the final risk_score.
- risk_level: "low" (< 30) | "medium" (30–69) | "high" (≥ 70)
- Rules are independent; order does not affect outcome.

Rules implemented (V2):
  R01 - high_amount:         Value > 3× associate's average transaction
  R02 - unusual_hour:        Transaction outside 06:00–22:00 local time
  R03 - unknown_merchant:    Merchant not in associate's known merchants list
  R04 - high_frequency:      > 3 transactions in the last hour (requires history)
  R05 - unusual_category:    Category not in associate's typical categories
  R06 - unusual_location:    Location differs from associate's typical locations
  R07 - velocity_amount:     Amount > associate's historical maximum × 1.5
"""
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Optional


# ---------------------------------------------------------------------------
# Data contracts (plain dataclasses — no ORM dependency)
# ---------------------------------------------------------------------------

@dataclass
class BehaviorContext:
    """Snapshot of the associate's behavioral profile used by the engine."""
    avg_transaction_value: Decimal = Decimal("0.00")
    max_transaction_value: Decimal = Decimal("0.00")
    typical_hours: str = "06:00-22:00"        # "HH:MM-HH:MM"
    typical_categories: list[str] = field(default_factory=list)
    known_merchants: list[str] = field(default_factory=list)
    typical_locations: list[str] = field(default_factory=list)
    recent_transactions_last_hour: int = 0    # count for velocity check


@dataclass
class TransactionInput:
    """Transaction data passed to the engine for analysis."""
    amount: Decimal
    merchant: str
    category: str
    location: str
    timestamp: datetime
    mode: str = "pix"
    device_id: str = ""


@dataclass
class RuleSignal:
    """Result produced by a single rule."""
    rule_id: str
    rule_name: str
    triggered: bool
    score_contribution: int   # 0 if not triggered
    evidence: str             # human-readable explanation


@dataclass
class FraudAnalysisResult:
    """Aggregated result from the full engine run."""
    risk_score: int                          # 0–100 (capped)
    risk_level: str                          # "low" | "medium" | "high"
    triggered_signals: list[RuleSignal]
    all_signals: list[RuleSignal]            # includes non-triggered for audit
    explanation: str                         # plain-language summary


# ---------------------------------------------------------------------------
# Individual rule functions
# ---------------------------------------------------------------------------

def _rule_high_amount(tx: TransactionInput, ctx: BehaviorContext) -> RuleSignal:
    """R01 — Amount > 3× associate's average transaction value."""
    rid, name = "R01", "high_amount"
    avg = ctx.avg_transaction_value
    if avg > Decimal("0") and tx.amount > avg * Decimal("3"):
        ratio = float(tx.amount / avg)
        return RuleSignal(
            rule_id=rid, rule_name=name, triggered=True,
            score_contribution=25,
            evidence=f"Valor R$ {tx.amount:.2f} é {ratio:.1f}× acima da média histórica de R$ {avg:.2f}.",
        )
    return RuleSignal(rule_id=rid, rule_name=name, triggered=False, score_contribution=0,
                      evidence="Valor dentro do padrão histórico.")


def _rule_unusual_hour(tx: TransactionInput, ctx: BehaviorContext) -> RuleSignal:
    """R02 — Transaction hour outside the associate's typical window."""
    rid, name = "R02", "unusual_hour"
    hour = tx.timestamp.hour
    try:
        start_str, end_str = ctx.typical_hours.split("-")
        start_h = int(start_str.split(":")[0])
        end_h = int(end_str.split(":")[0])
    except (ValueError, IndexError):
        start_h, end_h = 6, 22

    outside = hour < start_h or hour >= end_h
    if outside:
        return RuleSignal(
            rule_id=rid, rule_name=name, triggered=True,
            score_contribution=20,
            evidence=f"Transação às {hour:02d}h está fora do horário típico ({ctx.typical_hours}).",
        )
    return RuleSignal(rule_id=rid, rule_name=name, triggered=False, score_contribution=0,
                      evidence=f"Horário {hour:02d}h dentro da janela típica ({ctx.typical_hours}).")


def _rule_unknown_merchant(tx: TransactionInput, ctx: BehaviorContext) -> RuleSignal:
    """R03 — Merchant not present in associate's known merchants."""
    rid, name = "R03", "unknown_merchant"
    known = [m.lower().strip() for m in ctx.known_merchants]
    if known and tx.merchant.lower().strip() not in known:
        return RuleSignal(
            rule_id=rid, rule_name=name, triggered=True,
            score_contribution=15,
            evidence=f"Estabelecimento '{tx.merchant}' não consta no histórico do associado.",
        )
    return RuleSignal(rule_id=rid, rule_name=name, triggered=False, score_contribution=0,
                      evidence=f"Estabelecimento '{tx.merchant}' é conhecido.")


def _rule_high_frequency(tx: TransactionInput, ctx: BehaviorContext) -> RuleSignal:
    """R04 — More than 3 transactions in the last hour (velocity check)."""
    rid, name = "R04", "high_frequency"
    if ctx.recent_transactions_last_hour > 3:
        return RuleSignal(
            rule_id=rid, rule_name=name, triggered=True,
            score_contribution=20,
            evidence=f"{ctx.recent_transactions_last_hour} transações na última hora — padrão incomum.",
        )
    return RuleSignal(rule_id=rid, rule_name=name, triggered=False, score_contribution=0,
                      evidence="Frequência de transações dentro do normal.")


def _rule_unusual_category(tx: TransactionInput, ctx: BehaviorContext) -> RuleSignal:
    """R05 — Category not in associate's typical spending categories."""
    rid, name = "R05", "unusual_category"
    cats = [c.lower().strip() for c in ctx.typical_categories]
    if cats and tx.category.lower().strip() not in cats:
        return RuleSignal(
            rule_id=rid, rule_name=name, triggered=True,
            score_contribution=10,
            evidence=f"Categoria '{tx.category}' não está no perfil habitual do associado.",
        )
    return RuleSignal(rule_id=rid, rule_name=name, triggered=False, score_contribution=0,
                      evidence=f"Categoria '{tx.category}' compatível com o perfil.")


def _rule_unusual_location(tx: TransactionInput, ctx: BehaviorContext) -> RuleSignal:
    """R06 — Location not in associate's typical locations."""
    rid, name = "R06", "unusual_location"
    locs = [l.lower().strip() for l in ctx.typical_locations]
    if locs and tx.location and tx.location.lower().strip() not in locs:
        return RuleSignal(
            rule_id=rid, rule_name=name, triggered=True,
            score_contribution=10,
            evidence=f"Localização '{tx.location}' diferente das localidades habituais.",
        )
    return RuleSignal(rule_id=rid, rule_name=name, triggered=False, score_contribution=0,
                      evidence="Localização compatível com o perfil.")


def _rule_velocity_amount(tx: TransactionInput, ctx: BehaviorContext) -> RuleSignal:
    """R07 — Amount exceeds 1.5× the associate's historical maximum."""
    rid, name = "R07", "velocity_amount"
    max_val = ctx.max_transaction_value
    if max_val > Decimal("0") and tx.amount > max_val * Decimal("1.5"):
        return RuleSignal(
            rule_id=rid, rule_name=name, triggered=True,
            score_contribution=20,
            evidence=f"Valor R$ {tx.amount:.2f} supera 1.5× o máximo histórico de R$ {max_val:.2f}.",
        )
    return RuleSignal(rule_id=rid, rule_name=name, triggered=False, score_contribution=0,
                      evidence="Valor dentro do limite histórico máximo.")


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

_ALL_RULES = [
    _rule_high_amount,
    _rule_unusual_hour,
    _rule_unknown_merchant,
    _rule_high_frequency,
    _rule_unusual_category,
    _rule_unusual_location,
    _rule_velocity_amount,
]


def _risk_level(score: int) -> str:
    if score >= 70:
        return "high"
    if score >= 30:
        return "medium"
    return "low"


def _build_explanation(score: int, level: str, triggered: list[RuleSignal]) -> str:
    if not triggered:
        return "Nenhum fator de risco identificado. Transação dentro do padrão comportamental."
    names = ", ".join(s.rule_name.replace("_", " ") for s in triggered)
    return (
        f"Score de risco: {score}/100 ({level}). "
        f"Fatores ativos: {names}. "
        f"Evidências: " + " | ".join(s.evidence for s in triggered)
    )


class FraudRulesEngine:
    """
    Stateless fraud analysis engine.
    Call `analyze(transaction, behavior_context)` to obtain a FraudAnalysisResult.
    """

    def analyze(
        self,
        transaction: TransactionInput,
        behavior_context: Optional[BehaviorContext] = None,
    ) -> FraudAnalysisResult:
        ctx = behavior_context or BehaviorContext()
        all_signals: list[RuleSignal] = []
        triggered: list[RuleSignal] = []
        total_score = 0

        for rule_fn in _ALL_RULES:
            signal = rule_fn(transaction, ctx)
            all_signals.append(signal)
            if signal.triggered:
                triggered.append(signal)
                total_score += signal.score_contribution

        final_score = min(total_score, 100)
        level = _risk_level(final_score)
        explanation = _build_explanation(final_score, level, triggered)

        return FraudAnalysisResult(
            risk_score=final_score,
            risk_level=level,
            triggered_signals=triggered,
            all_signals=all_signals,
            explanation=explanation,
        )
