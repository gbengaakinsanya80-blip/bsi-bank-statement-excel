# 03 — Database Schema

Supabase PostgreSQL (normalized). All tables created via SQL migrations. `id` is `uuid` with `gen_random_uuid()` unless stated. Money stored as `numeric(18,2)` (or `numeric(20,4)` for FX when required). Dates are `date`, timestamps `timestamptz`. Soft delete via `deleted_at` on business-critical tables.

## Conventions

- **Enum / lookup** values are stored as lowercase snake-case `text` with CHECK constraints (simpler than native enums to evolve).
- **Amounts** are positive values; sign conventions are defined per field (e.g. `premium_paid_to_insurer >= 0`). Negativity is flagged by the validation engine, not stored as a sign.
- **Currency** is `char(3)` referencing `currencies.code`, defaulting from `company.default_currency`.
- **Audit**: CREATE/UPDATE/DELETE on core tables inserts into `audit_logs` via triggers.

---

## 1. company

Single-row company profile (default: WORLDMARK INSURANCE BROKERS LTD).

| column | type | notes |
|---|---|---|
| id | uuid PK | fixed default row |
| company_name | text | "WORLDMARK INSURANCE BROKERS LTD" |
| registration_number | text | CAC registration |
| naicom_number | text | NAICOM broker licence number |
| address | text | |
| phone | text | |
| email | text | |
| reporting_contact | text | |
| logo_url | text | Supabase Storage path |
| default_currency | char(3) | default 'NGN' |
| financial_year_start_month | smallint | 1–12, default 1 |
| created_at / updated_at | timestamptz | |

## 2. users

Maps 1:1 to `auth.users` (`id = auth.users.id`).

| column | type | notes |
|---|---|---|
| id | uuid PK FK auth.users | |
| name | text | |
| email | text UNIQUE | |
| phone | text | |
| role | text | CHECK in SUPER_ADMIN, ADMIN, FINANCE, OPERATIONS, HR, REVIEWER, VIEWER |
| department | text | |
| active | boolean default true | |
| last_login | timestamptz | |
| created_at / updated_at | timestamptz | |

## 3. audit_logs

| column | type | notes |
|---|---|---|
| id | bigserial PK | |
| user_id | uuid FK users | null = system |
| action | text | CREATE, UPDATE, DELETE, EXPORT, IMPORT, APPROVE, SUBMIT, REOPEN, LOGIN |
| module | text | e.g. 'policies', 'returns', 'staff' |
| record_id | text | uuid of affected row |
| old_value | jsonb | |
| new_value | jsonb | |
| ip_address | text | |
| device | text | user agent |
| created_at | timestamptz | |

## 4. clients

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| client_name | text NOT NULL | |
| address | text | |
| phone | text | |
| email | text | |
| contact_person | text | |
| industry | text | |
| status | text | ACTIVE / INACTIVE / SUSPENDED |
| deleted_at | timestamptz | soft delete |
| created_at / updated_at | timestamptz | |

Index: `client_name`, lower(`client_name`).

## 5. insurers

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| insurer_name | text NOT NULL | |
| naicom_code | text | |
| address | text | |
| contact | text | |
| email | text | |
| active | boolean default true | |
| deleted_at | timestamptz | |
| created_at / updated_at | timestamptz | |

Index: `insurer_name`, lower(`insurer_name`).

## 6. risk_classes

Configurable risk categories (Motor, Group Life, Fire, Marine, Engineering, Oil & Gas, Aviation, Accident, Bonds, Professional Indemnity, Public Liability, Employers Liability, Miscellaneous).

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text UNIQUE NOT NULL | |
| code | text | short code for exports |
| active | boolean default true | |
| created_at / updated_at | timestamptz | |

## 7. staff_categories

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text UNIQUE | e.g. MANAGEMENT, PROFESSIONAL, TECHNICAL, ADMINISTRATIVE, DRIVER, CLERICAL |
| created_at | timestamptz | |

## 8. staff (Staff Master — permanent)

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| staff_name | text NOT NULL | |
| staff_category_id | uuid FK staff_categories | |
| designation | text | |
| gender | text | MALE / FEMALE |
| educational_qualification | text | |
| professional_qualification | text | |
| date_of_employment | date | |
| state_of_origin | text | |
| location | text | |
| date_of_exit | date | null while employed |
| reason_for_leaving | text | null while employed |
| active | boolean | derived: date_of_exit IS NULL |
| deleted_at | timestamptz | |
| created_at / updated_at | timestamptz | |

## 9. currencies

