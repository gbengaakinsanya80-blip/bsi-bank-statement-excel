"""Central configuration for Bank Statement Intelligence (BSI).

Kept as plain Python constants so the module can be imported without any
third-party dependencies. All environment overrides are optional.
"""

import os
from pathlib import Path

try:  # Optional: load backend/.env if python-dotenv is installed
    from dotenv import load_dotenv

    _ROOT = Path(__file__).resolve().parent.parent.parent
    load_dotenv(_ROOT / ".env")
except ImportError:
    pass

APP_NAME = "Bank Statement Intelligence (BSI)"
VERSION = "1.0.0"

# ---- Paths ---------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = Path(os.environ.get("BSI_DATA_DIR", BASE_DIR / "data"))
UPLOAD_DIR = DATA_DIR / "uploads"
EXPORT_DIR = DATA_DIR / "exports"
DB_DIR = DATA_DIR / "db"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
EXPORT_DIR.mkdir(parents=True, exist_ok=True)
DB_DIR.mkdir(parents=True, exist_ok=True)

# ---- Extraction ----------------------------------------------------------
TEXT_MIN_DENSITY = 0.15
"""Minimum ratio of lines that look like real text before we trust the text
layer instead of falling back to OCR."""

TEXT_CHAR_DENSITY_MIN = 1.0e-4
"""Minimum ratio of non-whitespace characters per page-area (points^2) below
which a page is considered a scan and routed to OCR."""

TEXT_WORD_MIN = 3
"""Minimum number of extracted words for a page to be trusted as text."""

OCR_DPI = int(os.environ.get("BSI_OCR_DPI", "150"))

MAX_PAGES = int(os.environ.get("BSI_MAX_PAGES", "1000"))

# Amount regex: handles NGN & international formats (1,234,567.89 / 1.234.567,89)
AMOUNT_PATTERN = r"(?:[+-]?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|[+-]?\d+(?:[.,]\d{2})?)"
AMOUNT_RE = __import__("re").compile(
    r"(?<![\d.,])(?P<amount>[+-]?(?:\d{1,3}(?:[,.]\d{3})+|\d+)(?:[.,]\d{2}))(?![\d.,])"
)

# ---- Performance ---------------------------------------------------------
TIMEOUT_PER_PAGE_SECONDS = 20
MAX_WORKERS = int(os.environ.get("BSI_MAX_WORKERS", "2"))

# ---- Search defaults -----------------------------------------------------
SEARCH_LIMIT = 1000
