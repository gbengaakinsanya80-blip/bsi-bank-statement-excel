"""Analysis layer: natural-language insights, anomaly detection and a cash-flow
forecast computed from a parsed statement.

Rule-based and dependency-free (no external LLM calls) so the same output feeds
the web UI, the JSON export and any future paid "AI analysis" tier.
"""

from __future__ import annotations

from .anomalies import detect_anomalies
from .forecast import forecast_cashflow
from .insights import generate_insights
from .tax import estimate_tax

__all__ = ["detect_anomalies", "forecast_cashflow", "generate_insights", "estimate_tax"]
