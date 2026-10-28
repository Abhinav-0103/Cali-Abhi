import { describe, expect, it } from "vitest";
import {
  abandonWorkout,
  createWorkout,
  finishWorkout,
  logSet,
  nextPlanDay,
  removeLastSet,
  setRpe,
  setSkipped,
  setsFor,
  summarise,
  unloggedSets,
} from "./logic";
import type { StartableDay } from "./types";

let counter = 0;
const newId = () => `id-${++counter}`;
const now = "2026-10-29T10:00:00.000Z";

const day: StartableDay = {
  planId: "plan",
  planDayId: "day",
  weekNumber: 1,
  dayNumber: 2,
  title: "Full body B",
  exercises: [
    { id: "pe1", block: "warmup", exerciseId: "arm_circles", name: "Arm circles", metric: "seconds", unilateral: false, cues: [], sets: 1, targetMin: 30, targetMax: 30, restSeconds: 0, notes: null },
    { id: "pe2", block: "main", exerciseId: "push_up", name: "Push-up", metric: "reps", unilateral: false, cues: ["Brace"], sets: 3, targetMin: 8, targetMax: 12, restSeconds: 90, notes: null },
    { id: "pe3", block: "main", exerciseId: "plank", name: "Plank", metric: "seconds", unilateral: false, cues: [], sets: 2, targetMin: 30, targetMax: 45, restSeconds: 60, notes: null },
    { id: "pe4", block: "cooldown", exerciseId: "childs_pose", name: "Child's pose", metric: "seconds", unilateral: false, cues: [], sets: 1, targetMin: 30, targetMax: 30, restSeconds: 0, notes: null },
  ],
};

const start = () => createWorkout(day, { userId: "user", today: "2026-10-29", now, newId });

describe("createWorkout", () => {
  it("snapshots main exercises and lists warm-up and cool-down separately", () => {
    const w = start();
    expect(w.session).toMatchObject({ status: "in_progress", plan_id: "plan", week_number: 1, day_number: 2, performed_on: "2026-10-29" });
    expect(w.exercises.map((e) => [e.exercise_id, e.position, e.planned_sets, e.plan_exercise_id])).toEqual([
      ["push_up", 1, 3, "pe2"],
      ["plank", 2, 2, "pe3"],
    ]);
    expect(w.warmup).toEqual([{ name: "Arm circles", target: "30 s" }]);
    expect(w.cooldown).toHaveLength(1);
    expect(w.rev).toBeGreaterThan(w.syncedRev);
  });
});

describe("logging", () => {
  it("logs, overwrites and removes sets, bumping rev every time", () => {
    let w = start();
    const push = w.exercises[0].id;
    w = logSet(w, push, 1, 10, { now, newId });
    w = logSet(w, push, 2, 9, { now, newId });
    const rev = w.rev;
    w = logSet(w, push, 2, 11, { now, newId });
    expect(w.rev).toBe(rev + 1);
    expect(setsFor(w, push).map((s) => s.value)).toEqual([10, 11]);

    const removedId = setsFor(w, push)[1].id;
    w = removeLastSet(w, push);
    expect(setsFor(w, push).map((s) => s.value)).toEqual([10]);
    expect(w.deletedSetIds).toEqual([removedId]);
  });

  it("rejects impossible values", () => {
    const w = start();
    expect(() => logSet(w, w.exercises[0].id, 1, -1, { now, newId })).toThrow();
    expect(() => logSet(w, w.exercises[0].id, 1, 2.5, { now, newId })).toThrow();
    expect(() => setRpe(w, w.exercises[0].id, 11)).toThrow();
  });

  it("logging a set un-skips the exercise", () => {
    let w = start();
    const plank = w.exercises[1].id;
    w = setSkipped(w, plank, true);
    expect(unloggedSets(w)).toBe(3);
    w = logSet(w, plank, 1, 40, { now, newId });
    expect(w.exercises[1].skipped).toBe(false);
  });

  it("counts unlogged sets and summarises the workout", () => {
    let w = start();
    const [push, plank] = w.exercises.map((e) => e.id);
    for (const [n, v] of [[1, 12], [2, 10], [3, 8]]) w = logSet(w, push, n, v, { now, newId });
    w = logSet(w, plank, 1, 45, { now, newId });
    w = setRpe(w, push, 8);
    expect(unloggedSets(w)).toBe(1);

    w = finishWorkout(w, "2026-10-29T10:41:00.000Z");
    expect(w.session.status).toBe("completed");
    const s = summarise(w);
    expect(s).toMatchObject({ durationMinutes: 41, setsLogged: 4, setsPlanned: 5, totalReps: 30, totalHoldSeconds: 45 });
    expect(s.exercises[0]).toMatchObject({ rpe: 8, hitTarget: true });
    expect(s.exercises[1].hitTarget).toBe(false);
  });

  it("can abandon a workout", () => {
    expect(abandonWorkout(start(), now).session.status).toBe("abandoned");
  });
});

describe("nextPlanDay", () => {
  const weeks = [1, 2].map((weekNumber) => ({ weekNumber, days: [{ dayNumber: 1 }, { dayNumber: 2 }] }));

  it("returns the first day without a completed session", () => {
    expect(nextPlanDay(weeks, [])).toMatchObject({ weekNumber: 1, day: { dayNumber: 1 } });
    expect(nextPlanDay(weeks, [{ week_number: 1, day_number: 1 }])).toMatchObject({ weekNumber: 1, day: { dayNumber: 2 } });
  });

  it("carries on after skipped days and finishes after the last one", () => {
    expect(nextPlanDay(weeks, [{ week_number: 1, day_number: 2 }])).toMatchObject({ weekNumber: 1, day: { dayNumber: 1 } });
    const all = weeks.flatMap((w) => w.days.map((d) => ({ week_number: w.weekNumber, day_number: d.dayNumber })));
    expect(nextPlanDay(weeks, all)).toBeNull();
  });
});
