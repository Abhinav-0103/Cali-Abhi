import { describe, expect, it } from "vitest";
import { EXERCISES, EXERCISES_BY_ID } from "@/lib/exercises/library";
import { filterExercises } from "@/lib/exercises/filter";
import type { StoredPlanWeek } from "@/lib/plan/schema";
import { applyDecisions } from "./apply";
import {
  chainNeighbours,
  decideProgression,
  describeDecision,
  isFailure,
  isSuccess,
  type ExerciseInfo,
  type ExerciseResult,
} from "./engine";

const ex = (id: string) => EXERCISES_BY_ID.get(id)!;
const chainOf = (id: string, eligible = EXERCISES) => ({ current: ex(id), ...chainNeighbours(ex(id), eligible) });

const result = (values: number[], o: Partial<ExerciseResult> = {}): ExerciseResult => ({
  plannedSets: 3,
  targetMin: 8,
  targetMax: 12,
  values,
  rpe: 7,
  skipped: false,
  ...o,
});

const top = (o: Partial<ExerciseResult> = {}) => result([12, 12, 12], o);
const fail = (o: Partial<ExerciseResult> = {}) => result([9, 7, 6], o);

describe("isSuccess / isFailure", () => {
  it("success needs every planned set at the top of the range with RPE ≤ 8", () => {
    expect(isSuccess(top())).toBe(true);
    expect(isSuccess(top({ rpe: 8 }))).toBe(true);
    expect(isSuccess(top({ rpe: 9 }))).toBe(false);
    expect(isSuccess(result([12, 12, 11]))).toBe(false);
    expect(isSuccess(result([12, 12]))).toBe(false); // a planned set missing
    expect(isSuccess(top({ rpe: null }))).toBe(true); // no RPE logged: the numbers count
  });

  it("failure is a set below the bottom of the range, or RPE 10", () => {
    expect(isFailure(fail())).toBe(true);
    expect(isFailure(result([10, 10, 10], { rpe: 10 }))).toBe(true);
    expect(isFailure(result([10, 9, 8], { rpe: 9 }))).toBe(false);
  });

  it("skipped or empty results are neither", () => {
    expect(isSuccess(top({ skipped: true }))).toBe(false);
    expect(isFailure(result([], { rpe: 10 }))).toBe(false);
  });
});

describe("decideProgression", () => {
  it("holds with fewer than two sessions of data", () => {
    expect(decideProgression([top()], chainOf("push_up"))).toEqual({ type: "hold" });
    expect(decideProgression([], chainOf("push_up"))).toEqual({ type: "hold" });
  });

  it("raises the target after two successful sessions below the ceiling", () => {
    const low = (o = {}) => result([10, 10, 10], { targetMin: 6, targetMax: 10, ...o });
    expect(decideProgression([low(), low()], chainOf("push_up"))).toEqual({ type: "increase_target", delta: 2 });
  });

  it("never raises past the ceiling (partial step)", () => {
    const r = result([11, 11, 11], { targetMin: 7, targetMax: 11 });
    expect(decideProgression([r, r], chainOf("push_up"))).toEqual({ type: "increase_target", delta: 1 });
  });

  it("holds steps for seconds and skills", () => {
    const plank = result([30, 30], { plannedSets: 2, targetMin: 20, targetMax: 30 });
    expect(decideProgression([plank, plank], chainOf("plank"))).toEqual({ type: "increase_target", delta: 5 });
    const skill = result([4, 4, 4], { targetMin: 3, targetMax: 4 });
    expect(decideProgression([skill, skill], chainOf("wall_walk"))).toEqual({ type: "increase_target", delta: 1 });
  });

  it("moves to the next exercise in the chain at the ceiling, with an entry range", () => {
    expect(decideProgression([top(), top()], chainOf("push_up"))).toEqual({
      type: "advance",
      toExerciseId: "push_up_diamond",
      targetMin: 5,
      targetMax: 8,
    });
  });

  it("uses the next exercise's metric for its entry range (hold → reps)", () => {
    const hang = result([45, 45, 45], { targetMin: 35, targetMax: 45 });
    expect(decideProgression([hang, hang], chainOf("dead_hang"))).toMatchObject({
      type: "advance",
      toExerciseId: "scapular_pull",
      targetMin: 5,
      targetMax: 8,
    });
  });

  it("skips chain steps the user can't do (equipment)", () => {
    const eligible = filterExercises(EXERCISES, { equipment: ["pull_up_bar"], injuryAreas: [], experience: "advanced", conservative: false });
    // pull_up_band needs bands: negative → chin-up directly
    expect(chainOf("pull_up_negative", eligible).next?.id).toBe("chin_up");
    expect(chainOf("chin_up", eligible).prev?.id).toBe("pull_up_negative");
  });

  it("adds a set at the top of the last chain step, up to the maximum", () => {
    const eligible = filterExercises(EXERCISES, { equipment: [], injuryAreas: [], experience: "beginner", conservative: false });
    // pseudo-planche (level 7) is above the beginner cap, so archer is the top step
    const chain = chainOf("push_up_archer", eligible);
    expect(chain.next).toBeUndefined();
    expect(decideProgression([top(), top()], chain)).toEqual({ type: "add_set" });
    const six = top({ plannedSets: 6, values: [12, 12, 12, 12, 12, 12] });
    expect(decideProgression([six, six], chain)).toEqual({ type: "hold" });
  });

  it("regresses one step after two failed sessions", () => {
    expect(decideProgression([fail(), fail()], chainOf("pull_up"))).toEqual({
      type: "regress",
      toExerciseId: "chin_up",
      targetMin: 8,
      targetMax: 12,
    });
  });

  it("treats RPE 10 twice as failure", () => {
    const maxed = result([12, 12, 12], { rpe: 10 });
    expect(decideProgression([maxed, maxed], chainOf("push_up")).type).toBe("regress");
  });

  it("reduces volume when there is no easier step", () => {
    expect(decideProgression([fail(), fail()], chainOf("push_up_wall"))).toEqual({ type: "reduce_volume", targetDelta: -2 });
  });

  it("holds on mixed results, and ignores skipped/empty sessions in between", () => {
    expect(decideProgression([top(), fail()], chainOf("push_up"))).toEqual({ type: "hold" });
    expect(decideProgression([top(), result([], { skipped: true }), top()], chainOf("push_up")).type).toBe("advance");
  });

  it("describes decisions for the user", () => {
    const names = new Map(EXERCISES.map((e) => [e.id, e.name]));
    expect(describeDecision({ type: "advance", toExerciseId: "push_up_diamond", targetMin: 5, targetMax: 8 }, ex("push_up"), names)).toBe(
      "Push-up → Diamond push-up (level up!)",
    );
    expect(describeDecision({ type: "hold" }, ex("push_up"), names)).toBeNull();
  });
});

