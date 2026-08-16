# 05 — Return Frequency Matrix

Determines when a return instance is created for a given reporting period.

| Return | Jan | Feb | Mar | Q1 | Apr | May | Jun | Q2 | H1 | Jul | Aug | Sep | Q3 | Oct | Nov | Dec | Q4 | H2 | FY |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Income Production | ● | ● | ● | ◐ | ● | ● | ● | ◐ | — | ● | ● | ● | ◐ | ● | ● | ● | ◐ | — | — |
| PPS (Form PPS-A) | ● | ● | ● | ◐ | ● | ● | ● | ◐ | — | ● | ● | ● | ◐ | ● | ● | ● | ◐ | — | — |
| CRR | — | — | — | ● | — | — | — | ● | — | — | — | — | ● | — | — | — | ● | — | — |
| Businesses Generated | — | — | — | — | — | — | — | — | ● | — | — | — | — | — | — | — | — | ● | — |
| Personnel | — | — | — | ● | — | — | — | ● | — | — | — | — | ● | — | — | — | ● | — | — |
| Form 1C | as directed (per NAICOM circular) |
| Brokerage Commission Register | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | ● |
| Premium Collection | ● | ● | ● | ◐ | ● | ● | ● | ◐ | — | ● | ● | ● | ◐ | ● | ● | ● | ◐ | — | — |
| Premium Remittance | ● | ● | ● | ◐ | ● | ● | ● | ◐ | — | ● | ● | ● | ◐ | ● | ● | ● | ◐ | — | — |
| Commission Report | ● | ● | ● | ◐ | ● | ● | ● | ◐ | — | ● | ● | ● | ◐ | ● | ● | ● | ◐ | — | — |
| Management Report | ● | ● | ● | ◐ | ● | ● | ● | ◐ | — | ● | ● | ● | ◐ | ● | ● | ● | ◐ | — | — |
| Compliance Report | — | — | — | ● | — | — | — | ● | — | — | — | — | ● | — | — | — | ● | — | — |

**Legend**
- ● = full return created for that period.
- ◐ = month-level return also available as quarter-to-date cumulative option (configurable per definition).
- — = not generated.
- Form 1C timing follows NAICOM directives — stored in `due_date_rules`, not hard-coded.

## Period computation rules

| Frequency | Period set |
|---|---|
| MONTHLY | 2026-01 … 2026-12 |
| QUARTERLY | Q1 (Jan–Mar), Q2 (Apr–Jun), Q3 (Jul–Sep), Q4 (Oct–Dec) |
| HALF_YEARLY | H1 (Jan–Jun), H2 (Jul–Dec) |
| ANNUAL | Full year |
| AD_HOC | admin creates explicitly |

Periods are derived from the configured financial year (`company.financial_year_start_month`), defaulting to calendar year.
