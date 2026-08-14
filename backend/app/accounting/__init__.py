"""FinancePilot AI accounting engine (Layer 2).

Deterministic, dependency-free accounting primitives built on top of the
bank-statement intelligence engine. The rule here is the one from the PRD:

    AI proposes -> user approves -> the accounting engine calculates.

The modules in this package never invent numbers: journals are created from
approved transactions, ledgers and the trial balance are arithmetic, and
financial statements derive from the ledger. AI components (classification,
CFO, commentary) live in ``app.ai`` and only *suggest*.
"""
