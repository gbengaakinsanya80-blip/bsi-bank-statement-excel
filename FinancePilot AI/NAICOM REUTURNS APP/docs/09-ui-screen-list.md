# 09 — UI Screen List

Complete screen inventory. Every screen is responsive (mobile-first) with bottom nav on phones, sidebar on desktop (PRD §30, §38).

## Dashboard
| Screen | Key elements |
|---|---|
| Dashboard | KPI cards (Total Returns, Completed, In Progress, Due Soon, Overdue, Submitted, Pending Review), Business Statistics (gross premium, collected, outstanding, paid, commission, #policies/clients/insurers), Regulatory Calendar, Returns Status table, Recent Activity feed, period selector (this month/quarter/half/year/custom) |

## Business
| Screen | Key elements |
|---|---|
| Policies list | Data table (sortable/filterable), search, month/year/client/insurer/risk/type/broker filters, totals bar, bulk import, export, duplicate button, actions |
| Policy form | Full policy entry (PRD §7), client/insurer/risk dropdowns, currency selector, auto net premium, duplicate-detection banner |
| Quick Add Business | Minimal form (date, client, insurer, risk, policy no., gross premium, collected, paid, commission, type) → SAVE BUSINESS (PRD §31) |
| Clients | Master list + form (reusable across policies) |
| Insurers | Master list + form (dropdown-driven, PRD §9) |
| Transactions | Transaction log from policies |
| Collections | Premium receipts per policy (policy_collections) |
| Remittances | Premium paid to insurer (policy_remittances) |

## NAICOM Returns
| Screen | Key elements |
|---|---|
| All Returns | Catalogue/instance table: Return, Period, Due Date, Responsible, Status, actions |
| Monthly / Quarterly / Half-Year / Annual Returns | Filtered views of the same table |
| Return detail/builder | Generated rows from template, auto totals, data-quality score, validation errors, line editing w/ adjustment reason, add/duplicate/delete rows, manual lines for MANUAL returns |
| Return workflow panel | DRAFT → READY_FOR_REVIEW → REVIEWED → APPROVED → EXPORTED → SUBMITTED → ACKNOWLEDGED → CLOSED; reopen dialog |
| Version history | List of return_versions w/ snapshot diff, amendment reason |
| Submission dialog | Submission date, NAICOM reference, method, evidence upload, notes |
| Return Calendar | Month view + agenda; colour-coded RED/ORANGE/YELLOW/GREEN (PRD §19) |

## Personnel
| Screen | Key elements |
|---|---|
| Staff list | Staff Master table + filters |
| Staff form | All personnel fields (PRD §15), resignation fields |
| Personnel Returns | Quarterly return generated from staff; export |

## Reports
| Screen | Key elements |
|---|---|
| Management Reports | Charts: monthly premium trend, commission trend, collected trend, outstanding, by insurer/class/client, commission by class (PRD §34) |
| Reconciliation | Rule results table, warnings w/ drill-down to underlying transactions |
| Premium Reports | Collection & remittance reports + outstanding |
| Commission Reports | Commission by class/insurer/client |
| Report builder | Date/client/insurer/risk/currency filters → Excel/PDF export (PRD §33) |

## Documents / Audit / Settings / Import
| Screen | Key elements |
|---|---|
| Documents | Attachments grouped by module; upload to Supabase Storage |
| Audit Trail | Filterable log: user, action, module, record, old/new, timestamp, IP/device |
| Settings | Company, Users, Return Types, Risk Classes, Insurers, Reminder Settings, Email, Currency, Financial Year, Numbering, Import/Export Templates |
| Users | User CRUD + role/department assignment |
| Import wizard | Upload → read → preview → map columns → validate → import + error report download |
| Export all (backup) | Full data export for admins |
| Login / Forgot password | Supabase Auth email/password + reset |
| Profile / Notifications | User notification preferences, in-app notification list |

## Cross-cutting UI components
Data tables (responsive, swipe-friendly on mobile) · Modals · Toasts · Status badges · KPI cards · Date/period pickers · Currency-aware number inputs with validation messages · Empty states · Loading skeletons · Error states with corrective hints (PRD §45).
