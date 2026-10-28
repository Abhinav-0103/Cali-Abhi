"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberField, Segmented } from "@/components/onboarding/fields";
import { logRetest } from "@/app/(app)/progress/actions";
import { localIsoDate } from "@/lib/dates";
import { TrendChart } from "./charts";

export type BaselineRow = {
  tested_on: string;
  push_ups: number;
  pull_ups: number;
  squats: number;
  plank_seconds: number;
  dead_hang_seconds: number;
};

const METRICS = [
  { key: "push_ups", field: "pushUps", label: "Push-ups", unit: "reps" },
  { key: "pull_ups", field: "pullUps", label: "Pull-ups", unit: "reps" },
  { key: "squats", field: "squats", label: "Squats", unit: "reps" },
  { key: "plank_seconds", field: "plankSeconds", label: "Plank", unit: "s" },
  { key: "dead_hang_seconds", field: "deadHangSeconds", label: "Dead hang", unit: "s" },
] as const;

export function BaselineSection({ tests }: { tests: BaselineRow[] }) {
  const [metric, setMetric] = useState<(typeof METRICS)[number]["key"]>("push_ups");
  const current = METRICS.find((m) => m.key === metric)!;
  const points = tests.map((t) => ({ date: t.tested_on, value: t[metric] }));

  return (
    <div className="space-y-4">
      <Segmented id="baseline-metric" legend="Metric" value={metric} onChange={setMetric} options={METRICS.map((m) => ({ value: m.key, label: m.label }))} />
      {points.length > 1 ? (
        <TrendChart name={`Max ${current.label.toLowerCase()}`} unit={current.unit} points={points} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Your starting point: <span className="font-medium text-foreground">{points[0]?.value ?? "–"} {current.unit}</span>. Retest
          every 4 weeks to see your progress here.
        </p>
      )}
      <RetestForm />
    </div>
  );
}

function RetestForm() {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [date, setDate] = useState(() => localIsoDate());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Log a retest
      </Button>
    );
  }

  const num = (s: string | undefined) => (s === undefined || s.trim() === "" ? undefined : Number(s));

  return (
    <form
      noValidate
      className="space-y-4 rounded-lg border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await logRetest({
            date,
            ...Object.fromEntries(METRICS.map((m) => [m.field, num(values[m.field])])),
          });
          if (result.ok) {
            toast.success("Retest saved");
            setOpen(false);
            setValues({});
            setErrors({});
          } else {
            setErrors(result.errors ?? {});
            toast.error(result.message);
          }
        });
      }}
    >
      <p className="text-sm text-muted-foreground">Warm up, then do each test once with good form. Rest 2–3 minutes between tests.</p>
      <div className="space-y-2">
        <Label htmlFor="retest-date">Date</Label>
        <Input id="retest-date" type="date" value={date} max={localIsoDate()} onChange={(e) => setDate(e.target.value)} className="max-w-44" />
        {errors.date && <p role="alert" className="text-sm text-destructive">{errors.date}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {METRICS.map((m) => (
          <NumberField
            key={m.field}
            id={`retest-${m.field}`}
            label={m.label}
            suffix={m.unit}
            value={values[m.field] ?? ""}
            onChange={(v) => setValues((s) => ({ ...s, [m.field]: v }))}
            error={errors[m.field]}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save retest"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
