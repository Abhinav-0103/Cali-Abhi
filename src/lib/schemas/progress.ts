import { z } from "zod";

const count = (label: string, max: number) =>
  z
    .number({ error: (i) => (i.input === undefined ? `Enter ${label}` : `${label} must be a number`) })
    .int("Use a whole number")
    .min(0, "Can't be negative")
    .max(max, `Must be ${max} or less`);

const recentDate = z.iso.date("Enter a valid date").refine((d) => {
  const ms = Date.parse(`${d}T00:00:00Z`);
  return ms >= Date.parse("2000-01-01") && ms <= Date.now() + 36 * 60 * 60 * 1000;
}, "Date can't be in the future");

export const weightEntrySchema = z.object({
  date: recentDate,
  weightKg: z.number({ error: "Enter your weight" }).min(25, "Weight looks too low").max(350, "Weight looks too high"),
});

export const retestSchema = z.object({
  date: recentDate,
  pushUps: count("push-ups", 500),
  pullUps: count("pull-ups", 100),
  squats: count("squats", 1000),
  plankSeconds: count("plank time", 3600),
  deadHangSeconds: count("dead hang time", 3600),
});

export type RetestInput = z.infer<typeof retestSchema>;

export const historyCursorSchema = z.object({ date: z.iso.date(), id: z.uuid() });

export function fieldErrors(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) errors[String(issue.path[0])] ??= issue.message;
  return errors;
}