| column | type | notes |
|---|---|---|
| code | char(3) PK | NGN, USD, GBP, EUR… |
| name | text | |
| symbol | text | ₦, $, £, € |
| decimal_places | smallint | |
| is_base | boolean | base reporting currency |

## 10. policies — MASTER BUSINESS/POLICY DATABASE (the transaction engine)

Central fact table. One row = one business transaction/policy record. Feeds Income Production, CRR, Businesses Generated, Form 1C, premium/commission reports, management reports.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| transaction_reference | text | internal ref |
| policy_number | text | |
| endorsement_number | text | null for base policy |
| transaction_type | text | NEW, RENEWAL, ENDORSEMENT, DEBIT_NOTE, CREDIT_NOTE, CANCELLATION |
| new_or_renewal | text | NEW / RENEWAL |
| risk_type | text | broad risk label (may map to risk_class) |
| class_of_business | text | free-text or FK-style name; validated against risk_classes |
| client_id | uuid FK clients | |
| insured_name | text | may differ from client (assured) |
| insurer_id | uuid FK insurers | |
| broker_or_agent | text | other intermediary |
| ledger_account | text | |
| sum_insured | numeric(20,2) | |
| currency | char(3) FK currencies | |
| gross_premium | numeric(20,2) | |
| premium_collected | numeric(20,2) | |
| premium_paid_to_insurer | numeric(20,2) | |
| brokerage_commission | numeric(20,2) | |
| commission_rate | numeric(6,2) | percent, e.g. 12.5 |
| tax | numeric(20,2) | |
| other_deductions | numeric(20,2) | |
| net_premium | numeric(20,2) | |
| amount_received | numeric(20,2) | |
| receipt_number | text | |
| debit_note_number | text | |
| credit_note_number | text | |
| transaction_date | date | |
| cover_from | date | |
| cover_to | date | |
| premium_collection_date | date | |
| premium_payment_date | date | |
| branch_location | text | originating location/branch (PPS) |
| remarks | text | |
| status | text | ACTIVE / ARCHIVED |
| is_demo | boolean default false | demo data flag (PRD §53) |
| created_by | uuid FK users | |
| deleted_at | timestamptz | soft delete |
| created_at / updated_at | timestamptz | |

Indexes: `policy_number`, `transaction_date`, `client_id`, `insurer_id`, `risk_type`, `transaction_type`, `(currency, transaction_date)`. Partial unique guard on `(policy_number, endorsement_number, client_id, insurer_id, transaction_date, gross_premium)` for duplicate detection (soft-deleted excluded).

## 11. policy_collections

Multiple premium receipts per policy (normalized).

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| policy_id | uuid FK policies | |
| amount | numeric(20,2) | |
| currency | char(3) | |
| collection_date | date | |
| receipt_number | text | |
| payment_method | text | CASH / TRANSFER / CHEQUE / POS |
| bank_name | text | bank of lodgement (PPS/Income Production) |
| cheque_number | text | |
| remarks | text | |
| created_by | uuid FK users | |
| created_at | timestamptz | |

## 12. policy_remittances

Premium remitted to insurer per policy.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| policy_id | uuid FK policies | |
| insurer_id | uuid FK insurers | |
| amount | numeric(20,2) | |
| currency | char(3) | |
| payment_date | date | |
| reference | text | bank/reference |
| remarks | text | |
| created_by | uuid FK users | |
| created_at | timestamptz | |

## 13. return_definitions — Regulatory Returns Catalogue (configurable)

One row per return type (Income Production, CRR, Businesses Generated, Personnel, Form 1C, PPS, plus any future NAICOM return). Drives the calendar and workflow; no code change needed for a new return.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text | e.g. "Commission & Rebate Returns" |
| code | text UNIQUE | e.g. CRR, INCOME_PRODUCTION |
| form_number | text | NAICOM form no. |
| frequency | text | MONTHLY, QUARTERLY, HALF_YEARLY, ANNUAL, AD_HOC |
| responsible_department | text | |
| data_source | text | view/query name, or MANUAL |
| template_id | uuid FK return_templates | |
| active | boolean default true | |
| requires_confirmation | boolean | deadline unknown → "Deadline requires confirmation." |
| created_at / updated_at | timestamptz | |

## 14. return_templates — Return Template Engine

Column/calculation/validation/export definition for a return. JSON columns are validated against a JSON-schema-like structure in app code.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| code | text UNIQUE | |
| frequency | text | |
| source | text | SQL view name (e.g. `v_income_production`) or MANUAL |
| columns | jsonb | ordered `[{key, header, source_field, type, format}]` |
| calculations | jsonb | `[{output, formula, refs}]` |
| validation_rules | jsonb | rules referenced by validation engine |
| export_format | jsonb | header order, number/date formats, totals, currency column |
| due_rule_id | uuid FK due_date_rules | nullable |
| created_at / updated_at | timestamptz | |

