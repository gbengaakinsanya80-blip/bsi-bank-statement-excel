import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils/format";
import { RETURN_COLUMNS, type ReturnColumn } from "@/lib/returns/columns";
import type { ReturnRow } from "@/lib/returns/types";

const personnelFirstColumns = RETURN_COLUMNS.PERSONNEL_FIRST;
const personnelSecondColumns = RETURN_COLUMNS.PERSONNEL_SECOND;

function Cell({ column, value }: { column: ReturnColumn; value: unknown }) {
  if (value === null || value === undefined || value === "") return <TableCell>—</TableCell>;
  switch (column.type) {
    case "money":
      return (
        <TableCell className="whitespace-nowrap text-right">
          {formatMoney(Number(value), column.currency ?? "NGN")}
        </TableCell>
      );
    case "percent":
      return (
        <TableCell className="whitespace-nowrap text-right">
          {`${Number(value).toLocaleString("en-NG", { maximumFractionDigits: 2 })}%`}
        </TableCell>
      );
    case "number":
      return <TableCell className="text-right">{formatNumber(Number(value))}</TableCell>;
    case "date":
      return <TableCell className="whitespace-nowrap">{formatDate(String(value))}</TableCell>;
    default:
      return <TableCell>{String(value)}</TableCell>;
  }
}

export function ReturnTable({
  columns,
  rows,
  emptyLabel = "No rows generated for this period.",
}: {
  columns: ReturnColumn[];
  rows: ReturnRow[];
  emptyLabel?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.key}>{c.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                {emptyLabel}
              </TableCell>
            </TableRow>
          )}
          {rows.map((row, i) => (
            <TableRow key={i}>
              {columns.map((c) => (
                <Cell key={c.key} column={c} value={row[c.key]} />
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function PersonnelReturnTables({ rows }: { rows: ReturnRow[] }) {
  const first = rows.filter((r) => r.schedule === "FIRST");
  const second = rows.filter((r) => r.schedule === "SECOND");
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold">
          FIRST SCHEDULE — Statement of Personnel Returns
        </h3>
        <ReturnTable columns={personnelFirstColumns} rows={first} />
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">
          SECOND SCHEDULE — Summary of Personnel Changes During the Period
        </h3>
        <ReturnTable columns={personnelSecondColumns} rows={second} />
      </div>
    </div>
  );
}
