import { Filter, RotateCcw } from "lucide-react";
import type { ReportFilters } from "@/lib/services/reporting-service";

export function ReportFiltersForm({
  basePath,
  filters,
  clients = [],
  insurers = [],
  risks = [],
  currencies = [],
}: {
  basePath: string;
  filters: ReportFilters;
  clients?: string[];
  insurers?: string[];
  risks?: string[];
  currencies?: string[];
}) {
  return (
    <form method="get" action={basePath} className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="rf-from">From</label>
        <input
          id="rf-from"
          name="from"
          type="date"
          defaultValue={filters.from}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="rf-to">To</label>
        <input
          id="rf-to"
          name="to"
          type="date"
          defaultValue={filters.to}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        />
      </div>
      <SelectField label="Client" name="client" value={filters.client} options={clients} />
      <SelectField label="Insurer" name="insurer" value={filters.insurer} options={insurers} />
      <SelectField label="Risk class" name="risk" value={filters.risk} options={risks} />
      <SelectField label="Currency" name="currency" value={filters.currency} options={currencies} />
      <button
        type="submit"
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
      >
        <Filter className="h-4 w-4" />
        Apply
      </button>
      <a
        href={basePath}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium text-muted-foreground hover:bg-accent"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Clear
      </a>
    </form>
  );
}

function SelectField({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value?: string;
  options: string[];
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground" htmlFor={`rf-${name}`}>
        {label}
      </label>
      <select
        id={`rf-${name}`}
        name={name}
        defaultValue={value ?? ""}
        className="h-9 min-w-36 rounded-md border bg-background px-3 text-sm"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