## 15. returns — Return INSTANCES

A specific return for a period (e.g. CRR Q1 2026). Created automatically by the calendar engine per `return_definitions` × period.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| definition_id | uuid FK return_definitions | |
| period_label | text | e.g. "Q1 2026", "2026-06", "H1 2026" |
| period_start | date | |
| period_end | date | |
| due_date | date | copied from due-date rule |
| status | text | DRAFT, IN_PROGRESS, READY_FOR_REVIEW, REVIEWED, APPROVED, EXPORTED, SUBMITTED, ACKNOWLEDGED, CLOSED, OVERDUE, NOT_APPLICABLE |
| responsible_user_id | uuid FK users | |
| reviewer_id | uuid FK users | |
| data_quality_score | numeric(5,2) | 0–100 from validation engine |
| submission_date | date | |
| submission_reference | text | NAICOM ref |
| submission_method | text | |
| submitted_by | uuid FK users | |
| approved_by | uuid FK users | |
| approval_date | timestamptz | |
| notes | text | |
| created_by | uuid FK users | |
| created_at / updated_at | timestamptz | |

Indexes: `(definition_id, period_start, period_end)`, `status`, `due_date`.

## 16. return_versions — Version control (PRD §26)

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| return_id | uuid FK returns | |
| version_no | int | 1, 2, … |
| status | text | DRAFT / SUBMITTED / AMENDED / SUPERSEDED |
| snapshot | jsonb | frozen exported row set at version time |
| amendment_reason | text | required for version > 1 |
| created_by | uuid FK users | |
| approved_by | uuid FK users | |
| approval_date | timestamptz | |
| created_at | timestamptz | |

Unique `(return_id, version_no)`.

## 17. return_line_items

Rows of a return not fully derivable from `policies` (manual-only returns e.g. Personnel, or manual lines / adjustments on generated returns). Each row references its source policy when applicable.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| return_id | uuid FK returns | |
| version_id | uuid FK return_versions | nullable |
| source_policy_id | uuid FK policies | nullable |
| row_data | jsonb | full column set per template |
| adjustment_reason | text | required when manually edited |
| adjusted_by | uuid FK users | |
| adjusted_at | timestamptz | |
| created_at | timestamptz | |

## 18. adjustments

Auditable manual adjustments to generated return figures (generalised Form 1C rule, PRD §16).

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| return_id | uuid FK returns | |
| return_line_item_id | uuid FK return_line_items | nullable |
| field | text | |
| old_value | jsonb | |
| new_value | jsonb | |
| reason | text NOT NULL | |
| user_id | uuid FK users | |
| created_at | timestamptz | |

## 19. due_date_rules — Regulatory Calendar Engine

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| definition_id | uuid FK return_definitions | |
| rule | jsonb | e.g. `{"frequency":"monthly","day_of_month":15}` or `{"frequency":"quarterly","days_after_period_end":21}` |
| effective_from | date | |
| effective_to | date | nullable |
| confirmed | boolean | false → "Deadline requires confirmation." |
| source | text | NAICOM circular/guideline ref |
| created_at / updated_at | timestamptz | |

## 20. regulatory_calendar — generated due items

Materialised from definitions × rules; the dashboard reads from here.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| definition_id | uuid FK return_definitions | |
| return_id | uuid FK returns | nullable (linked instance) |
| period_label | text | |
| period_start / period_end | date | |
| due_date | date | |
| status | text | NOT_STARTED, IN_PROGRESS, READY_FOR_REVIEW, APPROVED, SUBMITTED, OVERDUE, NOT_APPLICABLE |
| responsible_user_id | uuid FK users | |
| department | text | |
| created_at | timestamptz | |

## 21. reminders / reminder_schedule

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| calendar_id | uuid FK regulatory_calendar | |
| channel | text | IN_APP / EMAIL / WHATSAPP / SMS |
| lead_days | int | 30, 14, 7, 3, 1, 0, or negative for daily-overdue |
| scheduled_for | timestamptz | |
| status | text | PENDING / SENT / FAILED / SKIPPED |
| sent_at | timestamptz | |
| error | text | |

## 22. user_notifications

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK users | |
| title / body | text | |
| type | text | DEADLINE, VALIDATION, WORKFLOW, SYSTEM |
| link | text | deep link |
| read | boolean default false | |
| created_at | timestamptz | |

