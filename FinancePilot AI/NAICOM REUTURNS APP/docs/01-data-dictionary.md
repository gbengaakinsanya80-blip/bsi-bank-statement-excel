# 01 — Data Dictionary

Every field in the system, its canonical table, data type, and which NAICOM returns / screens consume it. Compiled from `PRD.dm.txt` §2 (Worldmark data usage), §7–§16 (returns) and the schema in `03-database-schema.md`.

Legend — **Source**: where the value originates. **Consumed by**: returns/reports that read it.

## 1. Company & Users

### company
| field | type | source | consumed by |
|---|---|---|---|
| company_name | text | Settings | Excel export headers, prints |
| registration_number | text | Settings | exports |
| naicom_number | text | Settings | exports |
| address | text | Settings | exports |
| phone | text | Settings | — |
| email | text | Settings | — |
| reporting_contact | text | Settings | exports |
| logo_url | text | Settings upload | UI |
| default_currency | char(3) | Settings | defaults on forms |
| financial_year_start_month | smallint | Settings | calendar year periods |

### users
| field | type | source | consumed by |
|---|---|---|---|
| id | uuid = auth.users.id | Supabase Auth | all FKs |
| name | text | Admin | returns (responsible/reviewer) |
| email | text | Admin/Auth | login, reminders |
| phone | text | Admin | WhatsApp/SMS (optional) |
| role | text (6 roles) | Admin | RBAC (see 07) |
| department | text | Admin | returns |
| active | boolean | Admin | login, reminder routing |
| last_login | timestamptz | system | admin view |

## 2. Master data

### clients
| field | type | source | consumed by |
|---|---|---|---|
| client_name | text | Client Master / import | policies, all returns (Assured/Customer Name) |
| address | text | Client Master | reports |
| phone / email | text | Client Master | reports |
| contact_person | text | Client Master | reports |
| industry | text | Client Master | reports |
| status | text | Client Master | reports |

### insurers
| field | type | source | consumed by |
|---|---|---|---|
| insurer_name | text | Insurer Master / import | policies, CRR, Businesses Generated, Form 1C |
| naicom_code | text | Insurer Master | Form 1C, exports |
| address / contact / email | text | Insurer Master | reports |
| active | boolean | Insurer Master | dropdowns |

### risk_classes
| field | type | source | consumed by |
|---|---|---|---|
| name | text | Risk/Class Master | policies.class_of_business, CRR Risk Type |
| code | text | Risk/Class Master | exports |

### staff / staff_categories
| field | type | source | consumed by |
|---|---|---|---|
| staff_name | text | Staff Master | Personnel Returns (Staff Name) |
| staff_category | text | Staff Master | Personnel Returns (Staff Category) |
| designation | text | Staff Master | Personnel Returns (Designation) |
| gender | text | Staff Master | Personnel Returns (Gender) |
| educational_qualification | text | Staff Master | Personnel Returns |
| professional_qualification | text | Staff Master | Personnel Returns |
| date_of_employment | date | Staff Master | Personnel Returns |
| state_of_origin | text | Staff Master | Personnel Returns |
| location | text | Staff Master | Personnel Returns |
| date_of_exit | date | Staff Master | Personnel Returns (leave blank while employed) |
| reason_for_leaving | text | Staff Master | Personnel Returns |

### currencies
| field | type | source | consumed by |
|---|---|---|---|
| code | char(3) | seeded | policies.currency, Businesses Generated Naira/Dollar split |
| symbol | text | seeded | UI + Excel currency formatting |

## 3. Policies — master transaction table

All "enter once" fields. Naira and foreign currency supported (PRD §7) via `currency`.

| field | type | source | consumed by |
|---|---|---|---|
| transaction_reference | text | auto/manual | Income Production (Transaction Reference), global search |
| policy_number | text | manual/import | ALL returns, duplicate detection |
| endorsement_number | text | manual | Income Production (Endorsement) |
| transaction_type | text | manual | Income Production (Transaction Type), filters |
| new_or_renewal | text | manual | filters |
| risk_type | text | manual | CRR (Risk Type) |
| class_of_business | text | Risk Master | Businesses Generated (Class of Business), management charts |
| client_id | uuid | Client dropdown | Business by client |
| insured_name | text | manual | Assured, Customer Name, Businesses Generated (Insured) |
| insurer_id | uuid | Insurer dropdown | CRR, Businesses Generated, Form 1C (Insurer) |
| broker_or_agent | text | manual | Income Production (Other Broker/Agent) |
| ledger_account | text | manual | Income Production (Ledger Account Number) |
| sum_insured | numeric | manual | Income Production, CRR, Businesses Generated |
| currency | char(3) | manual | Businesses Generated NGN/USD |
| gross_premium | numeric | manual | ALL returns, KPIs |
| premium_collected | numeric | manual | CRR, Businesses Generated, Premium Collection reports, KPIs |
| premium_paid_to_insurer | numeric | manual | Businesses Generated (Premium Paid), Form 1C, Remittance reports |
| brokerage_commission | numeric | manual | Income Production, CRR, Form 1C, Commission reports, reconciliation |
| commission_rate | numeric(%) | manual | CRR (Approved Commission Rate), validation |
| tax | numeric | manual | CRR (Tax Paid) |
| other_deductions | numeric | manual | CRR (Other Deduction) |
| net_premium | numeric | calc default | Income Production (Net Premium), CRR |
| amount_received | numeric | manual | CRR (Amount Received) |
| receipt_number | text | manual | CRR (Receipt Number), global search |
| debit_note_number | text | manual | Income Production (Debit Note No.) |
| credit_note_number | text | manual | Income Production (Credit Note No.) |
| transaction_date | date | manual | Income Production (Date), monthly filter |
| cover_from | date | manual | Income Production (Period From) |
| cover_to | date | manual | Income Production (Period To), Policy Tenor/End Date |
| premium_collection_date | date | manual | Businesses Generated (Date of Collection) |
| premium_payment_date | date | manual | Businesses Generated (Date Premium Paid) |
| branch_location | text | manual | PPS (Originating Location or Branch) |
| remarks | text | manual | all exports |
| status / is_demo / created_by | meta | system | archive, demo separation |

