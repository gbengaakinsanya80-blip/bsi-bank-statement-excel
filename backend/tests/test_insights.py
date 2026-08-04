"""Tests for the analysis layer: insights, anomalies, forecast, rehydration."""

from __future__ import annotations

import pathlib
import tempfile
from datetime import date

from app.analysis.anomalies import detect_anomalies
from app.analysis.forecast import forecast_cashflow
from app.analysis.insights import generate_insights
from app.core.models import (
    ForecastMonth,
    Insight,
    InsightsReport,
    ParsedStatement,
    StatementMeta,
    SummaryStats,
    Transaction,
)
from app.services.pipeline import process_file, rehydrate_parsed
from tests.generators.make_statements import build_statement_pdf


def _tx(
    *,
    day: int,
    month: int = 1,
    year: int = 2025,
    desc: str = "POS PURCHASE SHOPRITE IKEJA LAGOS",
    debit: float | None = None,
    credit: float | None = None,
    balance: float | None = None,
    category: str = "POS",
) -> Transaction:
    return Transaction(
        tx_date=date(year, month, day),
        value_date=date(year, month, day),
        description=desc,
        reference=f"REF-{day}-{month}",
        debit=debit,
        credit=credit,
        balance=balance,
        category=category,
        page_number=1,
        line_number=day,
    )


def _summary(total_credits=0.0, total_debits=0.0, **kw) -> SummaryStats:
    kw.setdefault("currency", "NGN")
    kw.update(total_credits=total_credits, total_debits=total_debits)
    return SummaryStats(**kw)


def test_income_concentration_and_salary_share() -> None:
    txs = [
        _tx(day=31, desc="SALARY PAYMENT VIA NIP", credit=500_000.0, balance=1_000_000.0, category="Transfer"),
        _tx(day=5, desc="NIP INWARD TRANSFER FROM FCMB", credit=50_000.0, balance=550_000.0, category="Transfer"),
        _tx(day=10, desc="POS PURCHASE SHOPRITE IKEJA LAGOS", debit=20_000.0, balance=530_000.0),
    ]
    report = generate_insights(txs, _summary(total_credits=550_000.0, total_debits=20_000.0))
    salary = next(i for i in report.income if i.kind == "salary_share")
    assert salary.metric_value == 90.9
    assert "90.9%" in salary.message
    assert not any(i.kind == "income_concentration" for i in report.income)


def test_top_income_source_when_not_salary() -> None:
    txs = [
        _tx(day=1, desc="NIP INWARD TRANSFER FROM FCMB", credit=400_000.0, balance=900_000.0, category="Transfer"),
        _tx(day=2, desc="RTGS INWARD CLEARING FUNDS", credit=100_000.0, balance=1_000_000.0, category="Transfer"),
    ]
    report = generate_insights(txs, _summary(total_credits=500_000.0))
    conc = next(i for i in report.income if i.kind == "income_concentration")
    assert "Fcmb" in conc.message
    assert conc.metric_value == 400_000.0


def test_top_categories_and_mom_trend() -> None:
    txs = [
        _tx(day=1, month=1, debit=100_000.0),
        _tx(day=2, month=1, debit=50_000.0, desc="ATM WITHDRAWAL ZENITH BANK ABUJA", category="ATM"),
        _tx(day=3, month=2, debit=10_000.0),
        _tx(day=4, month=2, debit=10_000.0),
    ]
    summary = _summary(total_debits=170_000.0)
    summary.monthly_cash_flow = [
        {"month": "2025-01", "credits": 0.0, "debits": 150_000.0, "net": -150_000.0},
        {"month": "2025-02", "credits": 0.0, "debits": 20_000.0, "net": -20_000.0},
    ]
    summary.largest_debit = 100_000.0
    report = generate_insights(txs, summary)

    top = next(i for i in report.spending if i.kind == "top_categories")
    assert top.detail and "POS" in top.detail.splitlines()[0]

    trend = next(i for i in report.spending if i.kind == "month_over_month")
    assert "decreased" in trend.message

    atm = next(i for i in report.spending if i.kind == "atm_usage")
    assert atm.metric_value == 1.0


def test_recurring_payment_detection() -> None:
    txs = [
        _tx(day=1, month=1, desc="BILL PAYMENT DSTV SUBSCRIPTION", debit=47_000.0, category="Bills"),
        _tx(day=1, month=2, desc="BILL PAYMENT DSTV SUBSCRIPTION", debit=47_000.0, category="Bills"),
        _tx(day=3, month=1, desc="POS PURCHASE SHOPRITE IKEJA LAGOS", debit=15_000.0),
        _tx(day=4, month=2, desc="POS PURCHASE SHOPRITE IKEJA LAGOS", debit=18_000.0),
    ]
    report = generate_insights(txs, _summary(total_debits=127_000.0))
    rec = next(i for i in report.recurring if i.kind == "recurring_payments")
    assert rec.metric_value == 47_000.0
    assert "1 recurring charge" in rec.message
    assert "DSTV" in (rec.detail or "").upper()


