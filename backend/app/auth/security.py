"""Password hashing and JWT helpers for BSI authentication.

Uses PBKDF2 (stdlib ``hashlib``) for passwords and PyJWT for access tokens.
No bcrypt/argon2 binary wheels are required, keeping the Render build light.
"""

from __future__ import annotations

import binascii
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

_PBKDF2_ITERATIONS = 260_000
_TOKEN_TTL_DAYS = int(os.environ.get("BSI_TOKEN_TTL_DAYS", "7"))


def get_jwt_secret() -> str:
    """JWT signing secret from env, with a dev-only fallback."""
    secret = os.environ.get("BSI_JWT_SECRET")
    if secret:
        return secret
    # Dev fallback only; production must set BSI_JWT_SECRET.
    return "bsi-dev-insecure-secret-change-me"


def hash_password(password: str) -> str:
    """Return a PBKDF2-HMAC-SHA256 hash string: ``pbkdf2$it$salt$hash``."""
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS
    )
    return (
        f"pbkdf2_sha256${_PBKDF2_ITERATIONS}$"
        f"{binascii.hexlify(salt).decode()}${binascii.hexlify(digest).decode()}"
    )


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iters_s, salt_hex, hash_hex = stored.split("$")
        salt = binascii.unhexlify(salt_hex)
        expected = binascii.unhexlify(hash_hex)
    except (ValueError, binascii.Error):
        return False
    if algo != "pbkdf2_sha256":
        return False
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, int(iters_s)
    )
    return hmac.compare_digest(digest, expected)


def create_token(user_id: str, email: str) -> str:
    import jwt

    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + timedelta(days=_TOKEN_TTL_DAYS),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm="HS256")


def decode_token(token: str) -> dict:
    import jwt

    return jwt.decode(token, get_jwt_secret(), algorithms=["HS256"])