### policy_collections
| field | type | notes |
|---|---|---|
| amount, currency, collection_date, receipt_number, payment_method, bank_name, cheque_number | — | multiple receipts per policy; bank of lodgement + cheque no for PPS/Income Production |

### policy_remittances
| field | type | notes |
|---|---|---|
| insurer_id, amount, currency, payment_date, reference | — | premium remitted to insurer |

## 4. Returns, templates, calendar

### return_definitions
| field | notes |
|---|---|
| name, code, form_number, frequency, responsible_department, data_source, template_id, active | catalogue (PRD §18) |

### return_templates
| field | notes |
|---|---|
| name, code, frequency, source, columns (ordered), calculations, validation_rules, export_format, due_rule_id | engine config (PRD §41) |

### returns (instance)
| field | notes |
|---|---|
| definition_id, period_label, period_start/end, due_date, status, responsible_user_id, reviewer_id, data_quality_score, submission_*, approved_by, approval_date, notes | workflow state (PRD §40) |

### return_versions / return_line_items / adjustments
| field | notes |
|---|---|
| version_no, snapshot, amendment_reason / row_data, source_policy_id / field, old_value, new_value, reason, user_id | versioning + audited adjustment (PRD §26, §16) |

### due_date_rules / regulatory_calendar
| field | notes |
|---|---|
| rule jsonb, effective_from/to, confirmed, source | configurable deadlines (PRD §42) |
| period_label, period_start/end, due_date, status, responsible_user_id, department | dashboard calendar |

### submissions
| field | notes |
|---|---|
| submission_date, naicom_reference, submitted_by, method, notes | tracking (PRD §27) |

### regulatory_references
| field | notes |
|---|---|
| title, type, return_requirement, effective_date, source, document_url, last_reviewed_date | source register (PRD §43) |

## 5. Cross-cutting

### audit_logs
| field | notes |
|---|---|
| user_id, action (CREATE/UPDATE/DELETE/EXPORT/IMPORT/APPROVE/SUBMIT/REOPEN), module, record_id, old_value, new_value, ip_address, device, created_at | PRD §6 |

### attachments
| field | notes |
|---|---|
| module, record_id, file_name, file_path, file_size, mime_type, uploaded_by | PRD §28 |

### import_jobs / import_mappings
| field | notes |
|---|---|
| file_name, target_table, status, counts, error_report_url / name, target_table, mapping jsonb | PRD §24, §47 |

### reconciliation_rules / reconciliation_results
| field | notes |
|---|---|
| name, source_a, source_b, threshold, active / value_a, value_b, difference, status, resolved | PRD §23 |

### reminders / user_notifications / notification_preferences
| field | notes |
|---|---|
| calendar_id, channel, lead_days, status, sent_at / title, body, type, read / channel, enabled, lead_days | PRD §20 |

## Field normalization rules

| incoming value | stored as | rationale |
|---|---|---|
| "NIL", "N/A", "—", blank | `NULL` | PRD §46 — never store "NIL" as a number |
| "₦1,015,000" | `1015000` | strip symbol/commas at parse, validate |
| "12..5" | rejected → message | PRD §45 — explain and allow correction |
| "EMPLE" / "EMPLE INS" / "Emple Insurance" | separate rows + POSSIBLE DUPLICATE flag | PRD §49 — never auto-merge |
| dates "01/02/2026" | ISO `date` | normalize after parse |
| numbers 5 vs 5.00 | numeric | no precision loss on money |

## Currency convention

- `gross_premium`, `premium_collected`, `premium_paid_to_insurer`, `brokerage_commission`, `sum_insured` are stored per-row with `currency`.
- Businesses Generated splits into Naira and Dollar columns at **export/query time** based on `currency`, preserving both without duplication (PRD §14).
