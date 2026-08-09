"""Auth routes: register, login, current user."""

from __future__ import annotations

import re
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.auth.deps import get_current_user
from app.auth.security import create_token, hash_password, verify_password
from app.export.sqlite_store import Store

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD_LEN = 8


def build_auth_router(store: Store) -> APIRouter:
    router = APIRouter(prefix="/auth", tags=["auth"])

    def _normalize_email(email: str) -> str:
        return (email or "").strip().lower()

    def _validate(reg: dict[str, Any], *, password_required: bool) -> tuple[str, str]:
        email = _normalize_email(reg.get("email", ""))
        password = str(reg.get("password", ""))
        if not EMAIL_RE.match(email):
            raise HTTPException(400, "A valid email is required.")
        if password_required and len(password) < MIN_PASSWORD_LEN:
            raise HTTPException(400, f"Password must be at least {MIN_PASSWORD_LEN} characters.")
        return email, password

    def _auth_response(user: dict[str, Any]) -> dict[str, Any]:
        return {
            "token": create_token(user["id"], user["email"]),
            "user": {"id": user["id"], "email": user["email"]},
        }

    @router.post("/register")
    def register(body: dict = ...) -> dict:
        email, password = _validate(body or {}, password_required=True)
        existing = store.get_user_by_email(email)
        if existing:
            raise HTTPException(409, "An account with this email already exists.")
        user = store.create_user(
            id=uuid.uuid4().hex,
            email=email,
            password_hash=hash_password(password),
        )
        return _auth_response(user)

    @router.post("/login")
    def login(body: dict = ...) -> dict:
        email, password = _validate(body or {}, password_required=False)
        user = store.get_user_by_email(email)
        if user is None or not verify_password(password, user["password_hash"]):
            raise HTTPException(401, "Invalid email or password.")
        return _auth_response(user)

    @router.get("/me")
    def me(user: dict = Depends(get_current_user)) -> dict:
        return user

    return router
