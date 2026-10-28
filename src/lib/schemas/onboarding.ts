import { z } from "zod";
import { BODY_PARTS, EQUIPMENT, EXPERIENCE_LEVELS, GOALS, SEXES, SKILL_GOALS } from "@/lib/constants";

// Health screening, adapted from the PAR-Q+ general questions.
export const PARQ_QUESTIONS = [
  { id: "q1", text: "Has a doctor ever said you have a heart condition or high blood pressure?" },
  { id: "q2", text: "Do you feel pain in your chest at rest, during daily activities or when you exercise?" },
  { id: "q3", text: "Do you lose balance because of dizziness, or have you lost consciousness in the last 12 months?" },
  { id: "q4", text: "Have you been diagnosed with another chronic medical condition (other than heart disease or high blood pressure)?" },
  { id: "q5", text: "Do you currently take prescribed medication for a chronic medical condition?" },
  { id: "q6", text: "Do you have (or have you had in the last 12 months) a bone, joint or soft-tissue problem that could get worse with more exercise?" },
  { id: "q7", text: "Has a doctor ever said you should only do medically supervised physical activity?" },
] as const;

export type ParqId = (typeof PARQ_QUESTIONS)[number]["id"];

const required = (label: string) => ({
  error: (issue: { input?: unknown }) =>
    issue.input === undefined || issue.input === "" ? `Enter ${label}` : `${label[0].toUpperCase()}${label.slice(1)} must be a number`,
});

const wholeNumber = (label: string, min: number, max: number) =>
  z
    .number(required(label))
    .int("Use a whole number")
    .min(min, `Must be at least ${min}`)
    .max(max, `Must be ${max} or less`);

const choice = <T extends readonly [string, ...string[]]>(values: T, message: string) =>
  z.enum(values, { error: message });

const baseSchema = z.object({
  unitSystem: z.enum(["metric", "imperial"]),
  age: wholeNumber("your age", 16, 100),
  sex: choice(SEXES, "Choose an option"),
  heightCm: z.number(required("your height")).min(100, "Height looks too low").max(250, "Height looks too high"),
  weightKg: z.number(required("your weight")).min(25, "Weight looks too low").max(350, "Weight looks too high"),

  goal: choice(GOALS, "Choose your main goal"),
  skillGoals: z.array(z.enum(SKILL_GOALS)),
  experience: choice(EXPERIENCE_LEVELS, "Choose your experience level"),

  pushUps: wholeNumber("your push-ups", 0, 500),
  pullUps: wholeNumber("your pull-ups", 0, 100),
  squats: wholeNumber("your squats", 0, 1000),
  plankSeconds: wholeNumber("your plank time", 0, 3600),
  deadHangSeconds: wholeNumber("your dead hang time", 0, 3600),

  equipment: z.array(z.enum(EQUIPMENT)),

  daysPerWeek: wholeNumber("days per week", 2, 6),
  minutesPerSession: wholeNumber("minutes per session", 20, 90),
  preferredDays: z.array(z.number().int().min(0).max(6)),

  injuryAreas: z.array(z.enum(BODY_PARTS)),
  injuryNotes: z.string().trim().max(500, "Keep this under 500 characters"),

  parq: z.record(
    z.enum(PARQ_QUESTIONS.map((q) => q.id) as [ParqId, ...ParqId[]]),
    z.boolean({ error: "Answer yes or no" }),
    { error: "Answer every question" },
  ),
  parqAcknowledged: z.boolean(),

  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown time zone"),
  today: z.iso.date(),
});

type BaseInput = z.infer<typeof baseSchema>;

// Cross-field rules. Each rule only uses fields from a single onboarding step,
// so it also works when validating one step at a time (on a picked schema).
function addCrossFieldIssues(v: Partial<BaseInput>, ctx: z.RefinementCtx) {
  if (v.goal === "skills" && v.skillGoals?.length === 0) {
    ctx.addIssue({ code: "custom", path: ["skillGoals"], message: "Pick at least one skill" });
  }
  if (v.preferredDays && v.daysPerWeek !== undefined) {
    if (new Set(v.preferredDays).size !== v.preferredDays.length) {
      ctx.addIssue({ code: "custom", path: ["preferredDays"], message: "Each day can only be picked once" });
    } else if (v.preferredDays.length > 0 && v.preferredDays.length !== v.daysPerWeek) {
      ctx.addIssue({
        code: "custom",
        path: ["preferredDays"],
        message: `Pick exactly ${v.daysPerWeek} days, or none to stay flexible`,
      });
    }
  }
  if (v.parq && parqFlagged(v.parq) && v.parqAcknowledged === false) {
    ctx.addIssue({
      code: "custom",
      path: ["parqAcknowledged"],
      message: "Please confirm you have read the recommendation",
    });
  }
}

export const onboardingSchema = baseSchema.superRefine(addCrossFieldIssues);

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type OnboardingField = keyof OnboardingInput;

export function parqFlagged(parq: Partial<Record<ParqId, boolean>>) {
  return Object.values(parq).some((answer) => answer === true);
}

export const ONBOARDING_STEPS = [
  { id: "body", title: "About you", fields: ["unitSystem", "age", "sex", "heightCm", "weightKg"] },
  { id: "goal", title: "Your goal", fields: ["goal", "skillGoals"] },
  { id: "experience", title: "Experience", fields: ["experience"] },
  { id: "baseline", title: "Baseline test", fields: ["pushUps", "pullUps", "squats", "plankSeconds", "deadHangSeconds"] },
  { id: "equipment", title: "Equipment", fields: ["equipment"] },
  { id: "schedule", title: "Schedule", fields: ["daysPerWeek", "minutesPerSession", "preferredDays"] },
  { id: "injuries", title: "Injuries", fields: ["injuryAreas", "injuryNotes"] },
  { id: "health", title: "Health check", fields: ["parq", "parqAcknowledged"] },
] as const satisfies readonly { id: string; title: string; fields: readonly OnboardingField[] }[];

export type StepId = (typeof ONBOARDING_STEPS)[number]["id"];
export type FieldErrors = Partial<Record<OnboardingField, string>>;

/** Validates the whole form but reports only errors for the given fields. */
export function validateFields(input: unknown, fields: readonly OnboardingField[]): FieldErrors {
  const mask = Object.fromEntries(fields.map((f) => [f, true])) as Partial<Record<OnboardingField, true>>;
  const result = baseSchema.pick(mask).superRefine(addCrossFieldIssues).safeParse(input);
  if (result.success) return {};
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as OnboardingField;
    if (fields.includes(field) && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}