def test_large_withdrawal_anomaly() -> None:
    txs = [
        _tx(day=1, debit=10_000.0, balance=1_000_000.0),
        _tx(day=2, debit=8_000.0, balance=992_000.0),
        _tx(day=3, debit=500_000.0, balance=492_000.0),
        _tx(day=4, debit=9_000.0, balance=483_000.0),
    ]
    anomalies = detect_anomalies(txs)
    assert any(a.kind == "large_withdrawal" for a in anomalies)
    large = next(a for a in anomalies if a.kind == "large_withdrawal")
    assert large.amount == 500_000.0
    assert large.line_number == 3


def test_rapid_transfer_anomaly() -> None:
    txs = [
        _tx(day=1, desc="TRF/882244917/00 Transfer to ADEBAYO O", debit=100_000.0, balance=900_000.0, category="Transfer"),
        _tx(day=2, desc="TRF/882244917/00 Transfer to ADEBAYO O", debit=100_000.0, balance=800_000.0, category="Transfer"),
        _tx(day=3, desc="TRF/882244917/00 Transfer to ADEBAYO O", debit=100_000.0, balance=700_000.0, category="Transfer"),
    ]
    anomalies = detect_anomalies(txs)
    rapid = [a for a in anomalies if a.kind == "rapid_transfers"]
    assert len(rapid) == 1
    assert "ADEBAYO" in rapid[0].message.upper()
    assert "payments to" in rapid[0].message


def test_round_number_atm_anomaly() -> None:
    txs = [
        _tx(day=1, desc="ATM WITHDRAWAL ZENITH BANK ABUJA", debit=250_000.0, category="ATM"),
        _tx(day=2, desc="ATM WITHDRAWAL ZENITH BANK ABUJA", debit=250_000.0, category="ATM"),
    ]
    anomalies = detect_anomalies(txs)
    assert any(a.kind == "round_number_cash" for a in anomalies)


def test_forecast_math() -> None:
    summary = _summary()
    summary.closing_balance = 500_000.0
    summary.monthly_cash_flow = [
        {"month": "2025-01", "credits": 1_000_000.0, "debits": 600_000.0, "net": 400_000.0},
        {"month": "2025-02", "credits": 1_200_000.0, "debits": 650_000.0, "net": 550_000.0},
    ]
    forecast = forecast_cashflow([], summary, months_ahead=3)
    assert forecast.avg_monthly_income == 1_100_000.0
    assert forecast.avg_monthly_expense == 625_000.0
    assert len(forecast.months) == 3
    assert forecast.months[0].projected_balance == 975_000.0
    assert forecast.months[0].month == "2025-03"
    assert not any(m.at_risk for m in forecast.months)


def test_forecast_risk_flag() -> None:
    summary = _summary()
    summary.closing_balance = 100_000.0
    summary.monthly_cash_flow = [
        {"month": "2025-01", "credits": 200_000.0, "debits": 300_000.0, "net": -100_000.0},
    ]
    forecast = forecast_cashflow([], summary, months_ahead=3)
    assert forecast.avg_monthly_income == 200_000.0
    assert forecast.avg_monthly_expense == 300_000.0
    assert forecast.months[2].at_risk


def test_empty_inputs_are_safe() -> None:
    assert generate_insights([], _summary()).is_empty
    assert detect_anomalies([]) == []
    summary = _summary()
    summary.closing_balance = None
    forecast = forecast_cashflow([], summary)
    assert forecast.months and forecast.months[0].projected_balance is not None


def test_insights_roundtrip_via_rehydrate() -> None:
    from app.core.models import Forecast, ValidationReport

    parsed = ParsedStatement(
        meta=StatementMeta(file_name="x.pdf", currency="NGN"),
        transactions=[_tx(day=1, credit=100.0, balance=100.0, category="Transfer")],
        validation=ValidationReport(),
        summary=_summary(total_credits=100.0),
        insights=InsightsReport(
            income=[Insight(kind="salary_share", title="T", message="M", severity="positive")],
            forecast=Forecast(
                avg_monthly_income=10.0,
                avg_monthly_expense=5.0,
                months=[ForecastMonth(month="2025-03", projected_balance=15.0)],
                summary="ok",
            ),
        ),
    )
    data = parsed.to_dict()
    restored = rehydrate_parsed(data)
    assert restored.insights.income[0].kind == "salary_share"
    assert restored.insights.forecast is not None
    assert restored.insights.forecast.months[0].projected_balance == 15.0


def test_pipeline_attaches_insights(engine) -> None:
    tmp = pathlib.Path(tempfile.mkdtemp())
    pdf = tmp / "stmt.pdf"
    build_statement_pdf(pdf, bank="First Bank", n_transactions=60, seed=11)
    parsed = process_file(str(pdf), "job-test")
    assert parsed.insights is not None
    assert len(parsed.insights.forecast.months) == 3
    assert parsed.insights.spending or parsed.insights.income
