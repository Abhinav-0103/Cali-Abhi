import type { LocalExercise, LocalWorkout, MobilityItem, StartableDay } from "./types";

// Pure functions over a LocalWorkout. Every change returns a new object with
// rev + 1 so the sync layer knows there is something to push.

export function formatTarget(min: number, max: number, metric: "reps" | "seconds", unilateral = false) {
  const range = min === max ? `${min}` : `${min}–${max}`;
  return `${range} ${metric === "reps" ? "reps" : "s"}${unilateral ? " per side" : ""}`;
}

function mobility(day: StartableDay, block: "warmup" | "cooldown"): MobilityItem[] {
  return day.exercises
    .filter((e) => e.block === block)
    .map((e) => ({ name: e.name, target: formatTarget(e.targetMin, e.targetMax, e.metric, e.unilateral) }));
}

export function createWorkout(
  day: StartableDay,
  opts: { userId: string; today: string; now: string; newId: () => string },
): LocalWorkout {
  const exercises: LocalExercise[] = day.exercises
    .filter((e) => e.block === "main")
    .map((e, i) => ({
      id: opts.newId(),
      exercise_id: e.exerciseId,
      plan_exercise_id: e.id,
      position: i + 1,
      planned_sets: e.sets,
      target_min: e.targetMin,
      target_max: e.targetMax,
      rpe: null,
      skipped: false,
      name: e.name,
      metric: e.metric,
      unilateral: e.unilateral,
      cues: e.cues,
      rest_seconds: e.restSeconds,
      notes: e.notes,
    }));

  return {
    session: {
      id: opts.newId(),
      user_id: opts.userId,
      plan_id: day.planId,
      plan_day_id: day.planDayId,
      week_number: day.weekNumber,
      day_number: day.dayNumber,
      status: "in_progress",
      performed_on: opts.today,
      started_at: opts.now,
      completed_at: null,
    },
    title: day.title,
    warmup: mobility(day, "warmup"),
    cooldown: mobility(day, "cooldown"),
    exercises,
    sets: [],
    deletedSetIds: [],
    rev: 1,
    syncedRev: 0,
  };
}

function bump(w: LocalWorkout, patch: Partial<LocalWorkout>): LocalWorkout {
  return { ...w, ...patch, rev: w.rev + 1 };
}

export function setsFor(w: LocalWorkout, exerciseId: string) {
  return w.sets.filter((s) => s.session_exercise_id === exerciseId).sort((a, b) => a.set_number - b.set_number);
}

/** Logs (or overwrites) a set's value. */
export function logSet(w: LocalWorkout, exerciseId: string, setNumber: number, value: number, opts: { now: string; newId: () => string }) {
  if (!Number.isInteger(value) || value < 0 || value > 3600) throw new Error("Invalid set value");
  const existing = w.sets.find((s) => s.session_exercise_id === exerciseId && s.set_number === setNumber);
  const sets = existing
    ? w.sets.map((s) => (s === existing ? { ...s, value, logged_at: opts.now } : s))
    : [...w.sets, { id: opts.newId(), session_exercise_id: exerciseId, set_number: setNumber, value, logged_at: opts.now }];
  // Logging a set un-skips the exercise.
  const exercises = w.exercises.map((e) => (e.id === exerciseId && e.skipped ? { ...e, skipped: false } : e));
  return bump(w, { sets, exercises });
}

/** Removes the highest logged set of an exercise (set numbers stay contiguous). */
export function removeLastSet(w: LocalWorkout, exerciseId: string) {
  const last = setsFor(w, exerciseId).at(-1);
  if (!last) return w;
  return bump(w, { sets: w.sets.filter((s) => s.id !== last.id), deletedSetIds: [...w.deletedSetIds, last.id] });
}

export function setRpe(w: LocalWorkout, exerciseId: string, rpe: number | null) {
  if (rpe !== null && (!Number.isInteger(rpe) || rpe < 1 || rpe > 10)) throw new Error("Invalid RPE");
  return bump(w, { exercises: w.exercises.map((e) => (e.id === exerciseId ? { ...e, rpe } : e)) });
}

export function setSkipped(w: LocalWorkout, exerciseId: string, skipped: boolean) {
  return bump(w, { exercises: w.exercises.map((e) => (e.id === exerciseId ? { ...e, skipped } : e)) });
}

export function finishWorkout(w: LocalWorkout, now: string) {
  return bump(w, { session: { ...w.session, status: "completed", completed_at: now } });
}

export function abandonWorkout(w: LocalWorkout, now: string) {
  return bump(w, { session: { ...w.session, status: "abandoned", completed_at: now } });
}

/** Planned sets not yet logged on exercises that aren't skipped. */
export function unloggedSets(w: LocalWorkout) {
  return w.exercises
    .filter((e) => !e.skipped)
    .reduce((n, e) => n + Math.max(e.planned_sets - setsFor(w, e.id).length, 0), 0);
}

export type WorkoutSummary = {
  durationMinutes: number;
  setsLogged: number;
  setsPlanned: number;
  totalReps: number;
  totalHoldSeconds: number;
  exercises: { id: string; name: string; metric: "reps" | "seconds"; values: number[]; rpe: number | null; skipped: boolean; hitTarget: boolean }[];
};

export function summarise(w: LocalWorkout): WorkoutSummary {
  const end = w.session.completed_at ? Date.parse(w.session.completed_at) : Date.now();
  const exercises = w.exercises.map((e) => {
    const values = setsFor(w, e.id).map((s) => s.value);
    return {
      id: e.id,
      name: e.name,
      metric: e.metric,
      values,
      rpe: e.rpe,
      skipped: e.skipped,
      hitTarget: !e.skipped && values.length >= e.planned_sets && values.every((v) => v >= e.target_min),
    };
  });
  const sum = (metric: "reps" | "seconds") =>
    exercises.filter((e) => e.metric === metric).reduce((t, e) => t + e.values.reduce((a, b) => a + b, 0), 0);

  return {
    durationMinutes: Math.max(1, Math.round((end - Date.parse(w.session.started_at)) / 60000)),
    setsLogged: w.sets.length,
    setsPlanned: w.exercises.filter((e) => !e.skipped).reduce((n, e) => n + e.planned_sets, 0),
    totalReps: sum("reps"),
    totalHoldSeconds: sum("seconds"),
    exercises,
  };
}

/**
 * The next workout in a plan: the first day (in week, day order) without a
 * completed session. Missed days don't break the plan; you just carry on.
 */
export function nextPlanDay<D extends { dayNumber: number }>(
  weeks: { weekNumber: number; days: D[] }[],
  completed: { week_number: number | null; day_number: number | null }[],
): { weekNumber: number; day: D } | null {
  const done = new Set(completed.map((s) => `${s.week_number}-${s.day_number}`));
  for (const week of weeks) {
    for (const day of week.days) {
      if (!done.has(`${week.weekNumber}-${day.dayNumber}`)) return { weekNumber: week.weekNumber, day };
    }
  }
  return null;
}
