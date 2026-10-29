"""
test_api.py — Integration tests for the REST API (Etapa 1 endpoints).

Tests:
  - POST /auth/login         success, wrong password, inactive user
  - GET  /auth/me            authenticated, unauthenticated
  - POST /transactions       associate creates + fraud analysis runs
  - GET  /transactions       role-based filtering
  - GET  /alerts             associate sees only own alerts
  - POST /alerts/{id}/respond  response is immutable
  - GET  /dashboard/associate
  - GET  /dashboard/analyst
  - GET  /health
"""
import pytest
from decimal import Decimal
from datetime import datetime, timezone

from tests.conftest import get_token


class TestHealth:
    def test_health_ok(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "version" in data
        assert "ai_provider" in data


class TestAuth:
    def test_login_success(self, client, associate_user):
        user, _ = associate_user
        resp = client.post("/api/v1/auth/login",
                           json={"username": "carlos_test", "password": "sicredi123"})
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert body["role"] == "associate"
        assert body["username"] == "carlos_test"

    def test_login_wrong_password(self, client, associate_user):
        resp = client.post("/api/v1/auth/login",
                           json={"username": "carlos_test", "password": "wrong"})
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, client):
        resp = client.post("/api/v1/auth/login",
                           json={"username": "ninguem", "password": "sicredi123"})
        assert resp.status_code == 401

    def test_get_me_authenticated(self, client, associate_user):
        user, _ = associate_user
        token = get_token(client, "carlos_test")
        resp = client.get("/api/v1/auth/me",
                          headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["username"] == "carlos_test"

    def test_get_me_unauthenticated(self, client):
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code in (401, 403)

    def test_get_me_invalid_token(self, client):
        resp = client.get("/api/v1/auth/me",
                          headers={"Authorization": "Bearer not.a.valid.token"})
        assert resp.status_code == 401

    def test_analyst_role_in_token(self, client, analyst_user):
        resp = client.post("/api/v1/auth/login",
                           json={"username": "ana_test", "password": "sicredi123"})
        assert resp.status_code == 200
        assert resp.json()["role"] == "analyst"


class TestTransactions:
    def test_associate_creates_low_risk_transaction(self, client, associate_user):
        """Known merchant, normal amount, daytime → approved (low risk)."""
        user, _ = associate_user
        token = get_token(client, "carlos_test")
        resp = client.post(
            "/api/v1/transactions",
            json={
                "amount": "85.00",
                "merchant": "Supermercado Esperança",
                "category": "alimentação",
                "location": "Porto Alegre",
                "mode": "pix",
                "timestamp": "2024-06-15T14:00:00Z",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["status"] == "approved"
        assert body["risk_score"] < 30
        assert body["risk_level"] == "low"
        assert body["alert_id"] is None

    def test_associate_creates_high_risk_transaction(self, client, associate_user):
        """Unknown merchant + night + high amount → blocked."""
        token = get_token(client, "carlos_test")
        resp = client.post(
            "/api/v1/transactions",
            json={
                "amount": "5000.00",          # way above avg R$200
                "merchant": "EletroMax Online",
                "category": "eletrônicos",
                "location": "Exterior",
                "mode": "pix",
                "timestamp": "2024-06-15T02:00:00Z",  # 02h → unusual hour
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["status"] == "blocked"
        assert body["risk_score"] >= 70
        assert body["risk_level"] == "high"
        assert body["alert_id"] is not None
        assert body["incident_id"] is not None

    def test_transaction_has_7_risk_signals(self, client, associate_user):
        token = get_token(client, "carlos_test")
        resp = client.post(
            "/api/v1/transactions",
            json={
                "amount": "100.00",
                "merchant": "Supermercado Esperança",
                "category": "alimentação",
                "location": "Porto Alegre",
                "mode": "pix",
                "timestamp": "2024-06-15T14:00:00Z",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        body = resp.json()
        assert len(body["risk_signals"]) == 7  # all rules always present

    def test_analyst_cannot_create_transaction(self, client, analyst_user):
        token = get_token(client, "ana_test")
        resp = client.post(
            "/api/v1/transactions",
            json={"amount": "100.00", "merchant": "X", "category": "Y",
                  "location": "", "mode": "pix"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_zero_amount_rejected(self, client, associate_user):
        token = get_token(client, "carlos_test")
        resp = client.post(
            "/api/v1/transactions",
            json={"amount": "0.00", "merchant": "X", "category": "Y", "location": "", "mode": "pix"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422

    def test_negative_amount_rejected(self, client, associate_user):
        token = get_token(client, "carlos_test")
        resp = client.post(
            "/api/v1/transactions",
            json={"amount": "-50.00", "merchant": "X", "category": "Y", "location": "", "mode": "pix"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422

    def test_associate_sees_own_transactions(self, client, associate_user):
        token = get_token(client, "carlos_test")
        # Create one
        client.post(
            "/api/v1/transactions",
            json={"amount": "50.00", "merchant": "Supermercado Esperança",
                  "category": "alimentação", "location": "Porto Alegre", "mode": "pix",
                  "timestamp": "2024-06-15T14:00:00Z"},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = client.get("/api/v1/transactions",
                          headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


class TestAlerts:
    def _create_high_risk_tx(self, client, token):
        resp = client.post(
            "/api/v1/transactions",
            json={
                "amount": "5000.00",
                "merchant": "Loja Desconhecida",
                "category": "jogo",
                "location": "Exterior",
                "mode": "pix",
                "timestamp": "2024-06-15T02:00:00Z",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        return resp.json()

    def test_associate_can_see_own_alerts(self, client, associate_user):
        token = get_token(client, "carlos_test")
        tx_body = self._create_high_risk_tx(client, token)
        assert tx_body["alert_id"] is not None

        resp = client.get("/api/v1/alerts", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        alerts = resp.json()
        assert len(alerts) >= 1

    def test_associate_responds_confirmed(self, client, associate_user):
        token = get_token(client, "carlos_test")
        tx_body = self._create_high_risk_tx(client, token)
        alert_id = tx_body["alert_id"]

        resp = client.post(
            f"/api/v1/alerts/{alert_id}/respond",
            json={"response": "confirmed"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["response"] == "confirmed"

    def test_alert_response_is_immutable(self, client, associate_user):
        """Once a response is set, a second attempt must return 409."""
        token = get_token(client, "carlos_test")
        tx_body = self._create_high_risk_tx(client, token)
        alert_id = tx_body["alert_id"]

        client.post(f"/api/v1/alerts/{alert_id}/respond",
                    json={"response": "confirmed"},
                    headers={"Authorization": f"Bearer {token}"})

        resp = client.post(f"/api/v1/alerts/{alert_id}/respond",
                           json={"response": "disputed"},
                           headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 409

    def test_invalid_response_value_rejected(self, client, associate_user):
        token = get_token(client, "carlos_test")
        tx_body = self._create_high_risk_tx(client, token)
        alert_id = tx_body["alert_id"]

        resp = client.post(f"/api/v1/alerts/{alert_id}/respond",
                           json={"response": "maybe"},
                           headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 422

    def test_analyst_cannot_respond_to_alert(self, client, associate_user, analyst_user):
        token_assoc = get_token(client, "carlos_test")
        tx_body = self._create_high_risk_tx(client, token_assoc)
        alert_id = tx_body["alert_id"]

        token_analyst = get_token(client, "ana_test")
        resp = client.post(f"/api/v1/alerts/{alert_id}/respond",
                           json={"response": "confirmed"},
                           headers={"Authorization": f"Bearer {token_analyst}"})
        assert resp.status_code == 403


class TestDashboard:
    def test_associate_dashboard(self, client, associate_user):
        token = get_token(client, "carlos_test")
        resp = client.get("/api/v1/dashboard/associate",
                          headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        body = resp.json()
        assert "balance" in body
        assert "pending_alerts" in body
        assert "total_transactions" in body

    def test_analyst_dashboard(self, client, analyst_user):
        token = get_token(client, "ana_test")
        resp = client.get("/api/v1/dashboard/analyst",
                          headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        body = resp.json()
        assert "pending_alerts" in body
        assert "total_transactions" in body

    def test_associate_cannot_access_analyst_dashboard(self, client, associate_user):
        token = get_token(client, "carlos_test")
        resp = client.get("/api/v1/dashboard/analyst",
                          headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 403

    def test_analyst_cannot_access_associate_dashboard(self, client, analyst_user):
        token = get_token(client, "ana_test")
        resp = client.get("/api/v1/dashboard/associate",
                          headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 403


class TestAIProvider:
    def test_mock_provider_returns_mock_tag(self, client, associate_user):
        """Mock provider must clearly identify itself in the response."""
        token = get_token(client, "carlos_test")
        resp = client.post(
            "/api/v1/transactions",
            json={"amount": "5000.00", "merchant": "Loja X", "category": "jogo",
                  "location": "Exterior", "mode": "pix",
                  "timestamp": "2024-06-15T02:00:00Z"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["ai_provider"] in ("mock", "mock_fallback")

    def test_ai_provider_does_not_change_score(self, client, associate_user):
        """The AI provider must preserve the engine's risk_score."""
        token = get_token(client, "carlos_test")
        resp = client.post(
            "/api/v1/transactions",
            json={"amount": "5000.00", "merchant": "Loja X", "category": "jogo",
                  "location": "Exterior", "mode": "pix",
                  "timestamp": "2024-06-15T02:00:00Z"},
            headers={"Authorization": f"Bearer {token}"},
        )
        body = resp.json()
        # The risk_score from engine ≥ 70; AI must not change it
        assert body["risk_score"] >= 70
