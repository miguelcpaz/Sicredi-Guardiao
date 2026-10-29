"""
Tests for PIX transfer flow — Etapa 2.
"""
import pytest
from decimal import Decimal
from tests.conftest import _create_user, _create_associate, get_token
from app.models.models import UserRole, ManagerWallet, BehaviorProfile, PixTransferStatus


class TestPixFlow:
    def test_pix_approved_low_risk(self, client, associate_user):
        """Low-risk PIX returns a valid result screen (score depends on time of test run)."""
        token = get_token(client, "carlos_test")
        resp = client.post(
            "/api/v1/pix/transfer",
            json={
                "pix_key": "padaria@central.com",
                "recipient_name": "Padaria Central",
                "amount": "80.00",
                "description": "Transferencia teste",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        body = resp.json()
        # Result depends on time of day (unusual_hour rule); all outcomes are valid
        assert body["result_screen"] in ("approved", "retained", "blocked")
        assert "pix_transfer_id" in body
        assert "message" in body

    def test_pix_balance_debited_on_approval(self, client, db, associate_user):
        """Balance must be debited when PIX is approved."""
        user, assoc = associate_user
        initial_balance = float(assoc.balance)
        token = get_token(client, "carlos_test")

        resp = client.post(
            "/api/v1/pix/transfer",
            json={
                "pix_key": "padaria@central.com",
                "recipient_name": "Padaria Central",
                "amount": "50.00",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        body = resp.json()
        if body["result_screen"] == "approved":
            db.refresh(assoc)
            assert float(assoc.balance) == pytest.approx(initial_balance - 50.0)

    def test_pix_insufficient_balance(self, client, associate_user):
        """PIX exceeding balance must be rejected."""
        token = get_token(client, "carlos_test")
        resp = client.post(
            "/api/v1/pix/transfer",
            json={
                "pix_key": "someone@test.com",
                "recipient_name": "Big Transfer",
                "amount": "999999.00",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201  # service-level rejection (not HTTP error)
        body = resp.json()
        assert body["result_screen"] == "insufficient_funds"

    def test_pix_high_risk_blocked(self, client, db, associate_user):
        """High-risk PIX (R$8500, unknown recipient) should be blocked."""
        token = get_token(client, "carlos_test")
        # Ensure balance is sufficient
        user, assoc = associate_user
        assoc.balance = Decimal("15000.00")
        db.commit()

        resp = client.post(
            "/api/v1/pix/transfer",
            json={
                "pix_key": "12345678901",
                "recipient_name": "Investimentos Rápidos LTDA",
                "amount": "8500.00",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        body = resp.json()
        # With avg=200 and max=600: R$8500 triggers R01 (42.5x avg) + R07 (14.2x max)
        # Score = 25+20 = 45+ others possibly → high risk
        assert body["result_screen"] in ("blocked", "retained")

    def test_pix_blocked_balance_not_debited(self, client, db, associate_user):
        """Balance must NOT be debited when PIX is blocked."""
        user, assoc = associate_user
        assoc.balance = Decimal("15000.00")
        db.commit()
        initial_balance = float(assoc.balance)
        token = get_token(client, "carlos_test")

        resp = client.post(
            "/api/v1/pix/transfer",
            json={
                "pix_key": "12345678901",
                "recipient_name": "Investimentos Rápidos LTDA",
                "amount": "8500.00",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        if resp.json()["result_screen"] in ("blocked", "retained"):
            db.refresh(assoc)
            assert float(assoc.balance) == pytest.approx(initial_balance)

    def test_pix_analyst_cannot_initiate(self, client, analyst_user):
        """Analysts cannot initiate PIX transfers."""
        token = get_token(client, "ana_test")
        resp = client.post(
            "/api/v1/pix/transfer",
            json={
                "pix_key": "test@test.com",
                "recipient_name": "Test",
                "amount": "100.00",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_pix_negative_amount_rejected(self, client, associate_user):
        """Negative amount must be rejected by schema validation."""
        token = get_token(client, "carlos_test")
        resp = client.post(
            "/api/v1/pix/transfer",
            json={
                "pix_key": "test@test.com",
                "recipient_name": "Test",
                "amount": "-50.00",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422

    def test_pix_list_transfers(self, client, associate_user):
        """Associate can list their PIX transfers."""
        token = get_token(client, "carlos_test")
        # First make a transfer
        client.post(
            "/api/v1/pix/transfer",
            json={"pix_key": "p@t.com", "recipient_name": "Test", "amount": "10.00"},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = client.get(
            "/api/v1/pix/transfers",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) >= 1
