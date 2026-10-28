import type { Exercise } from "@/lib/exercises/library";
import { BLOCKS } from "@/lib/constants";
import {
  planOutputSchema,
  type PlanExerciseOutput,
  type PlanOutput,
  type StoredPlanDay,
  type StoredPlanWeek,
} from "./schema";

export type PlanContext = {
  /** Only exercises this user is allowed (see filterExercises). */
  eligibleById: Map<string, Exercise>;
  daysPerWeek: number;
  /** Empty = flexible. */
  preferredDays: number[];
  minutesPerSession: number;
};

export type PlanValidation =
  | { ok: true; summary: string; weeks: StoredPlanWeek[] }
  | { ok: false; errors: string[] };

const MAX_ERRORS = 25;
// Time allowance per unit of work, used for the session length estimate.
const SECONDS_PER_REP = 3;
const SET_SETUP_SECONDS = 10;
export const TIME_TOLERANCE = 1.15;

function exerciseSeconds(item: PlanExerciseOutput, exercise: Exercise) {
  const range = exercise.metric === "reps" ? item.rep_range : item.hold_range;
  const workPerSide = exercise.metric === "reps" ? (range?.max ?? 0) * SECONDS_PER_REP : (range?.max ?? 0);
  const work = workPerSide * (exercise.unilateral ? 2 : 1) + SET_SETUP_SECONDS;
  // No rest after the final set.
  return item.sets * work + Math.max(item.sets - 1, 0) * item.rest_seconds;
}

/** Rough session length in minutes (warm-up and cool-down included). */
export function estimateDayMinutes(exercises: PlanExerciseOutput[], eligibleById: Map<string, Exercise>) {
  let seconds = 0;
  for (const item of exercises) {
    const exercise = eligibleById.get(item.exercise_id);
    if (exercise) seconds += exerciseSeconds(item, exercise) + 30; // 30 s changeover
  }
  return Math.round(seconds / 60);
}

/** Zod-validates Claude's output, then checks it against the user's constraints. */
export function validatePlan(raw: unknown, ctx: PlanContext): PlanValidation {
  const parsed = planOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.slice(0, MAX_ERRORS).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  const plan: PlanOutput = parsed.data;
  const errors: string[] = [];
  const add = (message: string) => errors.length < MAX_ERRORS && errors.push(message);

  const weekNumbers = plan.weeks.map((w) => w.week_number).sort();
  if (weekNumbers.join() !== "1,2,3,4") add(`weeks must be numbered 1–4 exactly once, got ${weekNumbers.join(",")}`);

  for (const week of plan.weeks) {
    const w = `week ${week.week_number}`;
    if (week.days.length !== ctx.daysPerWeek) {
      add(`${w}: has ${week.days.length} days, the user trains ${ctx.daysPerWeek} days per week`);
    }
    const dayNumbers = week.days.map((d) => d.day_number).sort();
    if (dayNumbers.join() !== week.days.map((_, i) => i + 1).join()) {
      add(`${w}: day_number values must be 1..${week.days.length} exactly once`);
    }
    const weekdays = week.days.map((d) => d.weekday);
    if (new Set(weekdays).size !== weekdays.length) add(`${w}: two days share the same weekday`);
    if (ctx.preferredDays.length > 0 && [...weekdays].sort().join() !== [...ctx.preferredDays].sort().join()) {
      add(`${w}: weekdays must be exactly the user's preferred days ${ctx.preferredDays.join(",")}`);
    }

    for (const day of week.days) {
      const d = `${w} day ${day.day_number}`;
      for (const block of BLOCKS) {
        if (!day.exercises.some((e) => e.block === block)) add(`${d}: needs at least one ${block} exercise`);
      }
      for (const item of day.exercises) {
        const exercise = ctx.eligibleById.get(item.exercise_id);
        if (!exercise) {
          add(`${d}: unknown or not allowed exercise_id "${item.exercise_id}" — use only ids from the provided list`);
          continue;
        }
        if (item.block === "main" && exercise.category === "mobility") {
          add(`${d}: "${item.exercise_id}" is a mobility drill and can't be in the main block`);
        }
        const [expected, other] = exercise.metric === "reps" ? (["rep_range", "hold_range"] as const) : (["hold_range", "rep_range"] as const);
        const range = item[expected];
        if (!range) add(`${d}: "${item.exercise_id}" is measured in ${exercise.metric}, so ${expected} is required`);
        else if (range.min > range.max) add(`${d}: "${item.exercise_id}" ${expected} min is greater than max`);
        if (item[other]) add(`${d}: "${item.exercise_id}" must have ${other} set to null`);
      }
      const minutes = estimateDayMinutes(day.exercises, ctx.eligibleById);
      if (minutes > ctx.minutesPerSession * TIME_TOLERANCE) {
        add(`${d}: estimated ${minutes} min, over the user's ${ctx.minutesPerSession} min — reduce sets, exercises or rest`);
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, summary: plan.summary, weeks: normalise(plan) };
}

function normalise(plan: PlanOutput): StoredPlanWeek[] {
  const blockOrder = (b: string) => BLOCKS.indexOf(b as (typeof BLOCKS)[number]);
  return [...plan.weeks]
    .sort((a, b) => a.week_number - b.week_number)
    .map((week) => ({
      week_number: week.week_number,
      focus: week.focus,
      days: [...week.days]
        .sort((a, b) => a.day_number - b.day_number)
        .map(
          (day): StoredPlanDay => ({
            day_number: day.day_number,
            weekday: day.weekday,
            title: day.title,
            focus: day.focus,
            exercises: day.exercises
              .map((e, i) => ({ e, i }))
              .sort((a, b) => blockOrder(a.e.block) - blockOrder(b.e.block) || a.i - b.i)
              .map(({ e }) => {
                const range = (e.rep_range ?? e.hold_range)!;
                return {
                  block: e.block,
                  exercise_id: e.exercise_id,
                  sets: e.sets,
                  target_min: range.min,
                  target_max: range.max,
                  rest_seconds: e.rest_seconds,
                  notes: e.notes.trim() || null,
                };
              }),
          }),
        ),
    }));
}
