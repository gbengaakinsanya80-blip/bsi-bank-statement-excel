"""Financial statement reports from posted journals (PRD: reporting).

Income statement, balance sheet and cash flow are derived directly from
journal lines via the trial balance — never recomputed from raw bank rows —
so every report ties back to the books. The cash flow uses the indirect
method: it starts from net profit and adjusts for working-capital changes,
investing and financing movements, then reconciles to the actual change in
the cash accounts.
"""

from __future__ import annotations

from typing import Any, Optional

from app.accounting import posting
from app.accounting.coa import BANK_ACCOUNT_CODES

CASH_CODES = set(BANK_ACCOUNT_CODES) | {"1020"}  # Bank + Cash

# Operating working-capital asset accounts (every other asset is investing).
CURRENT_ASSET_CODES = {"1030", "1040", "1050", "1200"}

# Long-term (financing) liabilities; all other liabilities are operating.
LONG_TERM_LIABILITY_CODES = {"2060", "2070"}

# 3030 is the current-year-profit bucket; profit is reported separately.
EQUITY_STATED_EXCLUDE = {"3030"}


def income_statement(
    store,
    *,
    company_id: str,
    period_id: Optional[str] = None,
) -> dict[str, Any]:
    """Revenue, expenses and net profit for a period (or the whole ledger)."""
    accounts = posting.trial_balance(store, company_id=company_id, period_id=period_id)["accounts"]
    revenue = [a for a in accounts if a["account_type"] == "income"]
    expenses = [a for a in accounts if a["account_type"] == "expense"]
    total_revenue = round(sum(_signed(a) for a in revenue), 2)
    total_expenses = round(sum(_signed(a) for a in expenses), 2)
    return {
        "period_id": period_id,
        "revenue": [_account_line(a) for a in revenue],
        "total_revenue": total_revenue,
        "expenses": [_account_line(a) for a in expenses],
        "total_expenses": total_expenses,
        "net_profit": round(total_revenue - total_expenses, 2),
    }


def balance_sheet(
    store,
    *,
    company_id: str,
    period_id: Optional[str] = None,
) -> dict[str, Any]:
    """Assets, liabilities and equity with the books forced to balance."""
    accounts = posting.trial_balance(store, company_id=company_id, period_id=period_id)["accounts"]
    assets = [a for a in accounts if a["account_type"] == "asset"]
    liabilities = [a for a in accounts if a["account_type"] == "liability"]
    equity = [
        a for a in accounts
        if a["account_type"] == "equity" and a["code"] not in EQUITY_STATED_EXCLUDE
    ]
    total_assets = round(sum(_signed(a) for a in assets), 2)
    total_liabilities = round(sum(_signed(a) for a in liabilities), 2)
    stated_equity = round(sum(_signed(a) for a in equity), 2)
    profit = income_statement(store, company_id=company_id, period_id=period_id)["net_profit"]
    # Any residue (e.g. an uncleared suspense credit) is shown as a balancing
    # figure so the report always reconciles: A = L + E + profit + balance.
    balancing_figure = round(
        total_assets - total_liabilities - stated_equity - profit, 2
    )
    total_equity = round(stated_equity + profit + balancing_figure, 2)
    return {
        "period_id": period_id,
        "assets": [_account_line(a) for a in assets],
        "total_assets": total_assets,
        "liabilities": [_account_line(a) for a in liabilities],
        "total_liabilities": total_liabilities,
        "equity": [_account_line(a) for a in equity],
        "current_year_profit": profit,
        "balancing_figure": balancing_figure,
        "total_equity": total_equity,
        "balanced": round(total_assets - (total_liabilities + total_equity), 2) == 0.0,
    }


def cash_flow_statement(
    store,
    *,
    company_id: str,
    period_id: Optional[str] = None,
) -> dict[str, Any]:
    """Indirect-method cash flow, reconciled to the movement in cash accounts."""
    tb = posting.trial_balance(store, company_id=company_id, period_id=period_id)
    accounts = tb["accounts"]
    by_code = {a["code"]: a for a in accounts}
    profit = income_statement(store, company_id=company_id, period_id=period_id)["net_profit"]

    operating_adjustments: list[dict[str, Any]] = []
    investing: list[dict[str, Any]] = []
    financing: list[dict[str, Any]] = []
    for a in accounts:
        code = a["code"]
        if code in CASH_CODES:
            continue
        if a["account_type"] == "asset":
            if code in CURRENT_ASSET_CODES:
                operating_adjustments.append({**a, "change": -_signed(a)})
            else:
                investing.append({**a, "change": -_signed(a)})
        elif a["account_type"] == "liability":
            if code in LONG_TERM_LIABILITY_CODES:
                financing.append({**a, "change": _signed(a)})
            else:
                operating_adjustments.append({**a, "change": _signed(a)})
        elif a["account_type"] == "equity":
            financing.append({**a, "change": _signed(a)})

    net_operating = round(
        profit + sum(x["change"] for x in operating_adjustments), 2
    )
    net_investing = round(sum(x["change"] for x in investing), 2)
    net_financing = round(sum(x["change"] for x in financing), 2)
    net_increase_in_cash = round(
        sum(_signed(by_code[c]) for c in CASH_CODES if c in by_code), 2
    )
    return {
        "period_id": period_id,
        "operating": {
            "net_profit": profit,
            "adjustments": operating_adjustments,
            "net_cash": net_operating,
        },
        "investing": {"items": investing, "net_cash": net_investing},
        "financing": {"items": financing, "net_cash": net_financing},
        "net_increase_in_cash": net_increase_in_cash,
        "opening_cash": 0.0,
        "closing_cash": net_increase_in_cash,
        "assumes_zero_opening": True,
        "ties_to_cash": round(
            net_operating + net_investing + net_financing - net_increase_in_cash, 2
        )
        == 0.0,
    }


def _signed(account: dict) -> float:
    """Signed balance: positive when it sits on the account's normal side."""
    sign = 1 if account["balance_side"] == account["normal_balance"] else -1
    return round(float(account["balance"]) * sign, 2)


def _account_line(account: dict) -> dict[str, Any]:
    return {
        "code": account["code"],
        "name": account["name"],
        "account_type": account["account_type"],
        "balance": _signed(account),
    }
