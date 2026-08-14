"""Chart of accounts generation (PRD section 6).

Every company gets a sensible default COA on creation; the industry then
adds a handful of tailored accounts. Codes follow the PRD structure:

    1000s  Assets      3000s  Equity     5000s  Cost of sales
    2000s  Liabilities 4000s  Income     6000s  Operating expenses

``normal_balance`` records whether the account increases on the debit
(asset/expense) or credit (liability/equity/income) side. This is what the
journal engine later uses to build balanced double-entry entries.
"""

from __future__ import annotations

ACCOUNT_TYPES = ("asset", "liability", "equity", "income", "expense")

INDUSTRIES = [
    "insurance",
    "trading",
    "construction",
    "manufacturing",
    "professional services",
    "retail",
    "hospitality",
    "ngo",
    "consulting",
    "real estate",
    "transportation",
    "general",
]

# (code, name, account_type, normal_balance, parent_code)
DEFAULT_COA: list[tuple[str, str, str, str, str]] = [
    # Assets (debit)
    ("1010", "Bank", "asset", "debit", ""),
    ("1020", "Cash", "asset", "debit", ""),
    ("1030", "Receivables", "asset", "debit", ""),
    ("1040", "Inventory", "asset", "debit", ""),
    ("1050", "Prepayments", "asset", "debit", ""),
    ("1060", "Property", "asset", "debit", ""),
    ("1070", "Plant & Equipment", "asset", "debit", ""),
    ("1080", "Motor Vehicles", "asset", "debit", ""),
    ("1090", "Furniture & Fixtures", "asset", "debit", ""),
    ("1100", "Computers", "asset", "debit", ""),
    ("1200", "Suspense", "asset", "debit", ""),
    # Liabilities (credit)
    ("2010", "Payables", "liability", "credit", ""),
    ("2020", "Accrued Expenses", "liability", "credit", ""),
    ("2030", "Tax Payable", "liability", "credit", ""),
    ("2040", "VAT Payable", "liability", "credit", ""),
    ("2050", "PAYE Payable", "liability", "credit", ""),
    ("2060", "Loans", "liability", "credit", ""),
    ("2070", "Directors' Loan", "liability", "credit", ""),
    # Equity (credit; Drawings is a contra-equity and moves by debit)
    ("3010", "Share Capital", "equity", "credit", ""),
    ("3020", "Retained Earnings", "equity", "credit", ""),
    ("3030", "Current Year Profit", "equity", "credit", ""),
    ("3040", "Drawings", "equity", "debit", ""),
    # Income (credit)
    ("4010", "Sales Revenue", "income", "credit", ""),
    ("4020", "Service Revenue", "income", "credit", ""),
    ("4030", "Commission Income", "income", "credit", ""),
    ("4040", "Consulting Income", "income", "credit", ""),
    ("4050", "Other Operating Income", "income", "credit", ""),
    # Cost of sales (expense, debit)
    ("5010", "Purchases", "expense", "debit", ""),
    ("5020", "Direct Labour", "expense", "debit", ""),
    ("5030", "Freight Inward", "expense", "debit", ""),
    ("5040", "Production Costs", "expense", "debit", ""),
    # Operating expenses (debit)
    ("6010", "Salaries & Wages", "expense", "debit", ""),
    ("6020", "Rent", "expense", "debit", ""),
    ("6030", "Electricity", "expense", "debit", ""),
    ("6040", "Water", "expense", "debit", ""),
    ("6050", "Internet", "expense", "debit", ""),
    ("6060", "Telephone", "expense", "debit", ""),
    ("6070", "Bank Charges", "expense", "debit", ""),
    ("6080", "Fuel", "expense", "debit", ""),
    ("6090", "Repairs & Maintenance", "expense", "debit", ""),
    ("6100", "Insurance", "expense", "debit", ""),
    ("6110", "Professional Fees", "expense", "debit", ""),
    ("6120", "Advertising", "expense", "debit", ""),
    ("6130", "Transport", "expense", "debit", ""),
    ("6140", "Office Expenses", "expense", "debit", ""),
    ("6150", "Printing & Stationery", "expense", "debit", ""),
    ("6160", "Software Subscriptions", "expense", "debit", ""),
    ("6170", "Security", "expense", "debit", ""),
    ("6180", "Cleaning", "expense", "debit", ""),
    ("6190", "Depreciation", "expense", "debit", ""),
]

# Industry-specific extras; codes are kept unique against DEFAULT_COA.
INDUSTRY_ACCOUNTS: dict[str, list[tuple[str, str, str, str, str]]] = {
    "construction": [
        ("5050", "Direct Construction Costs", "expense", "debit", ""),
        ("1061", "Land & Buildings", "asset", "debit", ""),
    ],
    "hospitality": [
        ("5050", "Food & Beverage Costs", "expense", "debit", ""),
    ],
    "manufacturing": [
        ("5050", "Raw Materials", "expense", "debit", ""),
        ("5060", "Factory Overheads", "expense", "debit", ""),
    ],
    "insurance": [
        ("4031", "Premiums Received", "income", "credit", ""),
        ("5060", "Claims Expense", "expense", "debit", ""),
    ],
    "retail": [],
    "real estate": [
        ("4051", "Rental Income", "income", "credit", ""),
        ("1062", "Investment Property", "asset", "debit", ""),
    ],
    "transportation": [
        ("5080", "Vehicle Operating Costs", "expense", "debit", ""),
    ],
    "professional services": [],
    "consulting": [],
    "ngo": [],
    "trading": [],
    "general": [],
}

# Accounts that back cash/bank movements. The posting engine maps every
# bank transaction against one of these first.
BANK_ACCOUNT_CODES = {"1010"}  # 1010 = Bank; 1020 = Cash reserved for later


def generate_default_coa(industry: str | None = None) -> list[dict]:
    """Return the default chart of accounts for a (possibly industry-tuned) company."""
    accounts: list[dict] = [
        {
            "code": code,
            "name": name,
            "account_type": account_type,
            "normal_balance": normal_balance,
            "parent_code": parent_code,
            "is_system": True,
        }
        for code, name, account_type, normal_balance, parent_code in DEFAULT_COA
    ]
    if industry:
        seen = {a["code"] for a in accounts}
        for code, name, account_type, normal_balance, parent_code in INDUSTRY_ACCOUNTS.get(industry, []):
            if code in seen:
                continue
            accounts.append(
                {
                    "code": code,
                    "name": name,
                    "account_type": account_type,
                    "normal_balance": normal_balance,
                    "parent_code": parent_code,
                    "is_system": True,
                }
            )
            seen.add(code)
    return accounts
