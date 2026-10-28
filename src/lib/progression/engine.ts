import type { ExerciseCategory, Metric } from "@/lib/constants";

// Deterministic progression (no AI). After each completed session, every main
// exercise is judged on its last two sessions:
// - both "successes" (every planned set at the top of the range, RPE ≤ 8)
//   → raise the target, or move up the chain once the range ceiling is reached
// - both "failures" (a set below the bottom of the range, or RPE 10)
//   → move down the chain, or reduce volume if there is no easier step
// - anything else → keep going as planned

export type ExerciseInfo = { id: string; name: string; metric: Metric; category: ExerciseCategory };

export type ExerciseResult = {
  plannedSets: number;
  targetMin: number;
  targetMax: number;
  values: number[];
  rpe: number | null;
  skipped: boolean;
};

export type Decision =
  | { type: "hold" }
  | { type: "increase_target"; delta: number }
  | { type: "add_set" }
  | { type: "advance"; toExerciseId: string; targetMin: number; targetMax: number }
  | { type: "regress"; toExerciseId: string; targetMin: number; targetMax: number }
  | { type: "reduce_volume"; targetDelta: number };

export const MAX_SETS = 6;
const REQUIRED_SESSIONS = 2;

/** Highest target before moving to the next exercise in the chain. */
export function ceiling(e: Pick<ExerciseInfo, "metric" | "category">) {
  if (e.category === "skill") return e.metric === "reps" ? 6 : 30;
  return e.metric === "reps" ? 12 : 45;
}

/** Step size when raising or lowering targets. */
export function stepSize(e: Pick<ExerciseInfo, "metric" | "category">) {
  if (e.metric === "seconds") return 5;
  return e.category === "skill" ? 1 : 2;
}

/** Starting range on a new, harder exercise. */
export function entryRange(e: Pick<ExerciseInfo, "metric" | "category">): [number, number] {
  if (e.category === "skill") return e.metric === "reps" ? [3, 5] : [10, 15];
  return e.metric === "reps" ? [5, 8] : [10, 20];
}

/** Comfortable range on an easier exercise after regressing. */
export function regressRange(e: Pick<ExerciseInfo, "metric" | "category">): [number, number] {
  if (e.category === "skill") return e.metric === "reps" ? [4, 6] : [15, 20];
  return e.metric === "reps" ? [8, 12] : [20, 30];
}

/** Results with nothing logged (and not skipped) carry no information. */
function counts(r: ExerciseResult) {
  return !r.skipped && r.values.length > 0;
}

export function isSuccess(r: ExerciseResult) {
  return (
    counts(r) &&
    r.values.length >= r.plannedSets &&
    r.values.every((v) => v >= r.targetMax) &&
    // No RPE logged: the reps/holds speak for themselves.
    (r.rpe === null || r.rpe <= 8)
  );
}

export function isFailure(r: ExerciseResult) {
  return counts(r) && (r.values.some((v) => v < r.targetMin) || r.rpe === 10);
}

/**
 * @param history results for ONE exercise, newest first, only from sessions
 *   since the last progression change for that exercise
 * @param chain the exercise and its eligible neighbours in its progression chain
 */
export function decideProgression(
  history: ExerciseResult[],
  chain: { current: ExerciseInfo; next?: ExerciseInfo; prev?: ExerciseInfo },
): Decision {
  const recent = history.filter(counts).slice(0, REQUIRED_SESSIONS);
  if (recent.length < REQUIRED_SESSIONS) return { type: "hold" };
  const latest = recent[0];

  if (recent.every(isSuccess)) {
    const top = ceiling(chain.current);
    if (latest.targetMax < top) {
      return { type: "increase_target", delta: Math.min(stepSize(chain.current), top - latest.targetMax) };
    }
    if (chain.next) {
      const [targetMin, targetMax] = entryRange(chain.next);
      return { type: "advance", toExerciseId: chain.next.id, targetMin, targetMax };
    }
    return latest.plannedSets < MAX_SETS ? { type: "add_set" } : { type: "hold" };
  }

  if (recent.every(isFailure)) {
    if (chain.prev) {
      const [targetMin, targetMax] = regressRange(chain.prev);
      return { type: "regress", toExerciseId: chain.prev.id, targetMin, targetMax };
    }
    return { type: "reduce_volume", targetDelta: -stepSize(chain.current) };
  }

  return { type: "hold" };
}

/**
 * The eligible neighbours of an exercise in its chain (skipping steps the user
 * can't do, e.g. ones needing equipment they don't have).
 */
export function chainNeighbours<E extends ExerciseInfo & { chain: string; chain_order: number }>(
  current: E,
  eligible: E[],
): { next?: E; prev?: E } {
  const sameChain = eligible.filter((e) => e.chain === current.chain && e.id !== current.id);
  const next = sameChain.filter((e) => e.chain_order > current.chain_order).sort((a, b) => a.chain_order - b.chain_order)[0];
  const prev = sameChain.filter((e) => e.chain_order < current.chain_order).sort((a, b) => b.chain_order - a.chain_order)[0];
  return { next, prev };
}

export function describeDecision(d: Decision, current: ExerciseInfo, names: Map<string, string>): string | null {
  const unit = current.metric === "reps" ? "reps" : "s";
  switch (d.type) {
    case "hold":
      return null;
    case "increase_target":
      return `${current.name}: targets up by ${d.delta} ${unit}`;
    case "add_set":
      return `${current.name}: one extra set`;
    case "advance":
      return `${current.name} → ${names.get(d.toExerciseId) ?? d.toExerciseId} (level up!)`;
    case "regress":
      return `${current.name} → ${names.get(d.toExerciseId) ?? d.toExerciseId} (an easier step to build strength)`;
    case "reduce_volume":
      return `${current.name}: one set fewer and slightly easier targets`;
  }
}
