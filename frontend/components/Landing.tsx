"use client";

import * as React from "react";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  FileSpreadsheet,
  FileText,
  Layers,
  LineChart,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Target,
  UploadCloud,
  Wand2,
} from "lucide-react";
import { UploadDropzone } from "@/components/UploadDropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function Reveal({
  children,
  className,
  delay,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-visible");
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("reveal", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

function useCountUp(target: number, inView: boolean, duration = 1600) {
  const [value, setValue] = React.useState(0);

  React.useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, duration]);

  return value;
}

function BackgroundFX() {
  const stars = [
    { left: "8%", top: "16%", delay: "0s" },
    { left: "16%", top: "58%", delay: "1.2s" },
    { left: "28%", top: "10%", delay: "0.6s" },
    { left: "55%", top: "8%", delay: "1.8s" },
    { left: "68%", top: "46%", delay: "0.4s" },
    { left: "86%", top: "18%", delay: "1s" },
    { left: "92%", top: "60%", delay: "2.2s" },
  ];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-grid bg-grid-pan mask-fade-x opacity-60" />
      <div className="absolute -left-32 -top-24 h-[480px] w-[480px] animate-aurora rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute -right-24 top-32 h-[440px] w-[440px] animate-aurora-slow rounded-full bg-indigo-500/15 blur-3xl" />
      <div className="absolute -bottom-24 left-1/4 h-[420px] w-[420px] animate-aurora rounded-full bg-emerald-500/15 blur-3xl [animation-delay:2.4s]" />
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute h-1 w-1 animate-twinkle rounded-full bg-primary/70"
          style={{ left: s.left, top: s.top, animationDelay: s.delay }}
        />
      ))}
    </div>
  );
}

function Chip({
  icon: Icon,
  tone,
  label,
}: {
  icon: typeof Sparkles;
  tone: "primary" | "emerald" | "indigo" | "amber";
  label: string;
}) {
  const tones = {
    primary: "text-primary",
    emerald: "text-emerald-500",
    indigo: "text-indigo-500",
    amber: "text-amber-500",
  } as const;

  return (
    <div className="flex items-center gap-2 rounded-full border border-primary/15 bg-card/85 px-3 py-1.5 text-xs font-semibold shadow-xl shadow-black/5 backdrop-blur">
      <Icon className={cn("h-3.5 w-3.5", tones[tone])} />
      {label}
    </div>
  );
}

const TXS = [
  { date: "01/03/26", desc: "Salary · Zenith", credit: "2,450,000.00" },
  { date: "01/03/26", desc: "POS · SHOPRITE ABUJA", debit: "45,300.00" },
  { date: "02/03/26", desc: "TRF/882244917/00", debit: "120,000.00" },
  { date: "02/03/26", desc: "ATM WITHDRAWAL · UBA", debit: "50,000.00" },
  { date: "03/03/26", desc: "Interest Paid", credit: "1,842.15" },
];

function StatementCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card/80 p-5 shadow-2xl shadow-primary/5 backdrop-blur">
      <div className="pointer-events-none absolute inset-x-3 h-20 animate-scan rounded-xl bg-gradient-to-b from-transparent via-primary/20 to-transparent" />
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
            <FileText className="h-5 w-5" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold leading-tight">Statement_0342.pdf</p>
            <p className="text-[11px] text-muted-foreground">17 pages · scanned + text · 1.2 MB</p>
          </div>
        </div>
        <span className="rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          1 of 17
        </span>
      </div>

      <div className="space-y-1.5">
        {TXS.map((t) => (
          <div
            key={t.desc}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="shrink-0 rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {t.date}
              </span>
              <span className="truncate text-xs font-medium">{t.desc}</span>
            </div>
            <span
              className={cn(
                "shrink-0 font-mono text-xs font-semibold",
                t.debit ? "text-rose-500" : "text-emerald-500",
              )}
            >
              {t.debit ? `-${t.debit}` : `+${t.credit}`}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
        <span>1,284 transactions detected</span>
        <span className="flex items-center gap-1">
          <ScanSearch className="h-3.5 w-3.5" /> Layout + OCR
        </span>
      </div>
    </div>
  );
}

const CELLS = [
  ["01/03/26", "Salary · Zenith", "+2,450,000.00", "2,450,000.00"],
  ["01/03/26", "POS · SHOPRITE", "-45,300.00", "2,404,700.00"],
  ["02/03/26", "TRF/882244917/00", "-120,000.00", "2,284,700.00"],
  ["02/03/26", "ATM WITHDRAWAL", "-50,000.00", "2,234,700.00"],
  ["03/03/26", "Interest Paid", "+1,842.15", "2,236,542.15"],
];

function ExcelCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-emerald-500/25 bg-card/80 shadow-2xl shadow-emerald-500/5 backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
            <FileSpreadsheet className="h-4 w-4" />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold leading-tight">Statement_0342.xlsx</p>
            <p className="text-[10px] text-muted-foreground">6 sheets · 128 KB</p>
          </div>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
          <BadgeCheck className="h-3 w-3" /> Validated
        </span>
      </div>

      <div className="flex gap-1 border-b border-border/60 bg-background/40 px-3 pt-2">
        {["Transactions", "Summary", "Validation", "Insights", "Charts"].map((t, i) => (
          <span
            key={t}
            className={cn(
              "rounded-t-md px-2.5 py-1 font-mono text-[10px]",
              i === 0
                ? "border border-b-0 border-border/60 bg-card font-bold text-foreground"
                : "text-muted-foreground",
            )}
          >
            {t}
          </span>
        ))}
      </div>

      <div className="flex-1 p-3">
        <div className="overflow-hidden rounded-lg border border-border/50 font-mono text-[10px]">
          <div className="grid grid-cols-[56px_1fr_auto_auto] gap-px bg-border/50">
            {["Date", "Description", "Amount", "Balance"].map((h) => (
              <div key={h} className="bg-primary px-2 py-1.5 font-bold text-primary-foreground">
                {h}
              </div>
            ))}
            {CELLS.flatMap((r) => r).map((c, i) => (
              <div
                key={i}
                className={cn(
                  "bg-card px-2 py-1.5",
                  i % 4 === 2 && (c.startsWith("-") ? "text-rose-500" : "text-emerald-500"),
                )}
              >
                {c}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/30 px-4 py-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <BadgeCheck className="h-3 w-3 text-emerald-500" /> +2,452,342.15 credits
        </span>
        <span className="flex items-center gap-1">
          <Wand2 className="h-3 w-3" /> Excel · CSV · JSON · PDF · SQLite
        </span>
      </div>
    </div>
  );
}

function FlowConnector() {
  return (
    <div className="flex items-center justify-center gap-4 sm:flex-col sm:gap-3">
      <div className="relative hidden h-28 w-px bg-gradient-to-b from-primary/30 via-primary to-emerald-500/50 sm:block">
        <span className="absolute -left-[3px] top-0 h-1.5 w-1.5 animate-travel rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-card/85 px-3 py-1 text-[11px] font-medium shadow-lg shadow-black/5 backdrop-blur">
          <ScanSearch className="h-3.5 w-3.5 text-primary" /> OCR + layout detection
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-card/85 px-3 py-1 text-[11px] font-medium shadow-lg shadow-black/5 backdrop-blur">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Mathematical validation
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-card/85 px-3 py-1 text-[11px] font-medium shadow-lg shadow-black/5 backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> AI insights
        </div>
      </div>
    </div>
  );
}

function Showcase() {
  return (
    <div className="relative">
      <div className="absolute -left-4 top-8 z-10 hidden animate-float lg:-left-16 lg:block">
        <Chip icon={BadgeCheck} tone="emerald" label="Balances reconciled" />
      </div>
      <div className="absolute -right-4 top-24 z-10 hidden animate-float-slow lg:-right-16 lg:block">
        <Chip icon={ShieldCheck} tone="primary" label="Zero rows skipped" />
      </div>
      <div className="absolute -left-6 bottom-24 z-10 hidden animate-float lg:-left-20 lg:block">
        <Chip icon={LineChart} tone="indigo" label="AI insights & forecast" />
      </div>
      <div className="absolute -right-6 bottom-8 z-10 hidden animate-float-slow lg:-right-20 lg:block">
        <Chip icon={Layers} tone="amber" label="Batch ready" />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-[1fr_auto_1.1fr] sm:gap-4 lg:gap-6">
        <StatementCard />
        <FlowConnector />
        <ExcelCard />
      </div>
    </div>
  );
}

const STATS = [
  { icon: Target, value: 99.9, decimals: 1, suffix: "%", label: "Field extraction accuracy target" },
  { icon: BadgeCheck, value: 100, decimals: 0, suffix: "%", label: "Transaction count accuracy" },
  { icon: FileText, value: 500, decimals: 0, suffix: "+", label: "Pages supported per statement" },
  { icon: FileSpreadsheet, value: 5, decimals: 0, suffix: "", label: "Export formats" },
];

function Stat({
  icon: Icon,
  value,
  decimals,
  suffix,
  label,
}: {
  icon: typeof Target;
  value: number;
  decimals: number;
  suffix: string;
  label: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const n = useCountUp(value, inView);

  return (
    <div ref={ref} className="flex flex-col items-center gap-1 text-center">
      <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
        {n.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}
        {suffix}
      </p>
      <p className="max-w-[180px] text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function StatsBand() {
  return (
    <Reveal>
      <div className="grid gap-10 rounded-2xl border border-primary/10 bg-card/50 p-8 backdrop-blur sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
        {STATS.map((s) => (
          <Stat key={s.label} {...s} />
        ))}
      </div>
    </Reveal>
  );
}

const STEPS = [
  {
    icon: UploadCloud,
    title: "Upload",
    body: "Drop one PDF or a whole batch — text, scanned, rotated, even 500+ page statements.",
  },
  {
    icon: ScanSearch,
    title: "AI extracts & validates",
    body: "OCR + layout detection reads every line. Every balance is reconciled mathematically.",
  },
  {
    icon: FileSpreadsheet,
    title: "Export clean Excel",
    body: "Transactions, summary, validation, AI insights and native charts — audit-ready.",
  },
];

function HowItWorks() {
  return (
    <div className="grid gap-6 sm:grid-cols-3">
      {STEPS.map((s, i) => (
        <Reveal key={s.title} delay={i * 120}>
          <div className="relative h-full">
            {i < STEPS.length - 1 && (
              <div
                aria-hidden
                className="absolute right-[-14px] top-10 hidden w-8 border-t-2 border-dashed border-primary/30 sm:block"
              />
            )}
            <Card className="h-full border-primary/10 bg-card/60 backdrop-blur transition-colors hover:border-primary/40">
              <CardContent className="flex h-full flex-col gap-3 p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-bold">
                  <span className="mr-1.5 text-primary">{i + 1}.</span>
                  {s.title}
                </p>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </CardContent>
            </Card>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

const FEATURES = [
  {
    icon: ScanSearch,
    title: "Hybrid AI extraction",
    body: "OCR + layout detection understands any bank layout — 17 templates included, auto-detect for the rest.",
  },
  {
    icon: ShieldCheck,
    title: "Validation engine",
    body: "Balances reconciled, duplicates removed, missing rows flagged — nothing is ever silently skipped.",
  },
  {
    icon: FileSpreadsheet,
    title: "Professional Excel output",
    body: "Transactions, summary, validation, insights and native charts across six sheets.",
  },
  {
    icon: Layers,
    title: "Batch processing",
    body: "Upload several statements at once and switch between results instantly.",
  },
];

function FeatureGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {FEATURES.map((f, i) => (
        <Reveal key={f.title} delay={i * 100}>
          <Card className="group relative h-full overflow-hidden border-primary/10 bg-card/60 backdrop-blur transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10">
            <CardContent className="p-6">
              <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-2.5 text-primary transition-transform group-hover:rotate-3 group-hover:scale-110">
                <f.icon className="h-5 w-5" />
              </div>
              <p className="text-sm font-bold">{f.title}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 scale-x-0 bg-gradient-to-r from-primary to-emerald-500 transition-transform duration-300 group-hover:scale-x-100"
              />
            </CardContent>
          </Card>
        </Reveal>
      ))}
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <Reveal className="mx-auto mb-10 max-w-2xl text-center">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{title}</h2>
    </Reveal>
  );
}

function FinalCTA({ onClick }: { onClick: () => void }) {
  return (
    <Reveal>
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card/60 to-emerald-500/10 px-8 py-14 text-center backdrop-blur">
        <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 animate-aurora rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 animate-aurora-slow rounded-full bg-emerald-500/15 blur-3xl" />
        <h2 className="relative text-3xl font-black tracking-tight sm:text-4xl">
          Convert your first statement now
        </h2>
        <p className="relative mx-auto mt-3 max-w-xl text-muted-foreground">
          Drop a PDF above and get a validated Excel workbook in minutes — not hours.
        </p>
        <Button
          onClick={onClick}
          className="relative mt-8 h-12 px-8 text-base font-bold shadow-lg shadow-primary/20"
        >
          Upload a statement
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </Reveal>
  );
}

export function Landing({ onFiles }: { onFiles: (files: File[]) => void }) {
  const dropzoneRef = React.useRef<HTMLDivElement>(null);

  const scrollToDrop = () =>
    dropzoneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

  return (
    <section className="relative overflow-hidden">
      <BackgroundFX />

      <div className="container relative pb-20 pt-14 sm:pt-20">
        <div className="mx-auto max-w-4xl space-y-6 text-center">
          <span className="inline-flex animate-rise items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            AI-powered statement intelligence
          </span>

          <h1 className="animate-rise [animation-delay:0.12s]">
            <span className="animate-shimmer bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text bg-[length:200%_auto] text-4xl font-black leading-tight tracking-tight text-transparent sm:text-5xl lg:text-6xl">
              Turn any bank statement into a clean Excel workbook
            </span>
          </h1>

          <p className="mx-auto max-w-xl animate-rise text-base text-muted-foreground [animation-delay:0.24s] sm:text-lg">
            AI-powered extraction from text and scanned PDFs — every transaction, every balance,
            mathematically validated, ready for accounting and audit.
          </p>

          <div ref={dropzoneRef} className="relative mx-auto max-w-2xl animate-rise [animation-delay:0.36s]">
            <div className="pointer-events-none absolute -inset-8 -z-10 animate-glow-pulse rounded-[3rem] bg-gradient-to-r from-primary/25 via-indigo-500/20 to-emerald-500/25 blur-3xl" />
            <UploadDropzone onFiles={onFiles} multiple />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 animate-rise text-xs text-muted-foreground [animation-delay:0.48s] sm:text-sm">
            <span className="flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4 text-emerald-500" /> 99.9% extraction accuracy
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" /> Zero skipped transactions
            </span>
            <span className="flex items-center gap-1.5">
              <Banknote className="h-4 w-4 text-amber-500" /> 17 bank layouts + auto-detect
            </span>
          </div>
        </div>

        <div className="relative mx-auto mt-16 max-w-5xl sm:mt-24">
          <div className="pointer-events-none absolute inset-0 -z-10 scale-90 animate-glow-pulse rounded-[3rem] bg-gradient-to-tr from-primary/15 via-indigo-500/10 to-emerald-500/15 blur-3xl" />
          <Showcase />
        </div>

        <div className="mt-16 sm:mt-24">
          <StatsBand />
        </div>

        <div className="mt-16 sm:mt-24">
          <SectionHeading eyebrow="How it works" title="From PDF to workbook in minutes" />
          <HowItWorks />
        </div>

        <div className="mt-16 sm:mt-24">
          <SectionHeading eyebrow="Why Bank Statement Intelligence" title="Built for accounting, audit & analysis" />
          <FeatureGrid />
        </div>

        <div className="mt-16 sm:mt-24">
          <FinalCTA onClick={scrollToDrop} />
        </div>
      </div>
    </section>
  );
}
