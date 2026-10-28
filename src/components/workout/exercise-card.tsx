"use client";

import { useEffect, useState } from "react";
import { Check, Minus, Pencil, Plus, Timer, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatTarget } from "@/lib/workout/logic";
import type { LocalExercise, LocalSet } from "@/lib/workout/types";
import { cn } from "@/lib/utils";
import { formatClock } from "./rest-timer";
import { RpePicker } from "./rpe-picker";

type Props = {
  exercise: LocalExercise;
  sets: LocalSet[];
  onLog: (setNumber: number, value: number) => void;
  onRemoveLast: () => void;
  onRpe: (rpe: number) => void;
  onSkip: (skipped: boolean) => void;
};

export function ExerciseCard({ exercise: e, sets, onLog, onRemoveLast, onRpe, onSkip }: Props) {
  const [extraRows, setExtraRows] = useState(0);
  const [editing, setEditing] = useState<number | null>(null);
  const rows = Math.max(e.planned_sets + extraRows, sets.length);
  const nextSet = sets.length + 1;
  const done = sets.length >= e.planned_sets;
  const unit = e.metric === "reps" ? "reps" : "seconds";
  const headingId = `ex-${e.id}`;

  return (
    <Card aria-labelledby={headingId} className={cn(e.skipped && "opacity-60")}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle id={headingId}>{e.name}</CardTitle>
          {e.skipped ? <Badge variant="secondary">Skipped</Badge> : done && <Badge>Done</Badge>}
        </div>
        <CardDescription>
          {e.planned_sets} × {formatTarget(e.target_min, e.target_max, e.metric, e.unilateral)} · rest {formatClock(e.rest_seconds)}
        </CardDescription>
        {(e.cues.length > 0 || e.notes) && (
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer rounded outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              How to do it
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {e.notes && <li>{e.notes}</li>}
              {e.cues.map((cue) => (
                <li key={cue}>{cue}</li>
              ))}
            </ul>
          </details>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-2">
          {Array.from({ length: rows }, (_, i) => i + 1).map((n) => {
            const logged = sets.find((s) => s.set_number === n);
            const label = `Set ${n} ${unit} for ${e.name}`;
            if (logged && editing !== n) {
              return (
                <li key={n} className="flex items-center justify-between rounded-md border bg-accent/50 px-3 py-2">
                  <span className="text-sm text-muted-foreground">Set {n}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium tabular-nums">
                      {logged.value} {e.metric === "reps" ? "reps" : "s"}
                    </span>
                    <Check className="size-4 text-success" aria-hidden />
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(n)} aria-label={`Edit set ${n}`}>
                      <Pencil className="size-3.5" />
                    </Button>
                  </span>
                </li>
              );
            }
            if (n === nextSet || editing === n) {
              return (
                <li key={n}>
                  <SetInput
                    label={label}
                    setNumber={n}
                    metric={e.metric}
                    initial={logged?.value ?? sets.at(-1)?.value ?? e.target_max}
                    onSubmit={(value) => {
                      onLog(n, value);
                      setEditing(null);
                    }}
                    onCancel={editing === n ? () => setEditing(null) : undefined}
                  />
                </li>
              );
            }
            return (
              <li key={n} className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                Set {n} · {formatTarget(e.target_min, e.target_max, e.metric, e.unilateral)}
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap gap-2">
          {done && (
            <Button variant="outline" size="sm" onClick={() => setExtraRows((x) => x + 1)}>
              <Plus aria-hidden /> Add set
            </Button>
          )}
          {sets.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onRemoveLast}>
              <Undo2 aria-hidden /> Undo last set
            </Button>
          )}
          {sets.length === 0 && (
            <Button variant="ghost" size="sm" onClick={() => onSkip(!e.skipped)}>
              {e.skipped ? "Un-skip exercise" : "Skip exercise"}
            </Button>
          )}
        </div>

        {sets.length > 0 && <RpePicker id={`rpe-${e.id}`} value={e.rpe} onChange={onRpe} />}
      </CardContent>
    </Card>
  );
}

function SetInput({
  label,
  setNumber,
  metric,
  initial,
  onSubmit,
  onCancel,
}: {
  label: string;
  setNumber: number;
  metric: "reps" | "seconds";
  initial: number;
  onSubmit: (value: number) => void;
  onCancel?: () => void;
}) {
  const [text, setText] = useState(String(initial));
  const [stopwatchStart, setStopwatchStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const value = Number(text);
  const valid = text.trim() !== "" && Number.isInteger(value) && value >= 0 && value <= 3600;
  const inputId = `set-${label.replace(/\W+/g, "-")}`;

  useEffect(() => {
    if (stopwatchStart === null) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [stopwatchStart]);

  const step = (delta: number) => setText(String(Math.max(0, (Number.isFinite(value) ? value : 0) + delta)));
  const stepSize = metric === "reps" ? 1 : 5;

  if (stopwatchStart !== null) {
    const elapsed = Math.max(0, Math.floor((now - stopwatchStart) / 1000));
    return (
      <div className="flex items-center justify-between rounded-md border border-primary px-3 py-2">
        <span className="font-mono text-2xl tabular-nums" role="timer" aria-label={`Hold timer for set ${setNumber}`}>
          {formatClock(elapsed)}
        </span>
        <Button
          onClick={() => {
            setStopwatchStart(null);
            setText(String(elapsed));
          }}
        >
          Stop
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-2 rounded-md border border-primary p-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (valid) onSubmit(value);
      }}
    >
      <label htmlFor={inputId} className="text-sm font-medium">
        Set {setNumber} <span className="sr-only">{label}</span>
        <span aria-hidden className="text-muted-foreground"> · {metric === "reps" ? "reps" : "seconds"}</span>
      </label>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" onClick={() => step(-stepSize)} aria-label={`Decrease by ${stepSize}`}>
          <Minus />
        </Button>
        <Input
          id={inputId}
          inputMode="numeric"
          value={text}
          onChange={(ev) => setText(ev.target.value)}
          aria-invalid={valid ? undefined : true}
          className="w-20 text-center text-lg tabular-nums"
        />
        <Button type="button" variant="outline" size="icon" onClick={() => step(stepSize)} aria-label={`Increase by ${stepSize}`}>
          <Plus />
        </Button>
        {metric === "seconds" && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              setNow(Date.now());
              setStopwatchStart(Date.now());
            }}
            aria-label="Start hold timer"
          >
            <Timer />
          </Button>
        )}
        <Button type="submit" className="ml-auto" disabled={!valid}>
          {onCancel ? "Save" : "Log"}
        </Button>
      </div>
      {onCancel && (
        <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onCancel}>
          Cancel
        </Button>
      )}
    </form>
  );
}
