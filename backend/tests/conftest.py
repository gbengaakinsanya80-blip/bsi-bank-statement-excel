"""Pytest fixtures shared across the BSI test suite."""

from __future__ import annotations

import pathlib

import pytest

from app.extraction.engine import ExtractionEngine

BACKEND = pathlib.Path(__file__).resolve().parent.parent


@pytest.fixture(scope="session")
def engine() -> ExtractionEngine:
    return ExtractionEngine()
