# 15 — Regulatory Deadline Configuration Strategy

Per PRD §19, §20, §42: **no hard-coded regulatory deadlines.** All deadlines live in `due_date_rules`; where NAICOM has not confirmed a deadline, the UI shows **"Deadline requires confirmation."**

## Due-date rules model (`due_date_rules`)

```json
// Monthly example
{ "frequency": "monthly", "day_of_month": 15 }

// Quarterly example
{ "frequency": "quarterly", "days_after_period_end": 21 }

// Half-yearly / annual
{ "frequency": "half_yearly", "days_after_period_end": 30 }
{ "frequency": "annual", "due_month": 1, "due_day": 31 }

// Custom (NAICOM circular)
{ "frequency": "adhoc", "fixed_date": "2026-03-31" }
```

| column | purpose |
|---|---|
| `rule` | the formula (monthly day / offset / fixed date) |
| `effective_from / effective_to` | versioned circular applicability |
| `confirmed` | false → UI shows "Deadline requires confirmation." |
| `source` | NAICOM circular/guideline reference (linked to `regulatory_references`) |

Admins edit rules when NAICOM issues a circular; past submissions are untouched (rules are versioned by `effective_from`).

## Calendar engine (PRD §19)

- Generates `regulatory_calendar` rows from `return_definitions × due_date_rules × period`.
- Each row: reporting period, start/end, due date, days remaining, responsible person, department, status.
- Statuses: NOT_STARTED · IN_PROGRESS · READY_FOR_REVIEW · APPROVED · SUBMITTED · OVERDUE · NOT_APPLICABLE (PRD §19).

## Colour coding

| Colour | Condition | Bucket |
|---|---|---|
| RED | due date passed, not submitted | Overdue |
| ORANGE | due within 7 days | Due soon |
| YELLOW | due within 14 days | Due soon |
| GREEN | completed / submitted | Completed |

## Reminder engine (PRD §20)

Channels: **in-app (always)** + **email (when configured)**; WhatsApp/SMS optional and only if configured (else "Integration not configured.").

Schedule per return: 30 → 14 → 7 → 3 → 1 days before, on due date, then daily while overdue.

- Vercel Cron (`/api/cron/reminders`, protected by `CRON_SECRET`) scans `regulatory_calendar` + `notification_preferences`.
- **No duplicates**: a `reminders` row is created once per (calendar_id, channel, lead_days); re-runs are idempotent.
- Per-user preferences (`notification_preferences.channel + lead_days`) respected; unsubscribable.
- Unconfirmed deadlines still warn in-app but are marked "Deadline requires confirmation." rather than asserted.

## Regulatory Source Register (PRD §43)

`regulatory_references` stores Acts/Circulars/Guidelines with effective dates and documents. Changing a rule links to the source reference; the register records last-reviewed date so admins revisit requirements as the framework evolves (incl. the 2025 Nigerian Insurance Industry Reform Act).
