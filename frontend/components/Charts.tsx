"use client";

import * as React from "react";
import { formatMoney } from "@/lib/utils";

const W = 640;
const H = 160;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

export interface BarSeries {
  name: string;
  value: number;
  color: string;
}

export interface BarDatum {
  label: string;
  series: BarSeries[];
}

export function GroupedBars({ data, currency }: { data: BarDatum[]; currency: string }) {
  const max = Math.max(1, ...data.flatMap((d) => d.series.map((s) => s.value)));
  const n = Math.max(1, data.length);
  const seriesCount = Math.max(1, data[0]?.series.length ?? 1);
  const groupW = W / n;
  const barW = Math.max(4, (groupW / seriesCount) * 0.55);
  const chartH = H - PAD_TOP - PAD_BOTTOM;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cash-flow trend chart">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={0}
            x2={W}
            y1={PAD_TOP + chartH * (1 - f)}
            y2={PAD_TOP + chartH * (1 - f)}
            stroke="currentColor"
            strokeOpacity="0.07"
          />
        ))}
        {data.map((d, i) => {
          const cx = groupW * i + groupW / 2;
          return (
            <g key={d.label}>
              {d.series.map((s, j) => {
                const bh = (s.value / max) * chartH;
                const x = cx - (barW * seriesCount) / 2 + j * barW;
                const y = PAD_TOP + chartH - bh;
                return (
                  <rect
                    key={s.name}
                    x={x}
                    y={y}
                    width={barW - 2}
                    height={Math.max(bh, 0.5)}
                    rx={3}
                    fill={s.color}
                    opacity={0.9}
                  >
                    <title>{`${s.name} ${d.label}: ${formatMoney(s.value, currency)}`}</title>
                  </rect>
                );
              })}
              <text
                x={cx}
                y={H - 6}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize="9"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        {data[0]?.series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export interface LinePoint {
  label: string;
  value: number | null;
  marker?: boolean;
}

export function LineChart({ points, currency }: { points: LinePoint[]; currency: string }) {
  const vals = points.map((p) => p.value).filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  const min = Math.min(0, ...vals);
  const max = Math.max(...vals, 1);
  const range = max - min || 1;
  const chartH = H - PAD_TOP - PAD_BOTTOM;
  const px = (i: number) => (points.length === 1 ? W / 2 : 8 + (i * (W - 16)) / (points.length - 1));
  const py = (v: number) => PAD_TOP + chartH - ((v - min) / range) * chartH;

  const baseline = PAD_TOP + chartH;
  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(p.value ?? 0).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${px(points.length - 1).toFixed(1)},${baseline} L${px(0).toFixed(1)},${baseline} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cash-flow forecast chart">
      <defs>
        <linearGradient id="bsi-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--tw-gradient-from, #6366f1)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((f) => (
        <line
          key={f}
          x1={0}
          x2={W}
          y1={PAD_TOP + chartH * (1 - f)}
          y2={PAD_TOP + chartH * (1 - f)}
          stroke="currentColor"
          strokeOpacity="0.07"
        />
      ))}
      <path d={area} fill="url(#bsi-area)" />
      <path d={line} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => {
        const v = p.value;
        if (v === null) return null;
        return (
          <g key={`${p.label}-${i}`}>
            <circle cx={px(i)} cy={py(v)} r={p.marker ? 4 : 2.5} fill={p.marker ? "#f59e0b" : "#6366f1"}>
              <title>{`${p.label}: ${formatMoney(v, currency)}`}</title>
            </circle>
            <text x={px(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground" fontSize="9">
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
