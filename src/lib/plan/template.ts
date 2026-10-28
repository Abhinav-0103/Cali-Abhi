import type { Experience, Goal, SkillGoal } from "@/lib/constants";
import type { Exercise } from "@/lib/exercises/library";
import { GOAL_LABELS } from "@/lib/labels";
import type { PlanExerciseOutput, PlanOutput } from "./schema";
import { estimateDayMinutes } from "./validate";

// Deterministic plan used when the AI fails twice (and as the fake AI in tests).
// Always produces output that passes validatePlan for the same context.

export type TemplateInput = {
  goal: Goal;
  skillGoals: SkillGoal[];
  experience: Experience;
  daysPerWeek: number;
  minutesPerSession: number;
  preferredDays: number[];
  conservative: boolean;
  eligible: Exercise[];
  /** Starting exercise per chain (see startingPoints). */
  starts: Record<string, string>;
};

const DEFAULT_WEEKDAYS: Record<number, number[]> = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
};

type Session = { title: string; focus: string; slots: string[] };

// A slot is a chain, or alternatives separated by "|" (first available wins).
const FULL_A: Session = { title: "Full body A", focus: "Push, pull, legs and core", slots: ["push_up", "pull_up|row", "squat", "l_sit"] };
const FULL_B: Session = { title: "Full body B", focus: "Dips, rows, hinge and core", slots: ["dip|pike_push", "row|pull_up", "hinge", "leg_raise|side_plank"] };
const UPPER: Session = { title: "Upper body", focus: "Pushing and pulling strength", slots: ["push_up", "pull_up|row", "dip|pike_push", "row|pull_up", "l_sit"] };
const LOWER: Session = { title: "Lower body & core", focus: "Legs, posterior chain and core", slots: ["squat", "hinge", "calf", "leg_raise", "side_plank|arch"] };
const PUSH: Session = { title: "Push", focus: "Chest, shoulders and triceps", slots: ["push_up", "dip|pike_push", "pike_push|push_up", "l_sit"] };
const PULL: Session = { title: "Pull", focus: "Back, biceps and grip", slots: ["pull_up|row", "row|pull_up", "leg_raise", "arch"] };
const LEGS: Session = { title: "Legs", focus: "Legs and trunk stability", slots: ["squat", "hinge", "calf", "side_plank|plank"] };

function sessionsFor(days: number): Session[] {
  if (days <= 3) return Array.from({ length: days }, (_, i) => (i % 2 === 0 ? FULL_A : FULL_B));
  if (days === 4) return [UPPER, LOWER, UPPER, LOWER];
  return Array.from({ length: days }, (_, i) => [PUSH, PULL, LEGS][i % 3]);
}

const SKILL_CHAIN: Record<SkillGoal, string> = {
  handstand: "handstand",
  muscle_up: "muscle_up",
  l_sit: "l_sit",
  front_lever: "front_lever",
};

const SETS: Record<Experience, number> = { beginner: 2, intermediate: 3, advanced: 4 };
const REPS: Record<Experience, [number, number]> = { beginner: [6, 10], intermediate: [8, 12], advanced: [8, 12] };
const HOLDS: Record<Experience, [number, number]> = { beginner: [15, 25], intermediate: [20, 30], advanced: [20, 40] };

const WARMUP = ["arm_circles", "cat_cow", "hip_circles", "wrist_prep"];
const COOLDOWN = ["hamstring_stretch", "doorway_chest_stretch", "thoracic_rotation"];

