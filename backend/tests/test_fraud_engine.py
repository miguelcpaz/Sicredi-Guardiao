"""
test_fraud_engine.py — Tests for the V2 fraud rules engine.

NOTE: This is a clean-room reimplementation. The original 43 V1 tests are
not available. These tests cover the 7 rules documented in fraud_engine.py
and validate threshold behavior (score < 30 = low, 30–69 = medium, ≥ 70 = high).
"""
from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.rules.fraud_engine import (
    BehaviorContext, FraudAnalysisResult, FraudRulesEngine, TransactionInput,
)

ENGINE = FraudRulesEngine()


def _make_ctx(**kwargs) -> BehaviorContext:
    defaults = dict(
        avg_transaction_value=Decimal("200.00"),
        max_transaction_value=Decimal("600.00"),
        typical_hours="08:00-22:00",
        typical_categories=["alimentação", "supermercado"],
        known_merchants=["Supermercado Esperança", "Padaria Central"],
        typical_locations=["Porto Alegre"],
        recent_transactions_last_hour=0,
    )
    defaults.update(kwargs)
    return BehaviorContext(**defaults)


def _make_tx(**kwargs) -> TransactionInput:
    defaults = dict(
        amount=Decimal("100.00"),
        merchant="Supermercado Esperança",
        category="alimentação",
        location="Porto Alegre",
        timestamp=datetime(2024, 6, 15, 14, 0, 0, tzinfo=timezone.utc),  # 14h = inside window
        mode="pix",
    )
    defaults.update(kwargs)
    return TransactionInput(**defaults)


# ---------------------------------------------------------------------------
# Thresholds
# ---------------------------------------------------------------------------

class TestThresholds:
    def test_low_risk_score_below_30(self):
        """Known merchant, normal hour, normal amount → low risk."""
        result = ENGINE.analyze(_make_tx(), _make_ctx())
        assert result.risk_level == "low"
        assert result.risk_score < 30

    def test_high_risk_score_at_or_above_70(self):
        """Unknown merchant + unusual hour + high amount → high risk."""
        ctx = _make_ctx(avg_transaction_value=Decimal("200.00"))
        tx = _make_tx(
            amount=Decimal("3000.00"),  # > 3× avg: R01 +25
            merchant="Loja Desconhecida XYZ",  # unknown: R03 +15
            category="jogo",  # unusual: R05 +10
            location="Montevidéu",  # unusual: R06 +10
            timestamp=datetime(2024, 6, 15, 3, 0, 0, tzinfo=timezone.utc),  # 03h: R02 +20
        )
        result = ENGINE.analyze(tx, ctx)
        assert result.risk_score >= 70
        assert result.risk_level == "high"

    def test_medium_risk_score_between_30_and_69(self):
        """Some signals but not enough for high."""
        ctx = _make_ctx()
        tx = _make_tx(
            amount=Decimal("700.00"),   # R01: +25 (3.5× avg)
            merchant="Loja Desconhecida",  # R03: +15
            # total = 40 → medium
        )
        result = ENGINE.analyze(tx, ctx)
        assert 30 <= result.risk_score < 70
        assert result.risk_level == "medium"

    def test_score_capped_at_100(self):
        """All rules triggered simultaneously — score must not exceed 100."""
        ctx = _make_ctx(
            avg_transaction_value=Decimal("100.00"),
            max_transaction_value=Decimal("200.00"),
            recent_transactions_last_hour=5,
        )
        tx = _make_tx(
            amount=Decimal("5000.00"),
            merchant="Loja Desconhecida",
            category="jogo",
            location="Exterior",
            timestamp=datetime(2024, 6, 15, 3, 0, 0, tzinfo=timezone.utc),
        )
        result = ENGINE.analyze(tx, ctx)
        assert result.risk_score <= 100


# ---------------------------------------------------------------------------
# Individual rules
# ---------------------------------------------------------------------------

