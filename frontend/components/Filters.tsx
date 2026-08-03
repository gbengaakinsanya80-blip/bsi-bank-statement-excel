"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export interface FiltersState {
  q: string;
  preset: "all" | "today" | "yesterday" | "this_month" | "custom";
  date_from: string;
  date_to: string;
  direction: "all" | "debit" | "credit";
  amount_min: string;
  amount_max: string;
}

export const EMPTY_FILTERS: FiltersState = {
  q: "",
  preset: "all",
  date_from: "",
  date_to: "",
  direction: "all",
  amount_min: "",
  amount_max: "",
};

interface FiltersProps {
  value: FiltersState;
  onChange: (next: FiltersState) => void;
  onClear: () => void;
}

export function Filters({ value, onChange, onClear }: FiltersProps) {
  const set = <K extends keyof FiltersState>(key: K, val: FiltersState[K]) =>
    onChange({ ...value, [key]: val });

  const hasActive =
    value.q || value.preset !== "all" || value.date_from || value.date_to ||
    value.direction !== "all" || value.amount_min || value.amount_max;

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3">
      <div className="relative min-w-[180px] flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search keyword, description or reference…"
          className="pl-8"
          value={value.q}
          onChange={(e) => set("q", e.target.value)}
        />
      </div>
      <div>
        <Select value={value.preset} onChange={(e) => set("preset", e.target.value as FiltersState["preset"])}>
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="this_month">This month</option>
          <option value="custom">Custom dates</option>
        </Select>
      </div>
      {value.preset === "custom" && (
        <>
          <Input
            type="date"
            aria-label="From date"
            className="w-auto"
            value={value.date_from}
            onChange={(e) => set("date_from", e.target.value)}
          />
          <Input
            type="date"
            aria-label="To date"
            className="w-auto"
            value={value.date_to}
            onChange={(e) => set("date_to", e.target.value)}
          />
        </>
      )}
      <Select value={value.direction} onChange={(e) => set("direction", e.target.value as FiltersState["direction"])}>
        <option value="all">All entries</option>
        <option value="debit">Debit only</option>
        <option value="credit">Credit only</option>
      </Select>
      <Input
        type="number"
        placeholder="Min amount"
        className="w-28"
        value={value.amount_min}
        onChange={(e) => set("amount_min", e.target.value)}
      />
      <Input
        type="number"
        placeholder="Max amount"
        className="w-28"
        value={value.amount_max}
        onChange={(e) => set("amount_max", e.target.value)}
      />
      {hasActive && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="h-4 w-4" /> Clear
        </Button>
      )}
    </div>
  );
}