export function templatePlan(input: TemplateInput): PlanOutput {
  const byId = new Map(input.eligible.map((e) => [e.id, e]));
  const weekdays =
    input.preferredDays.length === input.daysPerWeek
      ? [...input.preferredDays].sort((a, b) => a - b)
      : DEFAULT_WEEKDAYS[input.daysPerWeek];

  const skillChains = input.goal === "skills" ? input.skillGoals.map((s) => SKILL_CHAIN[s]).filter((c) => input.starts[c]) : [];

  const days = sessionsFor(input.daysPerWeek).map((session, i) => {
    let slots = [...session.slots];
    if (input.goal === "first_pull_up") slots = ["pull_up|row", ...slots.filter((s) => !s.startsWith("pull_up"))];
    if (skillChains.length > 0) slots = [skillChains[i % skillChains.length], ...slots];

    const mainIds = [
      ...new Set(
        slots
          .map((slot) => slot.split("|").map((chain) => input.starts[chain]).find(Boolean))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    // Plank and assisted squats have no equipment or contraindications, so this always finds something.
    if (mainIds.length === 0) mainIds.push(...["squat_assisted", "plank"].filter((id) => byId.has(id)));
    return { session, weekday: weekdays[i], mainIds };
  });

  const weeks = [1, 2, 3, 4].map((weekNumber) => ({
    week_number: weekNumber,
    focus: weekFocus(weekNumber, input.experience),
    days: days.map(({ session, weekday, mainIds }, i) => ({
      day_number: i + 1,
      weekday,
      title: session.title,
      focus: session.focus,
      exercises: fitToTime(
        [
          ...WARMUP.filter((id) => byId.has(id)).slice(0, 3).map((id) => mobilityItem("warmup", byId.get(id)!)),
          ...mainIds.map((id) => mainItem(byId.get(id)!, weekNumber, input)),
          ...COOLDOWN.filter((id) => byId.has(id)).map((id) => mobilityItem("cooldown", byId.get(id)!)),
        ],
        input.minutesPerSession,
        byId,
      ),
    })),
  }));

  return {
    summary:
      `A ${input.daysPerWeek}-day plan for ${GOAL_LABELS[input.goal].label.toLowerCase()}, starting each movement at a level ` +
      `that matches your baseline test. Weeks 1–3 add a little each week` +
      (input.experience === "beginner" ? ", and week 4 consolidates." : ", and week 4 is a lighter recovery week.") +
      (input.conservative ? " Volume is kept low because of your health answers." : ""),
    weeks,
  };
}

function weekFocus(week: number, experience: Experience) {
  if (week === 1) return "Learn the movements and find your working level";
  if (week === 4) return experience === "beginner" ? "Consolidate: repeat week 3 with better form" : "Deload: less volume to recover before your next block";
  return "Build: a little more than last week";
}

function mainItem(exercise: Exercise, week: number, input: TemplateInput): PlanExerciseOutput {
  const deload = week === 4 && input.experience !== "beginner";
  const step = deload ? 0 : Math.min(week, 3) - 1; // weeks 1–3 progress, beginner week 4 repeats week 3
  const skill = exercise.category === "skill";
  let sets = input.conservative ? 2 : SETS[input.experience];
  if (deload) sets = Math.max(1, sets - 1);

  const reps = skill ? ([3, 5] as const) : REPS[input.experience];
  const holds = skill ? ([10, 20] as const) : HOLDS[input.experience];
  const range =
    exercise.metric === "reps"
      ? { min: reps[0] + step, max: reps[1] + step }
      : { min: holds[0] + step * 5, max: holds[1] + step * 5 };

  return {
    block: "main",
    exercise_id: exercise.id,
    sets,
    rep_range: exercise.metric === "reps" ? range : null,
    hold_range: exercise.metric === "seconds" ? range : null,
    rest_seconds: skill ? 120 : input.goal === "lose_fat" ? 60 : 90,
    notes: exercise.cues[0] ?? "",
  };
}

function mobilityItem(block: "warmup" | "cooldown", exercise: Exercise): PlanExerciseOutput {
  return {
    block,
    exercise_id: exercise.id,
    sets: 1,
    rep_range: exercise.metric === "reps" ? { min: 8, max: 10 } : null,
    hold_range: exercise.metric === "seconds" ? { min: 30, max: 30 } : null,
    rest_seconds: 0,
    notes: "",
  };
}

/** Trims the session until it fits the user's time: fewer main exercises, then fewer sets, then less rest. */
function fitToTime(exercises: PlanExerciseOutput[], minutes: number, byId: Map<string, Exercise>) {
  const items = exercises.map((e) => ({ ...e }));
  const fits = () => estimateDayMinutes(items, byId) <= minutes;
  const mains = () => items.filter((e) => e.block === "main");

  while (!fits() && mains().length > 2) {
    items.splice(items.lastIndexOf(mains().at(-1)!), 1);
  }
  while (!fits() && mains().some((e) => e.sets > 1)) {
    const biggest = mains().reduce((a, b) => (b.sets > a.sets ? b : a));
    biggest.sets -= 1;
  }
  for (const e of mains()) if (!fits()) e.rest_seconds = Math.min(e.rest_seconds, 45);
  return items;
}