class TestR01HighAmount:
    def test_triggered_when_amount_exceeds_3x_avg(self):
        ctx = _make_ctx(avg_transaction_value=Decimal("200.00"))
        tx = _make_tx(amount=Decimal("700.00"))  # 3.5× avg
        result = ENGINE.analyze(tx, ctx)
        triggered_ids = [s.rule_id for s in result.triggered_signals]
        assert "R01" in triggered_ids

    def test_not_triggered_at_3x_or_below(self):
        ctx = _make_ctx(avg_transaction_value=Decimal("200.00"))
        tx = _make_tx(amount=Decimal("600.00"))  # exactly 3× — threshold is >3×
        result = ENGINE.analyze(tx, ctx)
        triggered_ids = [s.rule_id for s in result.triggered_signals]
        assert "R01" not in triggered_ids

    def test_not_triggered_when_avg_is_zero(self):
        ctx = _make_ctx(avg_transaction_value=Decimal("0"))
        tx = _make_tx(amount=Decimal("9999.00"))
        result = ENGINE.analyze(tx, ctx)
        triggered_ids = [s.rule_id for s in result.triggered_signals]
        assert "R01" not in triggered_ids


class TestR02UnusualHour:
    def test_triggered_outside_window(self):
        ctx = _make_ctx(typical_hours="08:00-22:00")
        tx = _make_tx(timestamp=datetime(2024, 6, 15, 3, 0, tzinfo=timezone.utc))
        result = ENGINE.analyze(tx, ctx)
        triggered_ids = [s.rule_id for s in result.triggered_signals]
        assert "R02" in triggered_ids

    def test_not_triggered_inside_window(self):
        ctx = _make_ctx(typical_hours="08:00-22:00")
        tx = _make_tx(timestamp=datetime(2024, 6, 15, 14, 0, tzinfo=timezone.utc))
        result = ENGINE.analyze(tx, ctx)
        triggered_ids = [s.rule_id for s in result.triggered_signals]
        assert "R02" not in triggered_ids


class TestR03UnknownMerchant:
    def test_triggered_for_unknown(self):
        ctx = _make_ctx(known_merchants=["Supermercado Esperança"])
        tx = _make_tx(merchant="EletroMax Online")
        result = ENGINE.analyze(tx, ctx)
        triggered_ids = [s.rule_id for s in result.triggered_signals]
        assert "R03" in triggered_ids

    def test_not_triggered_for_known(self):
        ctx = _make_ctx(known_merchants=["Supermercado Esperança"])
        tx = _make_tx(merchant="Supermercado Esperança")
        result = ENGINE.analyze(tx, ctx)
        triggered_ids = [s.rule_id for s in result.triggered_signals]
        assert "R03" not in triggered_ids

    def test_not_triggered_when_no_known_merchants(self):
        ctx = _make_ctx(known_merchants=[])
        tx = _make_tx(merchant="Qualquer Loja")
        result = ENGINE.analyze(tx, ctx)
        triggered_ids = [s.rule_id for s in result.triggered_signals]
        assert "R03" not in triggered_ids


class TestR04HighFrequency:
    def test_triggered_above_3_per_hour(self):
        ctx = _make_ctx(recent_transactions_last_hour=4)
        result = ENGINE.analyze(_make_tx(), ctx)
        triggered_ids = [s.rule_id for s in result.triggered_signals]
        assert "R04" in triggered_ids

    def test_not_triggered_at_3_or_below(self):
        ctx = _make_ctx(recent_transactions_last_hour=3)
        result = ENGINE.analyze(_make_tx(), ctx)
        triggered_ids = [s.rule_id for s in result.triggered_signals]
        assert "R04" not in triggered_ids


class TestR05UnusualCategory:
    def test_triggered_for_unknown_category(self):
        ctx = _make_ctx(typical_categories=["alimentação"])
        tx = _make_tx(category="cassino")
        result = ENGINE.analyze(tx, ctx)
        triggered_ids = [s.rule_id for s in result.triggered_signals]
        assert "R05" in triggered_ids

    def test_not_triggered_for_known_category(self):
        ctx = _make_ctx(typical_categories=["alimentação"])
        tx = _make_tx(category="alimentação")
        result = ENGINE.analyze(tx, ctx)
        triggered_ids = [s.rule_id for s in result.triggered_signals]
        assert "R05" not in triggered_ids