describe("applyDecisions", () => {
  const item = (exercise_id: string, o = {}) => ({
    block: "main" as const,
    exercise_id,
    sets: 3,
    target_min: 8,
    target_max: 12,
    rest_seconds: 90,
    notes: "cue",
    ...o,
  });
  const weeks = (): StoredPlanWeek[] =>
    [1, 2].map((week_number) => ({
      week_number,
      focus: "",
      days: [1, 2].map((day_number) => ({
        day_number,
        weekday: day_number,
        title: "Day",
        focus: "",
        exercises: [
          { ...item("arm_circles"), block: "warmup" as const },
          item("push_up", week_number === 2 ? { target_min: 10, target_max: 14 } : {}),
          item("squat"),
        ],
      })),
    }));
  const info = new Map<string, ExerciseInfo>(EXERCISES.map((e) => [e.id, e]));
  const done = new Set(["1-1"]);

  it("changes only future days and leaves the input untouched", () => {
    const input = weeks();
    const before = JSON.stringify(input);
    const { weeks: out, changed } = applyDecisions(
      input,
      [{ exerciseId: "push_up", decision: { type: "advance", toExerciseId: "push_up_diamond", targetMin: 5, targetMax: 8 } }],
      done,
      info,
    );
    expect(changed).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
    expect(out[0].days[0].exercises[1].exercise_id).toBe("push_up"); // completed day kept
    expect(out[0].days[1].exercises[1]).toMatchObject({ exercise_id: "push_up_diamond", target_min: 5, target_max: 8, notes: null });
    expect(out[1].days[1].exercises[1].exercise_id).toBe("push_up_diamond");
    expect(out[0].days[1].exercises[0].exercise_id).toBe("arm_circles"); // warm-up untouched
  });

  it("raises targets without ever lowering later, higher weeks", () => {
    const { weeks: out } = applyDecisions(weeks(), [{ exerciseId: "push_up", decision: { type: "increase_target", delta: 2 } }], done, info);
    expect(out[0].days[1].exercises[1]).toMatchObject({ target_min: 10, target_max: 12 }); // capped at the ceiling
    expect(out[1].days[0].exercises[1]).toMatchObject({ target_min: 12, target_max: 14 }); // already above: not lowered
  });

  it("reduces volume and adds sets within bounds", () => {
    const { weeks: less } = applyDecisions(weeks(), [{ exerciseId: "squat", decision: { type: "reduce_volume", targetDelta: -2 } }], done, info);
    expect(less[0].days[1].exercises[2]).toMatchObject({ sets: 2, target_min: 6, target_max: 10 });
    const { weeks: more } = applyDecisions(weeks(), [{ exerciseId: "squat", decision: { type: "add_set" } }], done, info);
    expect(more[0].days[1].exercises[2].sets).toBe(4);
  });

  it("doesn't create duplicates when the day already has the new exercise", () => {
    const { weeks: out, changed } = applyDecisions(
      weeks(),
      [{ exerciseId: "push_up", decision: { type: "advance", toExerciseId: "squat", targetMin: 5, targetMax: 8 } }],
      done,
      info,
    );
    expect(changed).toBe(false);
    expect(out[0].days[1].exercises.map((e) => e.exercise_id)).toEqual(["arm_circles", "push_up", "squat"]);
  });

  it("reports no change for holds", () => {
    expect(applyDecisions(weeks(), [{ exerciseId: "push_up", decision: { type: "hold" } }], done, info).changed).toBe(false);
  });
});
