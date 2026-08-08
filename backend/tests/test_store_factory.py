"""Tests for the history-store factory (SQLite default vs Postgres)."""

from __future__ import annotations

import os


def test_get_store_defaults_to_sqlite(monkeypatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("BSI_DATABASE_URL", raising=False)
    from app.export.store import get_store

    store = get_store()
    assert type(store).__name__ == "Store"


def test_get_store_uses_postgres_when_database_url_set(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pw@host/db")
    monkeypatch.delenv("BSI_DATABASE_URL", raising=False)
    from app.export.store import get_store

    store = get_store()
    assert type(store).__name__ == "PostgresStore"
    assert store.conninfo == "postgresql://user:pw@host/db"


def test_get_store_honours_bsi_database_url_alias(monkeypatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("BSI_DATABASE_URL", "postgresql://alias:secret@host/db")
    from app.export.store import get_store

    store = get_store()
    assert type(store).__name__ == "PostgresStore"
    assert store.conninfo == "postgresql://alias:secret@host/db"
