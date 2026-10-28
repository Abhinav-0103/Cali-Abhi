"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipContentProps } from "recharts";
import { shortDate } from "@/lib/dates";

// Single-series charts in the validated brand teal (--chart-1). Text uses text
// tokens, never the series color. Every chart has a table view.

const SERIES = "var(--color-chart-1)";
const GRID = "var(--color-border)";
const AXIS = { fill: "var(--color-muted-foreground)", fontSize: 12 };

function ChartTooltip({ active, payload, label, unit }: TooltipContentProps & { unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-popover-foreground">
        {payload[0].value} {unit}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function DataTable({ caption, rows, unit }: { caption: string; rows: { label: string; value: number | string }[]; unit: string }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer rounded text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        Show as table
      </summary>
      <table className="mt-2 w-full text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b text-muted-foreground">
            <th scope="col" className="py-1 font-normal">Date</th>
            <th scope="col" className="py-1 text-right font-normal">{unit}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            // Two entries can share a date (e.g. two tests on one day).
            <tr key={i} className="border-b last:border-0">
              <td className="py-1">{r.label}</td>
              <td className="py-1 text-right tabular-nums">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export function AdherenceChart({ weeks }: { weeks: { weekStart: string; completed: number; target: number; percent: number }[] }) {
  const data = weeks.map((w) => ({ label: shortDate(w.weekStart), percent: w.percent, detail: `${w.completed}/${w.target}` }));
  const summary = `Weekly adherence for the last ${weeks.length} weeks: ${data.map((d) => `${d.label} ${d.percent}%`).join(", ")}`;
  return (
    <figure>
      <div role="img" aria-label={summary} className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={AXIS} tickLine={false} axisLine={false} unit="%" width={44} />
            <Tooltip cursor={{ fill: "var(--color-accent)" }} content={(p) => <ChartTooltip {...p} unit="%" />} />
            <Bar dataKey="percent" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable caption="Weekly adherence" unit="Workouts" rows={data.map((d) => ({ label: `Week of ${d.label}`, value: `${d.detail} (${d.percent}%)` }))} />
    </figure>
  );
}

export function TrendChart({ name, unit, points }: { name: string; unit: string; points: { date: string; value: number }[] }) {
  const data = points.map((p) => ({ label: shortDate(p.date), value: p.value }));
  const values = points.map((p) => p.value);
  const pad = Math.max(1, (Math.max(...values) - Math.min(...values)) * 0.2);
  const latest = points.at(-1);
  return (
    <figure>
      <div
        role="img"
        aria-label={`${name} over time: ${data.map((d) => `${d.label} ${d.value} ${unit}`).join(", ")}`}
        className="h-44"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis
              domain={[Math.max(0, Math.floor(Math.min(...values) - pad)), Math.ceil(Math.max(...values) + pad)]}
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip cursor={{ stroke: GRID, strokeWidth: 1 }} content={(p) => <ChartTooltip {...p} unit={unit} />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={SERIES}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={{ r: 4, fill: SERIES, stroke: "var(--color-card)", strokeWidth: 2 }}
              activeDot={{ r: 6, fill: SERIES, stroke: "var(--color-card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {latest && (
        <figcaption className="mt-1 text-sm text-muted-foreground">
          Latest: <span className="font-medium text-foreground">{latest.value} {unit}</span> on {shortDate(latest.date)}
        </figcaption>
      )}
      <DataTable caption={name} unit={unit} rows={data.map((d) => ({ label: d.label, value: d.value }))} />
    </figure>
  );
}
