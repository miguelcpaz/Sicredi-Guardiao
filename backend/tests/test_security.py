"""
test_security.py — Tests for bcrypt password hashing and JWT token handling.

Verifies:
  - get_password_hash produces a bcrypt hash ($2b$ prefix)
  - verify_password succeeds with correct password
  - verify_password rejects wrong password
  - Different calls with same input produce different hashes (salting)
  - JWT encode/decode round-trip
  - decode_access_token returns None for tampered tokens
"""
import pytest
from app.core.security import (
    create_access_token, decode_access_token, get_password_hash, verify_password,
)


class TestBcrypt:
    def test_hash_produces_bcrypt_format(self):
        hashed = get_password_hash("sicredi123")
        assert hashed.startswith("$2b$"), f"Expected bcrypt hash, got: {hashed[:10]}"

    def test_hash_length_fits_in_string_200(self):
        hashed = get_password_hash("sicredi123")
        assert len(hashed) <= 200

    def test_verify_correct_password(self):
        hashed = get_password_hash("sicredi123")
        assert verify_password("sicredi123", hashed) is True

    def test_verify_wrong_password(self):
        hashed = get_password_hash("sicredi123")
        assert verify_password("wrong_password", hashed) is False

    def test_verify_empty_password(self):
        hashed = get_password_hash("sicredi123")
        assert verify_password("", hashed) is False

    def test_hashes_are_salted(self):
        """Two calls with the same input must produce different hashes."""
        h1 = get_password_hash("sicredi123")
        h2 = get_password_hash("sicredi123")
        assert h1 != h2, "bcrypt should produce different salts each call"

    def test_sha256_hash_rejected(self):
        """A raw SHA-256 hex string must not verify against bcrypt.
        passlib raises UnknownHashError for non-bcrypt hashes, which
        our verify_password does not suppress — this is the correct behavior.
        """
        import hashlib
        from passlib.exc import UnknownHashError
        sha_hash = hashlib.sha256("sicredi123".encode()).hexdigest()
        # passlib correctly refuses to verify a SHA-256 hex string as bcrypt
        try:
            result = verify_password("sicredi123", sha_hash)
            # If no exception: must be False
            assert result is False
        except UnknownHashError:
            pass  # expected — passlib rejects unknown hash formats


class TestJWT:
    def test_token_encode_decode_roundtrip(self):
        payload = {"sub": "carlos", "role": "associate"}
        token = create_access_token(data=payload)
        decoded = decode_access_token(token)
        assert decoded is not None
        assert decoded["sub"] == "carlos"
        assert decoded["role"] == "associate"

    def test_tampered_token_returns_none(self):
        token = create_access_token(data={"sub": "carlos"})
        tampered = token[:-5] + "XXXXX"
        assert decode_access_token(tampered) is None

    def test_random_string_returns_none(self):
        assert decode_access_token("not.a.jwt.token") is None

    def test_empty_string_returns_none(self):
        assert decode_access_token("") is None
