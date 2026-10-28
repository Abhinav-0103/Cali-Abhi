"use client";

import { cn } from "@/lib/utils";

const HINTS: Record<number, string> = {
  1: "Very easy",
  4: "Easy",
  6: "Moderate, 4+ reps left",
  7: "Hard, 3 reps left",
  8: "Very hard, 2 reps left",
  9: "1 rep left",
  10: "Max effort",
};

/** Rate of perceived exertion, 1–10, for the whole exercise. */
export function RpePicker({ id, value, onChange }: { id: string; value: number | null; onChange: (rpe: number) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend id={`${id}-legend`} className="text-sm font-medium">
        How hard was it? (RPE 1–10)
      </legend>
      <div role="radiogroup" aria-labelledby={`${id}-legend`} className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`RPE ${n}${HINTS[n] ? `: ${HINTS[n]}` : ""}`}
            onClick={() => onChange(n)}
            className={cn(
              "h-9 rounded-md border text-sm tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              value === n ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {value ? `${value}: ${HINTS[value] ?? HINTS[Object.keys(HINTS).map(Number).filter((k) => k <= value).at(-1)!]}` : "Tap after your last set"}
      </p>
    </fieldset>
  );
}
