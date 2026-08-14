"""Audit-trail helper.

Every meaningful mutation in the accounting layer writes an ``audit_logs``
row so that "who changed what, when, from what to what, and why" is always
answerable (PRD section 39).
"""

from __future__ import annotations

import json
from typing import Any, Optional


def log(
    store,
    *,
    company_id: str,
    user_id: str,
    action: str,
    entity: str,
    entity_id: Optional[str] = None,
    old_value: Any = None,
    new_value: Any = None,
    reason: Optional[str] = None,
) -> None:
    store.add_audit_log(
        company_id=company_id,
        user_id=user_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        old_value=_json(old_value),
        new_value=_json(new_value),
        reason=reason,
    )


def _json(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, default=str)
    except TypeError:
        return str(value)