class TestR06UnusualLocation:
    def test_triggered_for_unknown_location(self):
        ctx = _make_ctx(typical_locations=["Porto Alegre"])
        tx = _make_tx(location="Miami")
        result = ENGINE.analyze(tx, ctx)
        triggered_ids = [s.rule_id for s in result.triggered_signals]
        assert "R06" in triggered_ids

    def test_not_triggered_for_known_location(self):
        ctx = _make_ctx(typical_locations=["Porto Alegre"])
        tx = _make_tx(location="Porto Alegre")
        result = ENGINE.analyze(tx, ctx)
        triggered_ids = [s.rule_id for s in result.triggered_signals]
        assert "R06" not in triggered_ids


class TestR07VelocityAmount:
    def test_triggered_above_1_5x_max(self):
        ctx = _make_ctx(max_transaction_value=Decimal("600.00"))
        tx = _make_tx(amount=Decimal("1000.00"))  # > 1.5× 600
        result = ENGINE.analyze(tx, ctx)
        triggered_ids = [s.rule_id for s in result.triggered_signals]
        assert "R07" in triggered_ids

    def test_not_triggered_below_1_5x_max(self):
        ctx = _make_ctx(max_transaction_value=Decimal("600.00"))
        tx = _make_tx(amount=Decimal("800.00"))  # < 1.5× 600 = 900
        result = ENGINE.analyze(tx, ctx)
        triggered_ids = [s.rule_id for s in result.triggered_signals]
        assert "R07" not in triggered_ids


# ---------------------------------------------------------------------------
# Result structure
# ---------------------------------------------------------------------------

class TestResultStructure:
    def test_all_signals_has_7_entries(self):
        result = ENGINE.analyze(_make_tx(), _make_ctx())
        assert len(result.all_signals) == 7

    def test_explanation_non_empty(self):
        result = ENGINE.analyze(_make_tx(), _make_ctx())
        assert len(result.explanation) > 0

    def test_no_triggered_signals_for_clean_transaction(self):
        result = ENGINE.analyze(_make_tx(), _make_ctx())
        assert result.triggered_signals == []

    def test_risk_score_non_negative(self):
        result = ENGINE.analyze(_make_tx(), _make_ctx())
        assert result.risk_score >= 0

    def test_no_context_returns_low_risk(self):
        """Without a behavior profile, defaults kick in and score should be 0."""
        result = ENGINE.analyze(_make_tx())
        assert result.risk_score == 0
        assert result.risk_level == "low"


# ---------------------------------------------------------------------------
# Fraud service — frequency fix validation
# ---------------------------------------------------------------------------

class TestFraudServiceFrequencyFix:
    """Validate that the R04 rule is properly populated from the service layer."""

    def test_frequency_rule_uses_recent_transactions_count(self):
        """R04 triggers correctly when recent_transactions_last_hour > 3."""
        ctx = _make_ctx(recent_transactions_last_hour=5)
        tx = _make_tx()
        result = ENGINE.analyze(tx, ctx)
        triggered_ids = [s.rule_id for s in result.triggered_signals]
        assert "R04" in triggered_ids

    def test_frequency_rule_not_triggered_when_count_is_zero(self):
        """R04 must not trigger when recent_transactions_last_hour=0 (default)."""
        ctx = _make_ctx(recent_transactions_last_hour=0)
        result = ENGINE.analyze(_make_tx(), ctx)
        triggered_ids = [s.rule_id for s in result.triggered_signals]
        assert "R04" not in triggered_ids

    def test_get_behavior_context_without_db_returns_zero_frequency(self, db):
        """_get_behavior_context without db param produces 0 frequency (safe default)."""
        from app.services.fraud_service import _get_behavior_context
        from tests.conftest import _create_user, _create_associate
        from app.models.models import UserRole

        user = _create_user(db, "freq_user", UserRole.associate, "Freq User")
        assoc = _create_associate(db, user)
        profile = db.query(__import__("app.models.models", fromlist=["BehaviorProfile"]).BehaviorProfile).filter_by(
            associate_id=assoc.id
        ).first()
        assert profile is not None

        ctx = _get_behavior_context(profile)  # no db/associate_id/timestamp
        assert ctx.recent_transactions_last_hour == 0
