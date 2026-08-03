"use client";

import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  label?: string;
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-muted-foreground">{label ?? "Processing"}</span>
        <span className="tabular-nums text-muted-foreground">{clamped}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {steps.map((step, i) => (
        <li key={step} className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold",
              i < current
                ? "border-primary bg-primary text-primary-foreground"
                : i === current
                  ? "border-primary text-primary"
                  : "border-muted-foreground/40 text-muted-foreground",
            )}
          >
            {i + 1}
          </span>
          <span
            className={cn(
              i === current ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {step}
          </span>
          {i < steps.length - 1 && <span className="h-px w-4 bg-border" />}
        </li>
      ))}
    </ol>
  );
}
