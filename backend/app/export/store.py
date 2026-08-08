"""Store factory: choose SQLite (default) or PostgreSQL when DATABASE_URL is set."""

from __future__ import annotations

import os

from app.export.sqlite_store import Store


def get_store() -> Store:
    """Return the configured history store.

    Local dev and tests use the SQLite ``Store``. When ``DATABASE_URL`` is
    present (e.g. Neon on Render) a PostgreSQL-backed store is used so history
    survives redeploys without a persistent disk.
    """
    url = os.environ.get("DATABASE_URL") or os.environ.get("BSI_DATABASE_URL")
    if url:
        from app.export.pg_store import PostgresStore

        return PostgresStore(conninfo=url, schema=False)  # type: ignore[return-value]
    return Store()
