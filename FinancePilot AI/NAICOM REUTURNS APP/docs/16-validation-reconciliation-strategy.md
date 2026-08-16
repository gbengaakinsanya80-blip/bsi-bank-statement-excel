# 16 — Validation & Reconciliation Strategy

## Validation engine (PRD §22)

Runs when a return is being prepared and again before "READY FOR REVIEW". Produces a **DATA QUALITY SCORE** (e.g. 98% Complete) and a list of outstanding errors.

### Rules (configurable per return via `return_templates.validation_rules`)

| Rule | Scope | Severity |
|---|---|---|
| Missing policy number | policy | ERROR |
| Missing client | policy | ERROR |
| Missing insurer | policy | ERROR |
| Missing risk class | policy | ERROR |
| Missing premium (gross/collected) | policy | ERROR |
| Negative amount | any numeric | ERROR |
| Invalid date (or impossible range) | dates | ERROR |
| Collection > expected amount | collection vs policy | WARNING |
| Premium paid > premium collected | remittance vs policy | WARNING |
| Commission inconsistent with rate | commission vs rate×gross | WARNING |
| Net commission ≠ earned − WHT | register (commission register) | WARNING |
| Duplicate policy / transaction | duplicate detection | ERROR (confirm to keep) |
| Missing required personnel field | staff | ERROR |
| Missing required return field | return line | ERROR |
| Nil/blank handled as NULL | parse | INFO |

### Behaviour

- User-editable values are never silently recalculated (PRD §13). Where a stored value conflicts with a calculation, show a discrepancy chip: `stored 12,500,000 · computed 12,650,000`.
- Validation messages are actionable: `"Invalid percentage. Enter a number such as 12.5."` (PRD §45).
- READY_FOR_REVIEW is blocked while any ERROR remains; WARNINGs require an explicit acknowledge.
- Score = (passed checks / total applicable checks) × 100.

## Cross-return reconciliation (PRD §23)

Compares returns generated from the same underlying data using `reconciliation_rules`.

### Pre-configured rules

| Rule | A | B | Compare |
|---|---|---|---|
| Commission consistency | CRR | Income Production | sum(brokerage_commission) |
| Premium consistency | Businesses Generated | Income Production | sum(gross_premium) |
| Form 1C integrity | Form 1C totals | underlying `policies` | gross / collected / paid / commission |
| Collection sanity | policy_collections | policies.premium_collected | per-policy sums |
| Remittance sanity | policy_remittances | policies.premium_paid_to_insurer | per-policy sums |
| Commission vs rate | policies.brokerage_commission | commission_rate × gross_premium | per-policy tolerance |
| Commission register | Brokerage Commission Register | CRR | sum(commission_earned) vs sum(brokerage_commission) |

### Behaviour

- Runs on demand and on return completion.
- Difference ≠ 0 within tolerance → OK; outside → **RECONCILIATION WARNING**.
- Message example: `"CRR brokerage commission is ₦12,500,000 while Income Production shows ₦12,650,000. Difference: ₦150,000."`
- **Drill-down**: click a difference → underlying transactions (policies matching the period) with per-policy contributions.
- Results stored in `reconciliation_results` with resolution status + notes; audited.