## 23. notification_preferences

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK users | |
| channel | text | |
| enabled | boolean | |
| lead_days | jsonb | e.g. `[30,14,7,3,1,0]` |
| created_at / updated_at | timestamptz | |

## 24. attachments

Supabase Storage-backed; record in DB, file in bucket.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| module | text | RETURN / SUBMISSION / POLICY / STAFF / REGULATORY_REF |
| record_id | uuid | |
| file_name | text | |
| file_path | text | storage path |
| file_size | bigint | |
| mime_type | text | |
| uploaded_by | uuid FK users | |
| created_at | timestamptz | |

## 25. submissions — Submission tracking

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| return_id | uuid FK returns | |
| version_id | uuid FK return_versions | |
| submission_date | date | |
| naicom_reference | text | |
| submitted_by | uuid FK users | |
| method | text | PORTAL / EMAIL / HARD_COPY |
| notes | text | |
| created_at | timestamptz | |

## 26. regulatory_references — Regulatory Source Register

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| title | text | |
| type | text | ACT / GUIDELINE / CIRCULAR |
| return_requirement | text | |
| effective_date | date | |
| source | text | |
| document_url | text | storage path |
| last_reviewed_date | date | |
| notes | text | |
| created_at / updated_at | timestamptz | |

## 27. import_jobs

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| file_name | text | |
| target_table | text | policies / clients / insurers / staff |
| status | text | UPLOADED / PARSED / MAPPED / VALIDATED / IMPORTED / FAILED |
| total_rows / valid_rows / invalid_rows / duplicate_rows | int | |
| error_report_url | text | generated error workbook |
| created_by | uuid FK users | |
| created_at | timestamptz | |

## 28. import_mappings — reusable column-mapping templates

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| target_table | text | |
| mapping | jsonb | `{ "EXCEL HEADER": "db_field" }` |
| created_by | uuid FK users | |
| created_at | timestamptz | |

## 29. reconciliation_rules

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text | e.g. "CRR vs Income Production commission" |
| source_a | jsonb | {definition_code, column} |
| source_b | jsonb | {definition_code, column} |
| threshold | numeric | warn tolerance |
| active | boolean | |
| created_at | timestamptz | |

## 30. reconciliation_results

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| rule_id | uuid FK reconciliation_rules | |
| return_a_id | uuid FK returns | |
| return_b_id | uuid FK returns | |
| value_a / value_b | numeric | |
| difference | numeric | |
| status | text | OK / WARNING |
| resolved | boolean | |
| investigated_by | uuid FK users | |
| notes | text | |
| created_at / updated_at | timestamptz | |

## 31. reports

Generated on demand — no table. Report definitions live in app config (`src/lib/reports`). Filterable by date range, client, insurer, risk, currency.

## 32. app_settings

Key/value for Settings module (company, reminder defaults, email config, numbering prefixes, fiscal year, import/export templates refs).

| column | type | notes |
|---|---|---|
| key | text PK | |
| value | jsonb | |
| updated_by | uuid FK users | |
| updated_at | timestamptz | |

---

## Views (reporting layer)

Created in migrations; used by the return engine and reports:

- `v_income_production` — monthly income rows from `policies` + `policy_collections`
- `v_crr` — CRR rows w/ computed commission, net commission rate, net premium
- `v_businesses_generated` — half-year rows incl. Naira/Dollar splits
- `v_form_1c` — grouped by insurer: gross premium, collected, paid, commission, totals
- `v_premium_collections` / `v_premium_remittances`
- `v_commission_analysis`
- `v_dashboard_kpis` — dashboard cards + business statistics
- `v_reconciliation_source` — normalized source values per return/column

## Triggers

- `audit_policies_*` → audit_logs on INSERT/UPDATE/DELETE of policies, clients, insurers, staff, returns, return_versions
- `touch_updated_at` on all tables with updated_at

## Row Level Security (RLS) summary

| table | policy |
|---|---|
| company | authenticated read; SUPER_ADMIN/ADMIN write |
| clients, insurers, risk_classes, staff | authenticated read; OPERATIONS/ADMIN/SUPER_ADMIN write |
| policies, policy_collections, policy_remittances | authenticated read; OPERATIONS/FINANCE write |
| returns, return_versions, return_line_items | authenticated read; FINANCE/ADMIN/REVIEWER write per workflow |
| audit_logs | SUPER_ADMIN/ADMIN read; insert-only for all |
| settings | SUPER_ADMIN read/write |

Full policy definitions ship with the migration files (see `11-development-phases.md` → Phase 1).
