"use client";

import * as React from "react";
import { Loader2, Search as SearchIcon } from "lucide-react";
import { listJobs, searchTransactions } from "@/lib/api";
import type { Job, SearchResponse } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/utils";

export default function SearchPage() {
  const [q, setQ] = React.useState("");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [minAmount, setMinAmount] = React.useState("");
  const [maxAmount, setMaxAmount] = React.useState("");
  const [balance, setBalance] = React.useState("");
  const [txType, setTxType] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [jobId, setJobId] = React.useState("");
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [result, setResult] = React.useState<SearchResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    listJobs()
      .then(setJobs)
      .catch(() => undefined);
  }, []);

  const setRange = (from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
  };

  const setToday = () => {
    const now = new Date();
    setRange(now.toISOString().slice(0, 10), now.toISOString().slice(0, 10));
  };

  const setYesterday = () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    setRange(y.toISOString().slice(0, 10), y.toISOString().slice(0, 10));
  };

  const setThisMonth = () => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    setRange(first.toISOString().slice(0, 10), now.toISOString().slice(0, 10));
  };

  const clearRange = () => setRange("", "");

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(
        await searchTransactions({
          q: q || undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          min_amount: minAmount ? Number(minAmount) : undefined,
          max_amount: maxAmount ? Number(maxAmount) : undefined,
          balance: balance ? Number(balance) : undefined,
          tx_type: txType || undefined,
          category: category || undefined,
          job_id: jobId || undefined,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Search Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Search across every statement processed on this server.
        </p>
      </div>

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input placeholder="Keyword in description or reference…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Input type="date" aria-label="From date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <Input type="date" aria-label="To date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <Select value={txType} onChange={(e) => setTxType(e.target.value)}>
            <option value="">All types</option>
            <option value="Debit">Debit</option>
            <option value="Credit">Credit</option>
            <option value="Opening Balance">Opening Balance</option>
            <option value="Unknown">Unknown</option>
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {["Salary", "Transfer", "POS", "ATM", "Charges", "Interest", "Bills", "Refund", "Loan", "Investment", "Tax", "Other"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <Input type="number" placeholder="Min amount" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
          <Input type="number" placeholder="Max amount" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
          <Input type="number" placeholder="Exact balance" value={balance} onChange={(e) => setBalance(e.target.value)} />
          <Select value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">All statements</option>
            {jobs.filter((j) => j.status === "completed").map((j) => (
              <option key={j.job_id} value={j.job_id}>
                {j.filename}
              </option>
            ))}
          </Select>
          <Button onClick={run} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}
            Search
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Quick range:</span>
          <Button variant="outline" size="sm" onClick={setToday}>Today</Button>
          <Button variant="outline" size="sm" onClick={setYesterday}>Yesterday</Button>
          <Button variant="outline" size="sm" onClick={setThisMonth}>This Month</Button>
          <Button variant="ghost" size="sm" onClick={clearRange}>Clear dates</Button>
        </div>
      </Card>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {result && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{result.count.toLocaleString()} matches</Badge>
          <Badge variant="outline">Credits: {formatMoney(result.total_credits)}</Badge>
          <Badge variant="outline">Debits: {formatMoney(result.total_debits)}</Badge>
        </div>
      )}

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Source</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(result?.rows ?? []).map((row, i) => (
              <TableRow key={i}>
                <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground" title={row.filename ?? ""}>
                  {row.filename ?? row.job_id}
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{row.tx_date ?? "—"}</TableCell>
                <TableCell className="max-w-[300px]">
                  <span className="line-clamp-2">{row.description || "—"}</span>
                </TableCell>
                <TableCell className="max-w-[120px] truncate text-xs text-muted-foreground">{row.reference || "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  <Badge variant="secondary" className="font-normal">{row.category || "Other"}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums text-red-600 dark:text-red-400">
                  {row.debit !== null && row.debit !== undefined ? formatMoney(row.debit) : ""}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                  {row.credit !== null && row.credit !== undefined ? formatMoney(row.credit) : ""}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">
                  {row.balance !== null && row.balance !== undefined ? formatMoney(row.balance) : ""}
                </TableCell>
              </TableRow>
            ))}
            {(result?.rows ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  {loading ? "Searching…" : "No matching transactions."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
