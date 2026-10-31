"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Segmented } from "@/components/onboarding/fields";
import { updateUnits } from "@/app/(app)/settings/actions";

export function UnitsSetting({ initial }: { initial: "metric" | "imperial" }) {
  const [value, setValue] = useState(initial);
  const [, startTransition] = useTransition();
  return (
    <Segmented
      id="units"
      legend="Units"
      value={value}
      onChange={(next) => {
        setValue(next);
        startTransition(async () => {
          const result = await updateUnits(next);
          if (!result.ok) {
            setValue(initial);
            toast.error("Couldn't change units");
          }
        });
      }}
      options={[
        { value: "metric", label: "Metric (cm, kg)" },
        { value: "imperial", label: "Imperial (ft, lb)" },
      ]}
    />
  );
}
