"use client";

import * as React from "react";
import { Building2, Loader2, Play, Plus, RefreshCw, Wand2 } from "lucide-react";
import {
  createBankAccount, createCompany, createPeriod, generateCoa, listBankAccounts,
  listChartOfAccounts, listCompanies, listPeriods, runPosting,
} from "@/lib/api";
import type {
  AccountingPeriod, BankAccount, ChartAccount, Company,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const INDUSTRIES = [
  "general", "insurance", "trading", "construction", "manufacturing",
  "professional services", "retail", "hospitality", "ngo", "consulting",
  "real estate", "transportation",
];

export default function AccountingPage() {
  const [companies, setCompanies] = React.useState<Company[] | null>(null);
  const [companyId, setCompanyId] = React.useState<string>("");
  const [accounts, setAccounts] = React.useState<ChartAccount[] | null>(null);
  const [periods, setPeriods] = React.useState<AccountingPeriod[]>([]);
  const [bankAccounts, setBankAccounts] = React.useState<BankAccount[]>([]);
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

  const loadDetail = React.useCallback(async () => {
    if (!companyId) return;
    setError(null);
    try {
      const [coa, per, banks] = await Promise.all([
        listChartOfAccounts(companyId),
        listPeriods(companyId),
        listBankAccounts(companyId),
      ]);
      setAccounts(coa);
      setPeriods(per);
      setBankAccounts(banks);
    } catch {
      setError("Could not load company details.");
    }
  }, [companyId]);

  React.useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const refreshAll = async () => {
    await loadCompanies();
    await loadDetail();
  };

  const onCreated = async (company: Company) => {
    setCompanies((prev) => (prev ? [...prev, company] : [company]));
    setCompanyId(company.id);
    await loadDetail();
  };

  return (
    <main className="container py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Building2 className="h-6 w-6 text-primary" /> Accounting Setup
          </h1>
          <p className="text-sm text-muted-foreground">
            Companies, chart of accounts, periods, bank accounts and posting.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <NewCompanyDialog onCreated={onCreated} />
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

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
            {companies && companies.length === 0
              ? "No companies yet. Create one to start."
              : "Select a company to manage its accounting setup."}
          </CardContent>
        </Card>
      )}

      {companyId && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartOfAccountsCard companyId={companyId} accounts={accounts} onChanged={loadDetail} />
          <PostingCard companyId={companyId} onPosted={loadDetail} />
          <PeriodsCard periods={periods} companyId={companyId} onChanged={loadDetail} />
          <BankAccountsCard banks={bankAccounts} companyId={companyId} onChanged={loadDetail} />
        </div>
      )}
    </main>
  );
}

// ------------------------------------------------------------------ //
// New company dialog
// ------------------------------------------------------------------ //
function NewCompanyDialog({ onCreated }: { onCreated: (company: Company) => void }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [industry, setIndustry] = React.useState("general");
  const [currency, setCurrency] = React.useState("NGN");
  const [basis, setBasis] = React.useState("cash");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const company = await createCompany({ name, industry, currency, accounting_basis: basis });
      setOpen(false);
      setName("");
      onCreated(company);
    } catch (caught) {
      setErr((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> New company
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create company</DialogTitle>
          <DialogDescription>
            A default chart of accounts is generated for the chosen industry.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="co-name">Company name</Label>
            <Input id="co-name" value={name} required onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="co-industry">Industry</Label>
            <Select id="co-industry" value={industry} onChange={(e) => setIndustry(e.target.value)}>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="co-currency">Currency</Label>
              <Input id="co-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="co-basis">Accounting basis</Label>
              <Select id="co-basis" value={basis} onChange={(e) => setBasis(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="accrual">Accrual</option>
              </Select>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create company
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ //
// Chart of accounts
// ------------------------------------------------------------------ //
function ChartOfAccountsCard({
  companyId, accounts, onChanged,
}: {
  companyId: string;
  accounts: ChartAccount[] | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const handleGenerate = async () => {
    setBusy(true);
    setErr(null);
    try {
      await generateCoa(companyId);
      onChanged();
    } catch (caught) {
      setErr((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="lg:row-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Chart of Accounts</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleGenerate} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Regenerate
          </Button>
          {accounts && accounts.length > 0 && (
            <Badge variant="outline">{accounts.length} accounts</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!accounts ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts yet.</p>
        ) : (
          <div className="max-h-[560px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Normal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.code}</TableCell>
                    <TableCell>{a.name}</TableCell>
                    <TableCell className="text-xs capitalize text-muted-foreground">
                      {a.account_type}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.normal_balance}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ //
// Posting
// ------------------------------------------------------------------ //
function PostingCard({ companyId, onPosted }: { companyId: string; onPosted: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ posted: number; skipped: number } | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const handleRun = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await runPosting(companyId);
      setResult(res);
      onPosted();
    } catch (caught) {
      setErr((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Posting</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Post every approved, unposted classification as balanced double-entry journals.
        </p>
        <Button size="sm" onClick={handleRun} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run posting
        </Button>
        {result && (
          <p className="text-sm">
            Posted <Badge variant="success">{result.posted}</Badge>
            {result.skipped > 0 && (
              <>
                {" "}· skipped <Badge variant="outline">{result.skipped}</Badge>
              </>
            )}
          </p>
        )}
        {err && <p className="text-sm text-destructive">{err}</p>}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ //
// Periods
// ------------------------------------------------------------------ //
function PeriodsCard({
  periods, companyId, onChanged,
}: {
  periods: AccountingPeriod[];
  companyId: string;
  onChanged: () => void;
}) {
  const [name, setName] = React.useState("");
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await createPeriod(companyId, { name, start_date: start, end_date: end });
      setName("");
      setStart("");
      setEnd("");
      onChanged();
    } catch (caught) {
      setErr((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accounting Periods</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {periods.length === 0 ? (
          <p className="text-sm text-muted-foreground">No periods yet.</p>
        ) : (
          <div className="space-y-2">
            {periods.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  {p.start_date} → {p.end_date}
                </span>
                <Badge variant={p.status === "locked" ? "destructive" : "outline"}>
                  {p.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={submit} className="grid gap-3 border-t pt-3">
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="per-name">Period name</Label>
            <Input id="per-name" placeholder="e.g. January 2026" value={name} required onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="per-start">Start date</Label>
              <Input id="per-start" type="date" value={start} required onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="per-end">End date</Label>
              <Input id="per-end" type="date" value={end} required onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add period
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ //
// Bank accounts
// ------------------------------------------------------------------ //
function BankAccountsCard({
  banks, companyId, onChanged,
}: {
  banks: BankAccount[];
  companyId: string;
  onChanged: () => void;
}) {
  const [name, setName] = React.useState("");
  const [bankName, setBankName] = React.useState("");
  const [number, setNumber] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await createBankAccount(companyId, { name, bank_name: bankName, account_number: number });
      setName("");
      setBankName("");
      setNumber("");
      onChanged();
    } catch (caught) {
      setErr((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bank Accounts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {banks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bank accounts yet.</p>
        ) : (
          <div className="space-y-2">
            {banks.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.bank_name} · {b.account_number} · {b.currency}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={submit} className="grid gap-3 border-t pt-3">
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="ba-name">Account name</Label>
            <Input id="ba-name" placeholder="e.g. Operating Account" value={name} required onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ba-bank">Bank</Label>
              <Input id="ba-bank" placeholder="e.g. Zenith Bank" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ba-number">Account number</Label>
              <Input id="ba-number" value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
          </div>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add bank account
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
