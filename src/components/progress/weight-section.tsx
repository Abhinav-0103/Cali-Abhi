"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logWeight } from "@/app/(app)/progress/actions";
import { localIsoDate } from "@/lib/dates";
import { kgFromLb, lbFromKg } from "@/lib/units";
import { TrendChart } from "./charts";

export function WeightSection({ logs, unitSystem }: { logs: { logged_on: string; weight_kg: number }[]; unitSystem: "metric" | "imperial" }) {
  const metric = unitSystem === "metric";
  const unit = metric ? "kg" : "lb";
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(() => localIsoDate());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const points = logs.map((l) => ({ date: l.logged_on, value: metric ? Math.round(l.weight_kg * 10) / 10 : lbFromKg(l.weight_kg) }));

  return (
    <div className="space-y-4">
      {points.length > 1 ? (
        <TrendChart name="Body weight" unit={unit} points={points} />
      ) : (
        <p className="text-sm text-muted-foreground">Log your weight once a week or so to see a trend.</p>
      )}
      <form
        noValidate
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const value = weight.trim() === "" ? undefined : Number(weight);
          startTransition(async () => {
            const result = await logWeight({ date, weightKg: value === undefined || metric ? value : kgFromLb(value) });
            if (result.ok) {
              toast.success("Weight saved");
              setWeight("");
              setErrors({});
            } else {
              setErrors(result.errors ?? {});
            }
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="weight-value">Weight ({unit})</Label>
          <Input
            id="weight-value"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            aria-invalid={errors.weightKg ? true : undefined}
            aria-describedby={errors.weightKg ? "weight-error" : undefined}
            className="w-28"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weight-date">Date</Label>
          <Input id="weight-date" type="date" value={date} max={localIsoDate()} onChange={(e) => setDate(e.target.value)} className="w-40" />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Log weight"}
        </Button>
        {(errors.weightKg || errors.date) && (
          <p id="weight-error" role="alert" className="w-full text-sm text-destructive">
            {errors.weightKg ?? errors.date}
          </p>
        )}
      </form>
    </div>
  );
}
