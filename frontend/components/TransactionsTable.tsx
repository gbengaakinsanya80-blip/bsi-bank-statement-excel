"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatDate, formatMoney } from "@/lib/utils";

export type Row = {
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

interface TransactionsTableProps {
  rows: Row[];
  currency: string;
  exporting?: boolean;
  onExport?: (format: "xlsx" | "csv" | "json" | "pdf" | "sqlite") => void;
}

type SortKey = "date" | "debit" | "credit" | "balance";

export function TransactionsTable({ rows, currency, exporting, onExport }: TransactionsTableProps) {
  const [sortKey, setSortKey] = React.useState<SortKey | null>(null);
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

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

  return (
    <div className="space-y-3">
      {onExport && (
        <div className="flex flex-wrap items-center justify-end gap-2">
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
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead><SortHeader label="Date" k="date" /></TableHead>
              <TableHead>Value Date</TableHead>
              <TableHead className="w-[34%]">Description</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right"><SortHeader label="Debit" k="debit" /></TableHead>
              <TableHead className="text-right"><SortHeader label="Credit" k="credit" /></TableHead>
              <TableHead className="text-right"><SortHeader label="Balance" k="balance" /></TableHead>
              <TableHead>Pg</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row, i) => (
              <TableRow
                key={i}
                className={cn(
                  row.is_beginning_balance || row.is_ending_balance ? "bg-muted/40 font-medium" : "",
                  row.is_estimated && "bg-amber-50 dark:bg-amber-950/20",
                )}
              >
                <TableCell className="whitespace-nowrap tabular-nums">{formatDate(row.date)}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDate(row.value_date)}</TableCell>
                <TableCell className="max-w-[340px]">
                  <span className="line-clamp-2">{row.description || "—"}</span>
                  {row.is_estimated && <Badge variant="warning" className="ml-1 align-middle">uncertain</Badge>}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{row.reference || "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  <Badge variant="secondary" className="font-normal">{row.category || "Other"}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums text-red-600 dark:text-red-400">
                  {row.debit !== null ? formatMoney(row.debit, row.currency) : ""}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                  {row.credit !== null ? formatMoney(row.credit, row.currency) : ""}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">{formatMoney(row.balance, row.currency)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{row.page_number}</TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
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
