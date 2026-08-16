# 06 — Return-to-Database Mapping

Which database tables/fields feed each return. Generated returns are produced by the return engine from these sources; nothing is duplicated (PRD §11).

| Return | Source table(s) | Mapping notes |
|---|---|---|
| Income Production | `policies`, `policy_collections`, `policy_remittances` | 1 row per policy in period; Date=transaction_date; Assured=insured_name; Customer=clients.client_name; Broker=broker_or_agent; Tenor=cover_to−cover_from; End Date=cover_to; remittance block from policy_remittances (see `18` §1) |
| PPS (PPS-A) | `policies`, `policy_collections`, `policy_remittances` | Same rows as Income Production, NAICOM layout: S/No, Policy No, Endorsement No, Transaction Type (NEW/RNL/ADD/RTN), From/To Date, Assured, Customer Name, Broker/Agent, Sum Insured, Premium, Brokerage, Net Prem, Policy Tenor (Days), Debit Note, Credit Note No, Credit Note Date, Originating Location/Branch, Amount Received, Date of Receipt, Receipt No, Bank of Lodgement, Date of Lodgement, Insurer(s), Amount Remitted, Amount Unremitted, Date Remitted/Transferred, Bank, Cheque No/Transfer Ref, Receipt No, Remarks (see `18` §2) |
| CRR | `policies` | Date=transaction_date; Policy No.=policy_number; Risk Type=risk_type; Client=client_name; Insurer=insurer_name; Sum/Gross/Commission=policy fields; Approved Rate=commission_rate; Tax=tax; Net Commission Rate=rate−(deductions as configured); Net Premium=net_premium; Amount Received=amount_received; Receipt=receipt_number |
| Businesses Generated | `policies` | Insured=insured_name; Class=class_of_business; Insurer=insurer_name; NGN/USD split by currency; Date of Collection=premium_collection_date; Premium Paid=premium_paid_to_insurer; Date Paid=premium_payment_date; Commission=brokerage_commission |
| Personnel | `staff` | First Schedule: S/N, Name, Staff Category, Designation, Gender, Edu/Prof Qualification, Employment Date, State of Origin, Location, Exit Date, Reason — 1:1 from staff. Second Schedule: derived counts (previous/entry/exit/current) per category |
| Form 1C | `policies` (grouped by insurer) | Item=sequence; Insurer=insurer_name; Gross Premium=SUM(gross_premium); Collected=SUM(premium_collected); Paid=SUM(premium_paid_to_insurer); Commission=SUM(brokerage_commission); totals row |
| Brokerage Commission Register | `policies` | 1 row per policy in the year; Client=client_name; Insurer=insurer_name; Policy No.=policy_number; Class=class_of_business; Date=transaction_date; Sum/Gross=policy fields; Rate=commission_rate; Commission Earned=brokerage_commission; WHT=tax; Net Commission Received=commission−WHT; Date Received=premium_payment_date ?? premium_collection_date; Receipt=receipt_number |
| Premium Collection | `policies` + `policy_collections` | amounts collected by period |
| Premium Remittance | `policy_remittances` | amounts paid to insurer by period |
| Commission Report | `policies` | brokerage_commission by class/insurer/client |
| Management Report | `policies`, `clients`, `insurers` | KPIs + trend series |

## The five core returns and their shared underlying data

| Shared data point | Income Production | CRR | Businesses Generated | Form 1C | Personnel |
|---|---|---|---|---|---|
| policy_number | ● | ● | — | — | — |
| insured/client | ● (Assured/Customer) | ● (Client) | ● (Insured) | — | — |
| class_of_business | — | — | ● | — | — |
| risk_type | — | ● | — | — | — |
| insurer | — | ● | ● | ● | — |
| sum_insured | ● | ● | — | — | — |
| gross_premium | ● | ● | ● | ● | — |
| premium_collected | ◐ (collection info) | ● (Amount Received) | ● | ● | — |
| premium_paid_to_insurer | — | — | ● | ● | — |
| brokerage_commission | ● | ● | ● | ● | — |
| commission_rate | — | ● | — | — | — |
| tax / other_deductions | — | ● | — | — | — |
| net_premium | ● | ● | — | — | — |
| staff fields | — | — | — | — | ● |

● = directly consumed. ◐ = aggregated/derived.

## Reconciliation sources (PRD §23)

These comparisons are pre-configured as `reconciliation_rules`:

1. **CRR commission vs Income Production commission** (same period) → `sum(brokerage_commission)` from both.
2. **Businesses Generated gross premium vs Income Production gross premium**.
3. **Form 1C totals vs underlying `policies` aggregates**.
4. **Premium collected vs amount received** per policy (flag collection > expected).
5. **Premium paid vs premium collected** (flag paid > collected).
6. **Commission vs commission rate** (flag |commission − rate×gross| beyond tolerance).
7. **Brokerage Commission Register vs CRR** — `sum(commission_earned)` (register) vs `sum(brokerage_commission)` (CRR).
