import type { BodyPart, Equipment, Experience, Goal, Sex, SkillGoal } from "@/lib/constants";
import type { OnboardingInput, ParqId } from "@/lib/schemas/onboarding";
import { cmFromFtIn, kgFromLb } from "@/lib/units";

export const DRAFT_STORAGE_KEY = "calicoach:onboarding-draft:v1";

// What the form holds while the user types: raw strings for number inputs,
// display units, and unanswered choices as "".
export type OnboardingDraft = {
  unitSystem: "metric" | "imperial";
  age: string;
  sex: Sex | "";
  heightCm: string;
  heightFt: string;
  heightIn: string;
  weight: string; // kg or lb depending on unitSystem
  goal: Goal | "";
  skillGoals: SkillGoal[];
  experience: Experience | "";
  pushUps: string;
  pullUps: string;
  squats: string;
  plankSeconds: string;
  deadHangSeconds: string;
  equipment: Equipment[];
  daysPerWeek: number;
  minutesPerSession: number;
  preferredDays: number[];
  injuryAreas: BodyPart[];
  injuryNotes: string;
  parq: Partial<Record<ParqId, boolean>>;
  parqAcknowledged: boolean;
};

export const EMPTY_DRAFT: OnboardingDraft = {
  unitSystem: "metric",
  age: "",
  sex: "",
  heightCm: "",
  heightFt: "",
  heightIn: "",
  weight: "",
  goal: "",
  skillGoals: [],
  experience: "",
  pushUps: "",
  pullUps: "",
  squats: "",
  plankSeconds: "",
  deadHangSeconds: "",
  equipment: [],
  daysPerWeek: 3,
  minutesPerSession: 45,
  preferredDays: [],
  injuryAreas: [],
  injuryNotes: "",
  parq: {},
  parqAcknowledged: false,
};

/** "" → undefined (so Zod reports "Enter …"), otherwise a number (NaN if not numeric). */
function num(value: string): number | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : Number(trimmed);
}

function heightCm(d: OnboardingDraft) {
  if (d.unitSystem === "metric") return num(d.heightCm);
  const feet = num(d.heightFt);
  if (feet === undefined) return undefined;
  return cmFromFtIn(feet, num(d.heightIn) ?? 0);
}

function weightKg(d: OnboardingDraft) {
  const w = num(d.weight);
  if (w === undefined || d.unitSystem === "metric") return w;
  return kgFromLb(w);
}

/** Converts the draft to the shape the schema validates (metric units). */
export function toOnboardingInput(d: OnboardingDraft, env: { timezone: string; today: string }) {
  return {
    unitSystem: d.unitSystem,
    age: num(d.age),
    sex: d.sex || undefined,
    heightCm: heightCm(d),
    weightKg: weightKg(d),
    goal: d.goal || undefined,
    // Skill choices only matter for the skills goal.
    skillGoals: d.goal === "skills" ? d.skillGoals : [],
    experience: d.experience || undefined,
    pushUps: num(d.pushUps),
    pullUps: num(d.pullUps),
    squats: num(d.squats),
    plankSeconds: num(d.plankSeconds),
    deadHangSeconds: num(d.deadHangSeconds),
    equipment: d.equipment,
    daysPerWeek: d.daysPerWeek,
    minutesPerSession: d.minutesPerSession,
    preferredDays: [...d.preferredDays].sort((a, b) => a - b),
    injuryAreas: d.injuryAreas,
    injuryNotes: d.injuryNotes,
    parq: d.parq,
    parqAcknowledged: d.parqAcknowledged,
    timezone: env.timezone,
    today: env.today,
  } satisfies Record<keyof OnboardingInput, unknown>;
}
