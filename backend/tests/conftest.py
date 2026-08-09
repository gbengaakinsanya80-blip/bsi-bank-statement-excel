"""Pytest fixtures shared across the BSI test suite."""

from __future__ import annotations

import os
import pathlib
import tempfile

# Isolate the test suite from the developer's live database (and from prior
# test runs): point the app at a throwaway data dir before any app module is
# imported, so quota/usage state can never leak between runs or into dev.
os.environ["BSI_DATA_DIR"] = os.environ.get(
    "BSI_TEST_DATA_DIR", tempfile.mkdtemp(prefix="bsi-test-")
)

import pytest

from app.extraction.engine import ExtractionEngine

BACKEND = pathlib.Path(__file__).resolve().parent.parent


@pytest.fixture(scope="session")
def engine() -> ExtractionEngine:
    return ExtractionEngine()
