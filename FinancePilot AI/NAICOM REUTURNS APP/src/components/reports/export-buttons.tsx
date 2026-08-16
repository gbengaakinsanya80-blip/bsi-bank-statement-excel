import { FileSpreadsheet, FileDown } from "lucide-react";

export function ExportButtons({
  params,
  kind,
  group,
}: {
  params: Record<string, string>;
  kind: "premium" | "commission" | "builder" | "compliance";
  group?: "client_name" | "insurer_name" | "risk_type";
}) {
  const base: Record<string, string> = { kind, ...params };
  if (group) base.group = group;

  const link = (format: "xlsx" | "csv") => {
    const qs = new URLSearchParams({ ...base, format }).toString();
    return `/api/reports/export?${qs}`;
  };

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={link("xlsx")}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
      >
        <FileSpreadsheet className="h-3.5 w-3.5" />
        Export Excel
      </a>
      <a
        href={link("csv")}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
      >
        <FileDown className="h-3.5 w-3.5" />
        Export CSV
      </a>
    </div>
  );
}
