"""FastAPI dependencies for authentication."""

from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.security import decode_token

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict[str, Any]:
    """Resolve the authenticated user from the Bearer token.

    Returns a dict with ``id`` and ``email``. The store is read from
    ``request.app.state.store`` so both SQLite and Postgres backends work
    without extra wiring.
    """
    if creds is None:
        raise HTTPException(401, "Not authenticated.")
    try:
        payload = decode_token(creds.credentials)
        user_id = payload.get("sub")
    except Exception:  # noqa: BLE001 - any JWT failure is an auth failure
        raise HTTPException(401, "Invalid or expired token.") from None
    if not user_id:
        raise HTTPException(401, "Invalid token payload.")

    store = getattr(request.app.state, "store", None)
    if store is None:
        raise HTTPException(500, "Storage not initialised.")
    user = store.get_user_by_id(user_id)
    if user is None:
        raise HTTPException(401, "User no longer exists.")
    return {"id": user["id"], "email": user["email"]}
