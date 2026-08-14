"use client";

import * as React from "react";
import { Eye, Loader2, RefreshCw, RotateCcw, ScrollText, Sparkles } from "lucide-react";
import {
  getJournal, getTrialBalance, listCompanies, listJournals, listPeriods, reverseJournal, seedDemo,
} from "@/lib/api";
import type {
  AccountingPeriod, Company, JournalEntry, JournalLine, TrialBalance, TrialBalanceAccount,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/utils";

export default function LedgerPage() {
  const [companies, setCompanies] = React.useState<Company[] | null>(null);
  const [periods, setPeriods] = React.useState<AccountingPeriod[]>([]);
  const [companyId, setCompanyId] = React.useState<string>("");
  const [periodId, setPeriodId] = React.useState<string>("");
  const [journals, setJournals] = React.useState<JournalEntry[] | null>(null);
  const [trialBalance, setTrialBalance] = React.useState<TrialBalance | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [seeding, setSeeding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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

  React.useEffect(() => {
    if (!companyId) {
      setPeriods([]);
      return;
    }
    listPeriods(companyId)
      .then((p) => {
        setPeriods(p);
        setPeriodId("");
      })
      .catch(() => setError("Could not load accounting periods."));
  }, [companyId]);

  const refresh = React.useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [journalsData, tb] = await Promise.all([
        listJournals(companyId, periodId || undefined),
        getTrialBalance(companyId, periodId || undefined),
      ]);
      setJournals(journalsData);
      setTrialBalance(tb);
    } catch {
      setError("Could not load the ledger.");
    } finally {
      setLoading(false);
    }
  }, [companyId, periodId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSeed = async () => {
    setSeeding(true);
    setError(null);
    try {
      const result = await seedDemo();
      if (result.created) {
        setCompanies([result.company]);
        setCompanyId(result.company.id);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <main className="container py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ScrollText className="h-6 w-6 text-primary" /> General Ledger
          </h1>
          <p className="text-sm text-muted-foreground">
            Posted journal entries and the trial balance.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading || !companyId}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="w-72 space-y-1.5">
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
        <div className="w-64 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Period</label>
          <Select value={periodId} onChange={(e) => setPeriodId(e.target.value)} disabled={!companyId}>
            <option value="">All time</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {!companyId && (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            {companies && companies.length === 0 ? (
              <div className="flex flex-col items-center gap-3">
                <p>
                  No companies yet. Create a company and post journals to see the ledger — or spin
                  up a demo company with posted journals in one click.
                </p>
                <Button size="sm" onClick={handleSeed} disabled={seeding}>
                  {seeding ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Seeding…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Create demo data
                    </>
                  )}
                </Button>
              </div>
            ) : (
              "Select a company to view its journals and trial balance."
            )}
          </CardContent>
        </Card>
      )}

      {loading && !trialBalance && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading ledger…
        </div>
      )}

      {trialBalance && <TrialBalanceCard tb={trialBalance} />}

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Journal Entries</h2>
        {!journals ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : journals.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No journal entries for this company yet.
            </CardContent>
          </Card>
        ) : (
          <JournalsTable
            journals={journals}
            accountNames={namesFrom(trialBalance)}
            companyId={companyId}
            onChanged={refresh}
          />
        )}
      </div>
    </main>
  );
}

function namesFrom(tb: TrialBalance | null): Record<string, string> {
  const map: Record<string, string> = {};
  for (const account of tb?.accounts ?? []) {
    map[account.code] = account.name;
  }
  return map;
}

// ------------------------------------------------------------------ //
// Trial balance
// ------------------------------------------------------------------ //
function TrialBalanceCard({ tb }: { tb: TrialBalance }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Trial Balance</CardTitle>
        <Badge variant={tb.balanced ? "success" : "destructive"}>
          {tb.balanced ? "Balanced" : "Out of balance"}
        </Badge>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tb.accounts.map((account: TrialBalanceAccount) => (
              <TableRow key={account.code}>
                <TableCell className="font-mono text-xs">{account.code}</TableCell>
                <TableCell>{account.name}</TableCell>
                <TableCell className="text-xs capitalize text-muted-foreground">
                  {account.account_type}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {account.total_debit ? formatMoney(account.total_debit) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {account.total_credit ? formatMoney(account.total_credit) : "—"}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(account.balance)}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {account.balance_side === "credit" ? " Cr" : " Dr"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2">
              <TableCell className="font-bold" colSpan={3}>
                Totals
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatMoney(tb.total_debit)}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatMoney(tb.total_credit)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ //
// Journals
// ------------------------------------------------------------------ //
function JournalsTable({
  journals, accountNames, companyId, onChanged,
}: {
  journals: JournalEntry[];
  accountNames: Record<string, string>;
  companyId: string;
  onChanged: () => void;
}) {
  const [selected, setSelected] = React.useState<JournalEntry | null>(null);
  const [detail, setDetail] = React.useState<JournalEntry | null>(null);
  const [busy, setBusy] = React.useState(false);

  const open = async (journal: JournalEntry) => {
    setSelected(journal);
    setDetail(null);
    try {
      setDetail(await getJournal(companyId, journal.id));
    } catch {
      setDetail(journal);
    }
  };

  const handleReverse = async (journal: JournalEntry) => {
    setBusy(true);
    try {
      await reverseJournal(companyId, journal.id, "Reversed from ledger");
      onChanged();
      setDetail(null);
      setSelected(null);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Journal No</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Lines</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {journals.map((journal) => (
              <TableRow key={journal.id}>
                <TableCell className="font-mono text-xs">{journal.journal_no}</TableCell>
                <TableCell className="text-xs">{journal.tx_date ?? "—"}</TableCell>
                <TableCell className="max-w-[220px] truncate">{journal.description}</TableCell>
                <TableCell className="text-xs capitalize text-muted-foreground">
                  {(journal.source_type ?? "journal").replace("_", " ")}
                </TableCell>
                <TableCell className="text-right tabular-nums">{journal.line_count ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(journal.total_debit ?? 0)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(journal.total_credit ?? 0)}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => open(journal)}>
                    <Eye className="h-3.5 w-3.5" /> View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog
        open={selected !== null}
        onOpenChange={(openNow) => {
          if (!openNow) {
            setSelected(null);
            setDetail(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.journal_no}</DialogTitle>
            <DialogDescription>
              {selected?.description} · {selected?.tx_date ?? "no date"}
            </DialogDescription>
          </DialogHeader>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(detail?.lines ?? selected?.lines ?? []).map((line: JournalLine) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <span className="font-mono text-xs">{line.account_code}</span>{" "}
                    <span className="text-muted-foreground">
                      {accountNames[line.account_code] ?? ""}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.debit ? formatMoney(line.debit) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.credit ? formatMoney(line.credit) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Debit {formatMoney(detail?.total_debit ?? selected?.total_debit ?? 0)} · Credit{" "}
              {formatMoney(detail?.total_credit ?? selected?.total_credit ?? 0)}
            </p>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => selected && handleReverse(selected)}
              disabled={busy}
            >
              <RotateCcw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} /> Reverse
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
