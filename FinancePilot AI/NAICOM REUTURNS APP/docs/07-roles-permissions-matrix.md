# 07 — User Roles & Permissions Matrix

Roles per PRD §5: SUPER ADMIN, ADMIN, FINANCE, OPERATIONS, HR, REVIEWER, VIEWER.

Legend: **R** read · **C** create · **U** update · **D** delete (hard) · **A** archive/soft-delete · **X** no access. Blank = no access.

| Module / capability | SUPER ADMIN | ADMIN | FINANCE | OPERATIONS | HR | REVIEWER | VIEWER |
|---|---|---|---|---|---|---|---|
| **Dashboard** | R | R | R | R | R | R | R |
| **Company / Settings** | R C U D | R C U | R | — | — | — | — |
| **Users** | R C U D | R C U (not self-delete) | — | — | — | — | — |
| **Audit logs** | R | R | — | — | — | — | — |
| **Clients** | R C U A | R C U A | R | R C U | — | R | R |
| **Insurers** | R C U A | R C U A | R | R C U | — | R | R |
| **Risk classes** | R C U A | R C U A | R | R C U | — | R | R |
| **Staff Master** | R C U A | R C U A | — | — | R C U | R | R |
| **Policies / Business** | R C U A | R C U A | R C U | R C U | — | R | R |
| **Transactions / Collections / Remittances** | R C U A | R C U A | R C U | R C U | — | R | R |
| **Returns — view** | R | R | R | R | R (Personnel) | R | R |
| **Returns — generate/export** | C U | C U | C U (financial) | C U (business) | C U (personnel) | R | — |
| **Returns — review** | U | U | — | — | — | U | — |
| **Returns — approve** | U | U | — | — | — | — | — |
| **Returns — submit** | U | U | U | — | — | — | — |
| **Returns — reopen** | U | U | — | — | — | — | — |
| **Manual adjustments on returns** | C U | C U | C U (own dept) | — | — | — | — |
| **Return versions (view history)** | R | R | R | R | R | R | R |
| **Regulatory Calendar** | R C U | R C U | R | R | R | R | R |
| **Due-date rules** | R C U | R C U | R | — | — | — | — |
| **Reminder settings** | R C U | R C U | R | — | — | — | — |
| **Regulatory References** | R C U | R C U | R | R | R | R | R |
| **Excel import** | C | C | C (financial) | C (business) | C (personnel) | — | — |
| **Import mapping templates** | R C U | R C U | R | R | R | — | — |
| **Export all data / backup** | C | C | — | — | — | — | — |
| **Reports / charts** | R | R | R | R | R | R | R |
| **Reconciliation** | R | R C U | R | R | — | R | R |
| **Attachments** | C U A | C U A | C U A | C U A | C U A | — | — |
| **Hard delete** | only via audit-protected flow | — | — | — | — | — | — |

## Enforcement

- **RBAC** via `users.role` claim read server-side (never trusted from client alone).
- **RLS** on every table (see `03-database-schema.md`).
- **Soft delete default** for policies, clients, insurers, staff, returns (PRD §6). Hard delete requires SUPER ADMIN and writes an audit record.
- **Workflow enforcement** (PRD §40): only SUPER ADMIN / ADMIN can REOPEN a CLOSED return; APPROVE requires ADMIN/SUPER ADMIN; SUBMIT allowed for the responsible department's FINANCE/OPERATIONS user or ADMIN.

## Department scoping

- FINANCE: financial returns (Income Production, CRR, Form 1C, premium/commission reports).
- OPERATIONS: business/policy data (policies, transactions, Businesses Generated).
- HR: Personnel returns + Staff Master.
- REVIEWER: read + review only.
- VIEWER: read-only.
