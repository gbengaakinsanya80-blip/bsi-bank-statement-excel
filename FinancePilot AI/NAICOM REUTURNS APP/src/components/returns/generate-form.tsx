"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Select } from "@/components/ui/field";
import { generateReturnAction } from "@/lib/returns/return-actions";
import { periodsForFrequency, periodYearOptions } from "@/lib/returns/periods";
import type { ReturnFrequency } from "@/lib/returns/definitions";

export function GenerateForm({
  code,
  frequency,
  compact = false,
}: {
  code: string;
  frequency: ReturnFrequency;
  compact?: boolean;
}) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const years = periodYearOptions();
  const [year, setYear] = useState(currentYear);
  const [periodKey, setPeriodKey] = useState(
    () => periodsForFrequency(frequency, currentYear)[0]?.key ?? ""
  );
  const [adhocStart, setAdhocStart] = useState(`${currentYear}-01-01`);
  const [adhocEnd, setAdhocEnd] = useState(`${currentYear}-12-31`);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periods = periodsForFrequency(frequency, year);
  const isAdHoc = frequency === "AD_HOC";

  function onYearChange(nextYear: string) {
    const y = Number(nextYear);
    setYear(y);
    const ps = periodsForFrequency(frequency, y);
    setPeriodKey(ps[0]?.key ?? "");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const key = isAdHoc ? `${adhocStart}_to_${adhocEnd}` : periodKey;
      if (!key) {
        setError("Select a period first.");
        setPending(false);
        return;
      }
      const res = await generateReturnAction(code, key);
      if (!res.ok) {
        setError(res.error);
        setPending(false);
        return;
      }
      router.push(`/returns/${res.id}`);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {!isAdHoc && (
        <div className={compact ? "flex items-end gap-2" : "grid grid-cols-2 gap-3"}>
          <Field label="Period">
            <Select value={periodKey} onChange={(e) => setPeriodKey(e.target.value)}>
              {periods.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Year">
            <Select value={String(year)} onChange={(e) => onYearChange(e.target.value)}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      {isAdHoc && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <Input
              type="date"
              value={adhocStart}
              onChange={(e) => setAdhocStart(e.target.value)}
              required
            />
          </Field>
          <Field label="To">
            <Input
              type="date"
              value={adhocEnd}
              onChange={(e) => setAdhocEnd(e.target.value)}
              required
            />
          </Field>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCcw className="h-4 w-4" />
        )}
        {pending ? "Generating…" : "Generate return"}
      </Button>
    </form>
  );
}
