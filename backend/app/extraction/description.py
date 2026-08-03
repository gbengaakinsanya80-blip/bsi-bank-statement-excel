"""Description text cleanup: join broken lines, collapse whitespace, keep
important references, never truncate."""

from __future__ import annotations

import re

_REF_RE = re.compile(
    r"(?i)\b(?:TRF|TRANS|TEL|NIP|POS|RTGS|CBS|IMF|BANK|REF|PAY|REC)[/.:]?[\w-]{4,}\b"
)
_MULTI_WS = re.compile(r"\s+")
_JUNK_EDGE = re.compile(r"^[\s\|\-_.:;,'\"]+|[\s\|\-_.:;,'\"]+$")


def clean_description(text: str) -> str:
    """Normalise a (possibly multi-line) description into a single line."""
    if not text:
        return ""
    s = text.replace("\n", " ")
    s = _MULTI_WS.sub(" ", s).strip()
    s = _JUNK_EDGE.sub("", s)
    return s.strip()


def extract_reference(description: str) -> str:
    """Best-effort pull of a reference-like token from a description."""
    if not description:
        return ""
    m = _REF_RE.search(description)
    return m.group(0) if m else ""


def join_parts(parts: list[str]) -> str:
    """Join description fragments from continuation lines."""
    cleaned = [clean_description(p) for p in parts if clean_description(p)]
    return " ".join(cleaned)
