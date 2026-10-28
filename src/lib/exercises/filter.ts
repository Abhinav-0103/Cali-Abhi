import type { BodyPart, Equipment, Experience } from "@/lib/constants";
import type { Exercise } from "./library";

export type FilterProfile = {
  equipment: Equipment[];
  injuryAreas: BodyPart[];
  experience: Experience;
  conservative: boolean;
};

const LEVEL_CAP: Record<Experience, number> = { beginner: 6, intermediate: 8, advanced: 10 };
export const CONSERVATIVE_LEVEL_CAP = 5;

export function levelCap(experience: Experience, conservative: boolean) {
  return conservative ? Math.min(CONSERVATIVE_LEVEL_CAP, LEVEL_CAP[experience]) : LEVEL_CAP[experience];
}

/**
 * Exercises this user may be given: equipment they own, nothing that loads an
 * injured body part, and nothing above their level cap. Runs on the server
 * BEFORE anything is sent to the model, and again when validating its output.
 */
export function filterExercises(library: Exercise[], profile: FilterProfile): Exercise[] {
  const cap = levelCap(profile.experience, profile.conservative);
  return library.filter(
    (e) =>
      e.level <= cap &&
      e.equipment.every((item) => profile.equipment.includes(item)) &&
      !e.contraindications.some((part) => profile.injuryAreas.includes(part)),
  );
}

export type Baseline = {
  pushUps: number;
  pullUps: number;
  squats: number;
  plankSeconds: number;
  deadHangSeconds: number;
};

// Highest exercise in a chain the baseline says the user can work with.
// Thresholds are deliberately conservative: progression moves people up fast.
const START_RULES: Record<string, (b: Baseline) => string[]> = {
  push_up: (b) =>
    b.pushUps >= 25 ? ["push_up_archer", "push_up_decline", "push_up_diamond", "push_up"]
    : b.pushUps >= 15 ? ["push_up_diamond", "push_up"]
    : b.pushUps >= 8 ? ["push_up"]
    : b.pushUps >= 3 ? ["push_up_knee", "push_up_incline"]
    : ["push_up_incline", "push_up_wall"],
  pull_up: (b) =>
    b.pullUps >= 12 ? ["pull_up_archer", "pull_up"]
    : b.pullUps >= 5 ? ["pull_up"]
    : b.pullUps >= 1 ? ["chin_up", "pull_up_negative"]
    : b.deadHangSeconds >= 30 ? ["pull_up_band", "pull_up_negative", "scapular_pull"]
    : b.deadHangSeconds >= 10 ? ["scapular_pull", "dead_hang"]
    : ["dead_hang"],
  row: (b) => (b.pullUps >= 5 ? ["ring_row_feet_elevated", "ring_row"] : ["ring_row", "ring_row_high", "row_band", "row_towel_door"]),
  dip: (b) =>
    b.pushUps >= 25 ? ["dip", "dip_negative"] : b.pushUps >= 12 ? ["dip_negative", "dip_band", "dip_support_hold"] : ["dip_support_hold", "bench_dip"],
  squat: (b) =>
    b.squats >= 50 ? ["bulgarian_split_squat", "split_squat"]
    : b.squats >= 25 ? ["split_squat", "reverse_lunge", "squat"]
    : b.squats >= 10 ? ["squat"]
    : ["squat_assisted"],
  l_sit: (b) => (b.plankSeconds >= 90 ? ["hollow_hold", "hollow_body_tuck"] : b.plankSeconds >= 45 ? ["hollow_body_tuck", "plank"] : ["plank"]),
};

/** Suggested starting exercise per chain, limited to eligible exercises. */
export function startingPoints(eligible: Exercise[], baseline: Baseline): Record<string, string> {
  const eligibleIds = new Set(eligible.map((e) => e.id));
  const result: Record<string, string> = {};
  const chains = Map.groupBy(eligible, (e) => e.chain);

  for (const [chain, list] of chains) {
    if (chain === "warmup" || chain === "cooldown") continue;
    const preferred = START_RULES[chain]?.(baseline).find((id) => eligibleIds.has(id));
    // Without a rule (skills etc.) start at the easiest eligible step.
    result[chain] = preferred ?? [...list].sort((a, b) => a.chain_order - b.chain_order)[0].id;
  }
  return result;
}
