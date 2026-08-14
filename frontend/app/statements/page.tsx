"use client";

import * as React from "react";
import { Check, Loader2, Link2, Play, RefreshCw, X } from "lucide-react";
import {
  approveClassification, classifyStatement, linkStatement, listBankAccounts,
  listChartOfAccounts, listClassifications, listCompanies, listLinkedStatements,
  listPeriods, listRawJobs, reclassifyTransaction, rejectClassification, runPosting,
  unlinkStatement,
} from "@/lib/api";
import type {
  AccountingPeriod, BankAccount, ChartAccount, Company, CompanyStatement, LedgerTxn, RawJob,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/utils";

type ReviewStatus = "review" | "applied" | "rejected";

export default function StatementsPage() {
  const [companies, setCompanies] = React.useState<Company[] | null>(null);
  const [companyId, setCompanyId] = React.useState<string>("");
  const [jobs, setJobs] = React.useState<RawJob[]>([]);
  const [periods, setPeriods] = React.useState<AccountingPeriod[]>([]);
  const [bankAccounts, setBankAccounts] = React.useState<BankAccount[]>([]);
  const [accounts, setAccounts] = React.useState<ChartAccount[]>([]);
  const [statements, setStatements] = React.useState<CompanyStatement[] | null>(null);
  const [queue, setQueue] = React.useState<LedgerTxn[]>([]);
  const [queueStatus, setQueueStatus] = React.useState<ReviewStatus>("review");
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const loadCompanies = React.useCallback(async () => {
    setError(null);
    try {
      const list = await listCompanies();
      setCompanies(list);
      if (list.length > 0 && !list.some((c) => c.id === companyId)) {
        setCompanyId(list[0].id);
      }
    } catch {
      setError("Could not reach the API. Is the backend running?");
    }
  }, [companyId]);

  React.useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const loadBase = React.useCallback(async () => {
    try {
      setJobs(await listRawJobs());
    } catch {
      /* non-fatal */
    }
  }, []);

  React.useEffect(() => {
    loadBase();
  }, [loadBase]);

  const loadCompanyData = React.useCallback(async () => {
    if (!companyId) return;
    setError(null);
    try {
      const [per, banks, coa, stmts, q] = await Promise.all([
        listPeriods(companyId),
        listBankAccounts(companyId),
        listChartOfAccounts(companyId),
        listLinkedStatements(companyId),
        listClassifications(companyId, queueStatus),
      ]);
      setPeriods(per);
      setBankAccounts(banks);
      setAccounts(coa);
      setStatements(stmts);
      setQueue(q.transactions);
    } catch {
      setError("Could not load company statement data.");
    }
  }, [companyId, queueStatus]);

  React.useEffect(() => {
    loadCompanyData();
  }, [loadCompanyData]);

  const refreshAll = async () => {
    await loadCompanies();
    await loadBase();
    await loadCompanyData();
  };

  const handleLink = async (jobId: string, bankId: string, periodId: string) => {
    setError(null);
    setInfo(null);
    try {
      const input: { job_id: string; bank_account_id?: string; period_id?: string } = {
        job_id: jobId,
      };
      if (bankId) input.bank_account_id = bankId;
      if (periodId) input.period_id = periodId;
      await linkStatement(companyId, input);
      setInfo("Statement linked.");
      await loadCompanyData();
    } catch (caught) {
      setError((caught as Error).message);
    }
  };

  const handleClassify = async (statementId: string) => {
    setError(null);
    setInfo(null);
    try {
      const summary = await classifyStatement(companyId, statementId);
      setInfo(
        `Classified: ${summary.imported} imported, ${summary.auto} auto-applied, ${summary.review} need review.`,
      );
      await loadCompanyData();
    } catch (caught) {
      setError((caught as Error).message);
    }
  };

  const handleUnlink = async (statementId: string) => {
    setError(null);
    try {
      await unlinkStatement(companyId, statementId);
      setInfo("Statement unlinked.");
      await loadCompanyData();
    } catch (caught) {
      setError((caught as Error).message);
    }
  };

  const handlePosting = async () => {
    setError(null);
    setInfo(null);
    try {
      const res = await runPosting(companyId);
      setInfo(`Posting: ${res.posted} posted, ${res.skipped} skipped.`);
      await loadCompanyData();
    } catch (caught) {
      setError((caught as Error).message);
    }
  };

  const completedJobs = jobs.filter((j) => j.status === "completed");

  return (
    <main className="container py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Link2 className="h-6 w-6 text-primary" /> Statements
          </h1>
          <p className="text-sm text-muted-foreground">
            Link processed uploads to a company, classify, review and post.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
      {info && <p className="mb-2 text-sm text-emerald-700">{info}</p>}

      <div className="mb-6 w-72 space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Company</label>
        <Select
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          disabled={!companies || companies.length === 0}
        >
          {!companies ? (
            <option value="">Loading…</option>
          ) : (
            <>
              <option value="">Select a company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </>
          )}
        </Select>
      </div>

      {!companyId && (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Select a company to link and classify statements.
          </CardContent>
        </Card>
      )}

      {companyId && (
        <div className="space-y-6">
          <LinkCard
            jobs={completedJobs}
            periods={periods}
            bankAccounts={bankAccounts}
            onLink={handleLink}
          />

          {statements && statements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Linked Statements</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Bank account</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statements.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm">
                          {s.job_meta?.filename ?? s.job_id}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.bank_account
                            ? `${s.bank_account.name} (${s.bank_account.bank_name})`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.period ? s.period.name : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleClassify(s.id)}>
                              Classify
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleUnlink(s.id)}>
                              Unlink
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Classification Review</CardTitle>
              <div className="flex items-center gap-2">
                {(["review", "applied", "rejected"] as ReviewStatus[]).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={queueStatus === s ? "default" : "outline"}
                    onClick={() => setQueueStatus(s)}
                  >
                    {s[0].toUpperCase() + s.slice(1)}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {queue.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No transactions in this state. Link and classify a statement first.
                </p>
              ) : (
                <ReviewTable
                  rows={queue}
                  accounts={accounts}
                  companyId={companyId}
                  onChanged={loadCompanyData}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Post</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <Button size="sm" onClick={handlePosting}>
                <Play className="h-4 w-4" /> Run posting
              </Button>
              <p className="text-sm text-muted-foreground">
                Turns applied classifications into journal entries. See Ledger &amp; Reports.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}

// ------------------------------------------------------------------ //
// Link form
// ------------------------------------------------------------------ //
function LinkCard({
  jobs, periods, bankAccounts, onLink,
}: {
  jobs: RawJob[];
  periods: AccountingPeriod[];
  bankAccounts: BankAccount[];
  onLink: (jobId: string, bankId: string, periodId: string) => void;
}) {
  const [jobId, setJobId] = React.useState("");
  const [bankId, setBankId] = React.useState("");
  const [periodId, setPeriodId] = React.useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Link a statement</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Processed upload</label>
          <Select value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">Choose…</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.filename ?? j.id}
              </option>
            ))}
          </Select>
          {jobs.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Upload a statement on the dashboard first.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Bank account</label>
          <Select value={bankId} onChange={(e) => setBankId(e.target.value)}>
            <option value="">None</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Period</label>
          <Select value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            <option value="">None</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-end">
          <Button size="sm" onClick={() => onLink(jobId, bankId, periodId)} disabled={!jobId}>
            <Link2 className="h-4 w-4" /> Link
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ //
// Review queue table
// ------------------------------------------------------------------ //
function ReviewTable({
  rows, accounts, companyId, onChanged,
}: {
  rows: LedgerTxn[];
  accounts: ChartAccount[];
  companyId: string;
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [codes, setCodes] = React.useState<Record<string, string>>({});

  const run = async (txn: LedgerTxn, action: () => Promise<unknown>) => {
    setBusyId(txn.id);
    setErr(null);
    try {
      await action();
      onChanged();
    } catch (caught) {
      setErr((caught as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const nameFor = (code: string | null) => accounts.find((a) => a.code === code)?.name ?? "";

  return (
    <div>
      {err && <p className="mb-2 text-sm text-destructive">{err}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Debit</TableHead>
            <TableHead className="text-right">Credit</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((txn) => {
            const status = txn.status as ReviewStatus;
            return (
              <TableRow key={txn.id}>
                <TableCell className="text-xs whitespace-nowrap">{txn.tx_date}</TableCell>
                <TableCell className="max-w-[260px] truncate">{txn.description}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {txn.debit ? formatMoney(txn.debit) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {txn.credit ? formatMoney(txn.credit) : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Select
                      className="w-24 font-mono text-xs"
                      value={codes[txn.id] ?? txn.account_code ?? ""}
                      onChange={(e) => setCodes((prev) => ({ ...prev, [txn.id]: e.target.value }))}
                    >
                      <option value="">—</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.code}>
                          {a.code}
                        </option>
                      ))}
                    </Select>
                    <span className="text-xs text-muted-foreground">
                      {nameFor(codes[txn.id] ?? txn.account_code)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={status === "applied" ? "success" : status === "rejected" ? "destructive" : "warning"}>
                    {status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {status !== "applied" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === txn.id}
                        onClick={() => run(txn, () => approveClassification(companyId, txn.id))}
                      >
                        {busyId === txn.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Approve
                      </Button>
                    )}
                    {status !== "rejected" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === txn.id}
                        onClick={() => run(txn, () => rejectClassification(companyId, txn.id))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === txn.id || !(codes[txn.id] ?? txn.account_code)}
                      onClick={() =>
                        run(txn, () =>
                          reclassifyTransaction(companyId, txn.id, codes[txn.id] ?? txn.account_code ?? ""),
                        )
                      }
                    >
                      Apply
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
