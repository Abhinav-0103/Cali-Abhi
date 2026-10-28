import type { StoredPlanWeek } from "@/lib/plan/schema";
import { ceiling, MAX_SETS, type Decision, type ExerciseInfo } from "./engine";

export type ExerciseDecision = { exerciseId: string; decision: Decision };

/**
 * Applies decisions to the plan's FUTURE days only (days whose week/day key
 * is not in `completedKeys`). Returns a new plan; the input is not mutated, so
 * the caller can store it as a new version and keep history intact.
 */
export function applyDecisions(
  weeks: StoredPlanWeek[],
  decisions: ExerciseDecision[],
  completedKeys: Set<string>,
  exercises: Map<string, ExerciseInfo>,
): { weeks: StoredPlanWeek[]; changed: boolean } {
  let changed = false;
  const result = structuredClone(weeks);

  for (const week of result) {
    for (const day of week.days) {
      if (completedKeys.has(`${week.week_number}-${day.day_number}`)) continue;

      for (const { exerciseId, decision } of decisions) {
        const info = exercises.get(exerciseId);
        if (!info) continue;

        for (const item of day.exercises) {
          if (item.block !== "main" || item.exercise_id !== exerciseId) continue;
          if (applyToItem(item, day.exercises, decision, info)) changed = true;
        }
      }
    }
  }
  return { weeks: result, changed };
}

type Item = StoredPlanWeek["days"][number]["exercises"][number];

function applyToItem(item: Item, dayItems: Item[], decision: Decision, info: ExerciseInfo): boolean {
  switch (decision.type) {
    case "hold":
      return false;
    case "increase_target":
      // Never lowers a target (later weeks may already be above the ceiling).
      item.target_max = Math.max(item.target_max, Math.min(ceiling(info), item.target_max + decision.delta));
      item.target_min = Math.max(item.target_min, Math.min(item.target_min + decision.delta, item.target_max));
      return true;
    case "add_set":
      item.sets = Math.min(MAX_SETS, item.sets + 1);
      return true;
    case "reduce_volume":
      item.sets = Math.max(1, item.sets - 1);
      item.target_min = Math.max(1, item.target_min + decision.targetDelta);
      item.target_max = Math.max(item.target_min, item.target_max + decision.targetDelta);
      return true;
    case "advance":
    case "regress":
      // Don't create a duplicate if the day already has the new exercise.
      if (dayItems.some((e) => e.block === "main" && e.exercise_id === decision.toExerciseId)) return false;
      item.exercise_id = decision.toExerciseId;
      item.target_min = decision.targetMin;
      item.target_max = decision.targetMax;
      item.notes = null; // the old cue no longer applies
      return true;
  }
}
