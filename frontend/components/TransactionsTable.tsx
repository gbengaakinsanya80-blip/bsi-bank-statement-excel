"use client";

import * as React from "react";
import { Check, ChevronDown, ChevronUp, FileDown, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import type { TransactionEdit } from "@/lib/api";

export type Row = {
  i: number;
  date: string | null;
  value_date: string | null;
  description: string;
  reference: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  currency: string;
  is_beginning_balance: boolean;
  is_ending_balance: boolean;
  is_estimated: boolean;
  category: string;
  page_number: number;
  line_number: number;
};

type DraftFields = {
  date?: string;
  description?: string;
  debit?: number | "";
  credit?: number | "";
  category?: string;
};

interface TransactionsTableProps {
  rows: Row[];
  exporting?: boolean;
  onExport?: (format: "xlsx" | "csv" | "json" | "pdf" | "sqlite") => void;
  editable?: boolean;
  onApplyEdits?: (edits: TransactionEdit[]) => Promise<void> | void;
}

type SortKey = "date" | "debit" | "credit" | "balance";

const inputCls =
  "w-full rounded-md border border-input bg-background px-2 py-1 text-xs outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/30";

export function TransactionsTable({ rows, exporting, onExport, editable, onApplyEdits }: TransactionsTableProps) {
  const [sortKey, setSortKey] = React.useState<SortKey | null>(null);
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [drafts, setDrafts] = React.useState<Record<number, DraftFields>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!editable) setDrafts({});
  }, [editable]);

  const setField = (i: number, field: keyof DraftFields, value: string | number) => {
    setDrafts((prev) => ({ ...prev, [i]: { ...prev[i], [field]: value } }));
  };

  const clearField = (i: number, field: keyof DraftFields) => {
    setDrafts((prev) => {
      const next = { ...(prev[i] ?? {}) };
      delete next[field];
      const out = { ...prev };
      if (Object.keys(next).length === 0) delete out[i];
      else out[i] = next;
      return out;
    });
  };

  const handleApply = async () => {
    if (!onApplyEdits) return;
    const edits: TransactionEdit[] = Object.entries(drafts).map(([idx, f]) => {
      const fields: TransactionEdit["fields"] = {};
      if (f.date !== undefined) fields.date = f.date;
      if (f.description !== undefined) fields.description = f.description;
      if (f.category !== undefined) fields.category = f.category;
      if (f.debit !== undefined) fields.debit = f.debit === "" ? null : f.debit;
      if (f.credit !== undefined) fields.credit = f.credit === "" ? null : f.credit;
      return { transaction_index: Number(idx), fields };
    });
    if (edits.length === 0) return;
    setSaving(true);
    try {
      await onApplyEdits(edits);
      setDrafts({});
    } finally {
      setSaving(false);
    }
  };

  const hasDrafts = Object.keys(drafts).length > 0;

  const sorted = React.useMemo(() => {
    if (!sortKey) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      let av: number | null | string;
      let bv: number | null | string;
      if (sortKey === "date") {
        av = a.date ? new Date(a.date).getTime() : 0;
        bv = b.date ? new Date(b.date).getTime() : 0;
      } else {
        av = a[sortKey];
        bv = b[sortKey];
      }
      const cmp = av === bv ? 0 : av === null ? -1 : bv === null ? 1 : av > bv ? 1 : -1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(k)}>
      {label}
      {sortKey === k &&
        (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
    </button>
  );

  const categories = React.useMemo(() => {
    const set = new Set<string>(["POS", "Transfer", "Bills", "ATM", "Charges", "Loan", "Interest", "Other"]);
    for (const r of rows) if (r.category) set.add(r.category);
    return Array.from(set).sort();
  }, [rows]);

  const draft = (row: Row) => drafts[row.i];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {editable && (
          <p className="text-xs text-muted-foreground">
            {hasDrafts ? `${Object.keys(drafts).length} row${Object.keys(drafts).length === 1 ? "" : "s"} changed` : "Click any cell to correct a value"}
          </p>
        )}
        <div className={cn("flex flex-wrap items-center gap-2", !editable && "ml-auto")}>
          {onExport && (
            <div className="flex flex-wrap items-center gap-2">
              {(["xlsx", "csv", "json", "pdf", "sqlite"] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant="outline"
                  disabled={exporting}
                  onClick={() => onExport(f)}
                >
                  {exporting && f === "xlsx" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                  .{f.toUpperCase()}
                </Button>
              ))}
            </div>
          )}
          {editable && (
            <>
              <Button size="sm" variant="outline" onClick={() => setDrafts({})} disabled={!hasDrafts || saving}>
                <X className="h-3.5 w-3.5" /> Discard
              </Button>
              <Button size="sm" onClick={handleApply} disabled={!hasDrafts || saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Apply corrections
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead><SortHeader label="Date" k="date" /></TableHead>
              {editable && <TableHead>Value Date</TableHead>}
              <TableHead className={editable ? "w-[30%]" : "w-[34%]"}>Description</TableHead>
              {!editable && <TableHead>Reference</TableHead>}
              <TableHead>Category</TableHead>
              <TableHead className="text-right"><SortHeader label="Debit" k="debit" /></TableHead>
              <TableHead className="text-right"><SortHeader label="Credit" k="credit" /></TableHead>
              <TableHead className="text-right"><SortHeader label="Balance" k="balance" /></TableHead>
              <TableHead>Pg</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => {
              const d = draft(row);
              return (
                <TableRow
                  key={row.i}
                  className={cn(
                    row.is_beginning_balance || row.is_ending_balance ? "bg-muted/40 font-medium" : "",
                    row.is_estimated && "bg-amber-50 dark:bg-amber-950/20",
                    d && "bg-primary/5",
                  )}
                >
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {editable && !row.is_beginning_balance && !row.is_ending_balance ? (
                      <input
                        type="date"
                        className={inputCls}
                        value={d?.date ?? row.date ?? ""}
                        onChange={(e) => setField(row.i, "date", e.target.value)}
                        onKeyDown={(e) => e.key === "Escape" && clearField(row.i, "date")}
                      />
                    ) : (
                      formatDate(row.date)
                    )}
                  </TableCell>
                  {editable && (
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                      {formatDate(row.value_date)}
                    </TableCell>
                  )}
                  <TableCell className="max-w-[340px]">
                    {editable && !row.is_beginning_balance && !row.is_ending_balance ? (
                      <input
                        type="text"
                        className={inputCls}
                        placeholder={row.description || "—"}
                        value={d?.description ?? ""}
                        onChange={(e) => setField(row.i, "description", e.target.value)}
                        onKeyDown={(e) => e.key === "Escape" && clearField(row.i, "description")}
                      />
                    ) : (
                      <span className="line-clamp-2">
                        {row.description || "—"}
                        {row.is_estimated && <Badge variant="warning" className="ml-1 align-middle">uncertain</Badge>}
                      </span>
                    )}
                  </TableCell>
                  {!editable && (
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{row.reference || "—"}</TableCell>
                  )}
                  <TableCell className="whitespace-nowrap text-xs">
                    {editable && !row.is_beginning_balance && !row.is_ending_balance ? (
                      <select
                        className={inputCls}
                        value={d?.category ?? row.category ?? ""}
                        onChange={(e) => setField(row.i, "category", e.target.value)}
                      >
                        <option value="">Other</option>
                        {categories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    ) : (
                      <Badge variant="secondary" className="font-normal">{row.category || "Other"}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-red-600 dark:text-red-400">
                    {editable && !row.is_beginning_balance && !row.is_ending_balance ? (
                      <input
                        type="number"
                        step="0.01"
                        className={cn(inputCls, "text-right")}
                        placeholder={row.debit !== null ? row.debit.toFixed(2) : ""}
                        value={d?.debit ?? ""}
                        onChange={(e) => setField(row.i, "debit", e.target.value === "" ? "" : Number(e.target.value))}
                        onKeyDown={(e) => e.key === "Escape" && clearField(row.i, "debit")}
                      />
                    ) : (
                      row.debit !== null ? formatMoney(row.debit, row.currency) : ""
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {editable && !row.is_beginning_balance && !row.is_ending_balance ? (
                      <input
                        type="number"
                        step="0.01"
                        className={cn(inputCls, "text-right")}
                        placeholder={row.credit !== null ? row.credit.toFixed(2) : ""}
                        value={d?.credit ?? ""}
                        onChange={(e) => setField(row.i, "credit", e.target.value === "" ? "" : Number(e.target.value))}
                        onKeyDown={(e) => e.key === "Escape" && clearField(row.i, "credit")}
                      />
                    ) : (
                      row.credit !== null ? formatMoney(row.credit, row.currency) : ""
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{formatMoney(row.balance, row.currency)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.page_number}</TableCell>
                </TableRow>
              );
            })}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={editable ? 9 : 9} className="h-24 text-center text-muted-foreground">
                  No transactions match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
