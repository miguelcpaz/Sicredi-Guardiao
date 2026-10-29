"""
Tests for authorization — wallet isolation and role enforcement.
"""
import pytest
from tests.conftest import _create_user, _create_associate, get_token
from app.models.models import UserRole, ManagerWallet


def _create_analyst_with_associate(db, analyst_username, associate_username):
    """Helper: create analyst + associate + wallet link."""
    analyst = _create_user(db, analyst_username, UserRole.analyst)
    db.commit()
    assoc_user = _create_user(db, associate_username, UserRole.associate)
    assoc = _create_associate(db, assoc_user)
    db.add(ManagerWallet(analyst_id=analyst.id, associate_id=assoc.id))
    db.commit()
    return analyst, assoc_user, assoc


class TestWalletIsolation:
    def test_analyst_cannot_see_other_wallet_associate(self, client, db):
        """Ana cannot access Roberto's associates."""
        ana, assoc1_user, assoc1 = _create_analyst_with_associate(db, "ana_iso", "assoc1_iso")
        roberto, assoc2_user, assoc2 = _create_analyst_with_associate(db, "roberto_iso", "assoc2_iso")

        token = get_token(client, "ana_iso")
        # Ana tries to access assoc2 (belongs to Roberto)
        resp = client.get(
            f"/api/v1/wallet/associates/{assoc2.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_analyst_can_see_own_wallet_associate(self, client, db):
        """Ana can access her own associates."""
        ana, assoc_user, assoc = _create_analyst_with_associate(db, "ana_own", "assoc_own")
        token = get_token(client, "ana_own")
        resp = client.get(
            f"/api/v1/wallet/associates/{assoc.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == assoc.id

    def test_associate_cannot_access_wallet_endpoint(self, client, associate_user):
        """Associates cannot access the wallet management endpoints."""
        token = get_token(client, "carlos_test")
        resp = client.get(
            "/api/v1/wallet/associates",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_analyst_alert_wallet_isolation(self, client, db):
        """Ana cannot see alerts from Roberto's wallet."""
        from decimal import Decimal
        from app.models.models import Transaction, TransactionStatus, Alert, AlertStatus
        from datetime import datetime, timezone

        ana, assoc1_user, assoc1 = _create_analyst_with_associate(db, "ana_alert", "assoc_alert1")
        roberto, assoc2_user, assoc2 = _create_analyst_with_associate(db, "roberto_alert", "assoc_alert2")

        # Create alert for assoc2 (Roberto's)
        tx = Transaction(
            associate_id=assoc2.id,
            amount=Decimal("5000.00"),
            merchant="Test",
            category="pix",
            location="",
            mode="pix",
            device_id="",
            timestamp=datetime.now(timezone.utc),
            status=TransactionStatus.blocked,
        )
        db.add(tx)
        db.flush()
        alert = Alert(
            transaction_id=tx.id,
            risk_score=85,
            risk_level="high",
            status=AlertStatus.pending,
        )
        db.add(alert)
        db.commit()

        token = get_token(client, "ana_alert")
        resp = client.get(
            f"/api/v1/analyst/alerts/{alert.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_associate_cannot_see_other_transactions(self, client, db, associate_user):
        """Associate cannot access another associate's transactions."""
        from decimal import Decimal
        from app.models.models import Transaction, TransactionStatus
        from datetime import datetime, timezone

        # Create a second associate
        user2 = _create_user(db, "other_assoc", UserRole.associate)
        assoc2 = _create_associate(db, user2)
        tx = Transaction(
            associate_id=assoc2.id,
            amount=Decimal("100.00"),
            merchant="Test",
            category="pix",
            location="",
            mode="pix",
            device_id="",
            timestamp=datetime.now(timezone.utc),
            status=TransactionStatus.approved,
        )
        db.add(tx)
        db.commit()

        token = get_token(client, "carlos_test")
        resp = client.get(
            f"/api/v1/transactions/{tx.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_unauthenticated_request_rejected(self, client):
        """All endpoints require authentication."""
        resp = client.get("/api/v1/wallet/associates")
        assert resp.status_code in (401, 403)  # HTTPBearer returns 401 for missing token


class TestNotificationPermissions:
    def test_associate_can_only_see_own_notifications(self, client, db, associate_user):
        """Associates cannot see other users' notifications."""
        from app.models.models import Notification
        user2 = _create_user(db, "notif_user2", UserRole.associate)
        assoc2 = _create_associate(db, user2)
        notif = Notification(
            user_id=user2.id,
            title="Test",
            message="For user2",
        )
        db.add(notif)
        db.commit()

        token = get_token(client, "carlos_test")
        resp = client.get(
            "/api/v1/notifications",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        # carlos should not see user2's notification
        notification_ids = [n["id"] for n in resp.json()]
        assert notif.id not in notification_ids

    def test_cannot_mark_other_users_notification_read(self, client, db, associate_user):
        """Cannot mark another user's notification as read."""
        from app.models.models import Notification
        user2 = _create_user(db, "notif_mark_user2", UserRole.associate)
        assoc2 = _create_associate(db, user2)
        notif = Notification(
            user_id=user2.id,
            title="Test",
            message="For user2",
        )
        db.add(notif)
        db.commit()

        token = get_token(client, "carlos_test")
        resp = client.patch(
            f"/api/v1/notifications/{notif.id}/read",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_duplicate_alert_response_rejected(self, client, db, associate_user):
        """Associate cannot respond to same alert twice."""
        from decimal import Decimal
        from datetime import datetime, timezone
        from app.models.models import (
            Alert, AlertStatus, AlertResponse, Notification,
            Transaction, TransactionStatus,
        )
        user, assoc = associate_user

        tx = Transaction(
            associate_id=assoc.id,
            amount=Decimal("500.00"),
            merchant="Test",
            category="pix",
            location="",
            mode="pix",
            device_id="",
            timestamp=datetime.now(timezone.utc),
            status=TransactionStatus.blocked,
        )
        db.add(tx)
        db.flush()
        alert = Alert(
            transaction_id=tx.id,
            risk_score=75,
            risk_level="high",
            status=AlertStatus.pending,
        )
        db.add(alert)
        db.flush()
        notif = Notification(
            user_id=user.id,
            alert_id=alert.id,
            title="Confirme",
            message="Confirme a operação",
        )
        db.add(notif)
        db.commit()

        token = get_token(client, "carlos_test")
        # First response
        resp1 = client.post(
            f"/api/v1/notifications/{notif.id}/respond",
            json={"response": "recognized"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp1.status_code == 200

        # Second response (duplicate) must be rejected
        resp2 = client.post(
            f"/api/v1/notifications/{notif.id}/respond",
            json={"response": "unrecognized"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp2.status_code == 409
