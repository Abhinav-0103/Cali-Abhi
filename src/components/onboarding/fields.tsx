"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

function describedBy(id: string, error?: string, hint?: string) {
  return [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
}

export function NumberField({
  id,
  label,
  hint,
  suffix,
  value,
  onChange,
  error,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  suffix?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className="max-w-32"
        />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
      <FieldError id={id} message={error} />
    </div>
  );
}

type Option<T extends string> = { value: T; label: string; description?: string };

/** Single choice shown as large tappable cards. */
export function ChoiceCards<T extends string>({
  id,
  legend,
  options,
  value,
  onChange,
  error,
  columns = 1,
}: {
  id: string;
  legend: string;
  options: Option<T>[];
  value: T | "";
  onChange: (value: T) => void;
  error?: string;
  columns?: 1 | 2;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <RadioGroup
        id={id}
        value={value}
        onValueChange={(v) => onChange(v as T)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error)}
        className={cn("gap-2", columns === 2 && "grid-cols-2")}
      >
        {options.map((o) => (
          <Label
            key={o.value}
            htmlFor={`${id}-${o.value}`}
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal leading-snug has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
          >
            <RadioGroupItem id={`${id}-${o.value}`} value={o.value} className="mt-0.5" />
            <span className="grid gap-1">
              <span className="font-medium">{o.label}</span>
              {o.description && <span className="text-sm text-muted-foreground">{o.description}</span>}
            </span>
          </Label>
        ))}
      </RadioGroup>
      <FieldError id={id} message={error} />
    </fieldset>
  );
}

/** Multiple choice shown as checkbox cards. */
export function MultiChoice<T extends string | number>({
  id,
  legend,
  hint,
  options,
  values,
  onChange,
  error,
  columns = 1,
}: {
  id: string;
  legend: string;
  hint?: string;
  options: { value: T; label: string; description?: string }[];
  values: T[];
  onChange: (values: T[]) => void;
  error?: string;
  columns?: 1 | 2 | 4 | 7;
}) {
  const toggle = (value: T, checked: boolean) =>
    onChange(checked ? [...values, value] : values.filter((v) => v !== value));

  return (
    <fieldset className="space-y-2" aria-describedby={describedBy(id, error, hint)}>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <div
        className={cn(
          "grid gap-2",
          columns === 2 && "grid-cols-2",
          columns === 4 && "grid-cols-4",
          columns === 7 && "grid-cols-7",
        )}
      >
        {options.map((o, i) => {
          // The first checkbox doubles as the focus target for errors.
          const optionId = i === 0 ? id : `${id}-${o.value}`;
          return (
            <Label
              key={String(o.value)}
              htmlFor={optionId}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal leading-snug has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent",
                columns === 7 && "flex-col items-center gap-2 px-0 text-xs",
              )}
            >
              <Checkbox
                id={optionId}
                checked={values.includes(o.value)}
                onCheckedChange={(checked) => toggle(o.value, checked === true)}
                className="mt-0.5"
              />
              <span className="grid gap-1">
                <span className="font-medium">{o.label}</span>
                {o.description && <span className="text-sm text-muted-foreground">{o.description}</span>}
              </span>
            </Label>
          );
        })}
      </div>
      <FieldError id={id} message={error} />
    </fieldset>
  );
}

/** Compact segmented single choice (e.g. units, days per week). */
export function Segmented<T extends string | number>({
  id,
  legend,
  options,
  value,
  onChange,
  error,
}: {
  id: string;
  legend: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  error?: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <RadioGroup
        id={id}
        value={String(value)}
        onValueChange={(v) => onChange(options.find((o) => String(o.value) === v)!.value)}
        className="flex flex-wrap gap-2"
        aria-describedby={describedBy(id, error)}
      >
        {options.map((o) => (
          <Label
            key={String(o.value)}
            htmlFor={`${id}-${o.value}`}
            className="flex min-w-12 cursor-pointer items-center justify-center rounded-md border px-3 py-2 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary has-[[data-state=checked]]:text-primary-foreground has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
          >
            <RadioGroupItem id={`${id}-${o.value}`} value={String(o.value)} className="sr-only" />
            {o.label}
          </Label>
        ))}
      </RadioGroup>
      <FieldError id={id} message={error} />
    </fieldset>
  );
}
