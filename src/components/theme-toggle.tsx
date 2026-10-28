"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

const subscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known on the client.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <RadioGroup
      aria-label="Theme"
      value={mounted ? theme : undefined}
      onValueChange={setTheme}
      className="grid-cols-3"
    >
      {OPTIONS.map((o) => (
        <Label
          key={o.value}
          htmlFor={`theme-${o.value}`}
          className="flex cursor-pointer items-center gap-2 rounded-md border p-3 has-[[data-state=checked]]:border-primary"
        >
          <RadioGroupItem id={`theme-${o.value}`} value={o.value} />
          {o.label}
        </Label>
      ))}
    </RadioGroup>
  );
}
