# 08 — Application Sitemap

## Desktop sidebar (PRD §39)

```
WORLDMARK REGULATORY HUB
└── NAICOM RETURNS MANAGEMENT SYSTEM

├── Dashboard
│
├── Business
│   ├── Policies
│   ├── Clients
│   ├── Insurers
│   ├── Transactions
│   ├── Collections
│   └── Remittances
│
├── NAICOM Returns
│   ├── All Returns
│   ├── Monthly Returns
│   ├── Quarterly Returns
│   ├── Half-Year Returns
│   ├── Annual Returns
│   └── Return Calendar
│
├── Personnel
│   ├── Staff
│   └── Personnel Returns
│
├── Reports
│   ├── Management Reports
│   ├── Reconciliation
│   ├── Premium Reports
│   └── Commission Reports
│
├── Documents
│
├── Audit Trail
│
└── Settings
```

## Mobile bottom navigation (PRD §30)

```
[Dashboard] [Returns] [Business] [Staff] [Calendar] [Reports] [More]
```
`More` opens a sheet with: Documents · Audit Trail · Settings · Help · Logout.

## Route map (Next.js App Router)

| Route | Screen | Access |
|---|---|---|
| `/login` | Login | public |
| `/forgot-password` | Password reset | public |
| `/` | Dashboard | all |
| `/business/policies` | Policies list | all (write per role) |
| `/business/policies/new` · `/business/policies/[id]` | Policy form / detail | OPERATIONS, FINANCE, ADMIN |
| `/business/clients` | Clients | all |
| `/business/insurers` | Insurers | all |
| `/business/transactions` | Transaction log | all |
| `/business/collections` | Collections | all |
| `/business/remittances` | Remittances | all |
| `/returns` | All Returns | all |
| `/returns/monthly` `/returns/quarterly` `/returns/half-year` `/returns/annual` | Frequency-filtered | all |
| `/returns/[definitionCode]/[periodId]` | Return detail / builder | per workflow |
| `/returns/calendar` | Regulatory Calendar | all |
| `/personnel/staff` | Staff Master | all |
| `/personnel/staff/[id]` | Staff detail | all |
| `/personnel/returns` | Personnel returns | all |
| `/reports/management` | Management charts | all |
| `/reports/reconciliation` | Reconciliation | all |
| `/reports/premium` | Premium reports | all |
| `/reports/commission` | Commission reports | all |
| `/documents` | Documents/attachments | all |
| `/audit` | Audit trail | ADMIN, SUPER ADMIN |
| `/settings` | Settings hub | per module |
| `/settings/users` | User management | ADMIN, SUPER ADMIN |
| `/settings/returns` | Return definitions (catalogue) | ADMIN, SUPER ADMIN |
| `/settings/risk-classes` | Risk classes | ADMIN, SUPER ADMIN, OPERATIONS |
| `/settings/insurers` | Insurers | ADMIN, SUPER ADMIN, OPERATIONS |
| `/settings/reminders` | Reminder settings | ADMIN, SUPER ADMIN |
| `/settings/import-export` | Import/export templates | ADMIN, SUPER ADMIN |
| `/import` | Excel import wizard | per role |
| `/reports/export-all` | Backup (export all data) | SUPER ADMIN, ADMIN |

## Global commands

- **Quick Add Business** (floating button — desktop + mobile): `/business/policies/new?quick=1`.
- **Global Search** (topbar): searches clients, policy numbers, insurers, transaction refs, returns, staff, receipt numbers, submission refs (PRD §29).
