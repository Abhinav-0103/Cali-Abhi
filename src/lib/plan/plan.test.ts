import { describe, expect, it } from "vitest";
import { EQUIPMENT, EXPERIENCE_LEVELS, GOALS, type Equipment } from "@/lib/constants";
import { EXERCISES } from "@/lib/exercises/library";
import { filterExercises, startingPoints } from "@/lib/exercises/filter";
import { templatePlan, type TemplateInput } from "./template";
import { validatePlan, type PlanContext } from "./validate";
import type { PlanOutput } from "./schema";

const baseline = { pushUps: 12, pullUps: 2, squats: 30, plankSeconds: 60, deadHangSeconds: 30 };

function setup(overrides: Partial<TemplateInput> & { equipment?: Equipment[] } = {}) {
  const { equipment = ["pull_up_bar", "dip_bars"], ...rest } = overrides;
  const experience = rest.experience ?? "intermediate";
  const conservative = rest.conservative ?? false;
  const eligible = filterExercises(EXERCISES, { equipment, injuryAreas: [], experience, conservative });
  const input: TemplateInput = {
    goal: "build_muscle",
    skillGoals: [],
    experience,
    daysPerWeek: 3,
    minutesPerSession: 45,
    preferredDays: [],
    conservative,
    eligible,
    starts: startingPoints(eligible, baseline),
    ...rest,
  };
  const ctx: PlanContext = {
    eligibleById: new Map(eligible.map((e) => [e.id, e])),
    daysPerWeek: input.daysPerWeek,
    preferredDays: input.preferredDays,
    minutesPerSession: input.minutesPerSession,
  };
  return { input, ctx };
}

describe("templatePlan", () => {
  it("always produces a valid plan, for every combination of options", () => {
    let checked = 0;
    for (const goal of GOALS)
      for (const experience of EXPERIENCE_LEVELS)
        for (const daysPerWeek of [2, 3, 4, 5, 6])
          for (const minutesPerSession of [20, 45, 90])
            for (const equipment of [[], [...EQUIPMENT]] as Equipment[][])
              for (const conservative of [false, true]) {
                const { input, ctx } = setup({
                  goal, experience, daysPerWeek, minutesPerSession, equipment, conservative,
                  skillGoals: goal === "skills" ? ["handstand", "muscle_up"] : [],
                });
                const result = validatePlan(templatePlan(input), ctx);
                expect(result.ok ? [] : result.errors, JSON.stringify({ goal, experience, daysPerWeek, minutesPerSession, equipment, conservative })).toEqual([]);
                checked++;
              }
    expect(checked).toBe(5 * 3 * 5 * 3 * 2 * 2);
  });

  it("uses preferred days and progresses across weeks", () => {
    const { input, ctx } = setup({ preferredDays: [1, 3, 5] });
    const plan = templatePlan(input);
    expect(plan.weeks[0].days.map((d) => d.weekday)).toEqual([1, 3, 5]);
    const pushW1 = plan.weeks[0].days[0].exercises.find((e) => e.exercise_id === "push_up")!;
    const pushW3 = plan.weeks[2].days[0].exercises.find((e) => e.exercise_id === "push_up")!;
    expect(pushW3.rep_range!.max).toBeGreaterThan(pushW1.rep_range!.max);
    // intermediate: week 4 deload has fewer sets
    const pushW4 = plan.weeks[3].days[0].exercises.find((e) => e.exercise_id === "push_up")!;
    expect(pushW4.sets).toBeLessThan(pushW3.sets);
    expect(validatePlan(plan, ctx).ok).toBe(true);
  });

  it("puts pull-up work first for the first pull-up goal", () => {
    const { input } = setup({ goal: "first_pull_up" });
    for (const day of templatePlan(input).weeks[0].days) {
      const first = day.exercises.find((e) => e.block === "main")!.exercise_id;
      expect(EXERCISES.find((e) => e.id === first)!.chain).toBe("pull_up");
    }
  });
});

describe("validatePlan", () => {
  const { input, ctx } = setup();
  const valid = () => structuredClone(templatePlan(input)) as PlanOutput;

  it("accepts a valid plan and normalises it for storage", () => {
    const result = validatePlan(valid(), ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const first = result.weeks[0].days[0].exercises[0];
    expect(first).toMatchObject({ block: "warmup", sets: 1 });
    expect(first).toHaveProperty("target_min");
  });

  it("rejects malformed JSON shapes with readable paths", () => {
    const result = validatePlan({ summary: "x", weeks: [{ week_number: 1 }] }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join("\n")).toMatch(/weeks/);
  });

  it("rejects exercise ids that are unknown or filtered out for this user", () => {
    const plan = valid();
    plan.weeks[0].days[0].exercises[3].exercise_id = "ring_dip"; // user has no rings
    plan.weeks[1].days[0].exercises[3].exercise_id = "made_up_move";
    const result = validatePlan(plan, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('"ring_dip"'))).toBe(true);
      expect(result.errors.some((e) => e.includes('"made_up_move"'))).toBe(true);
    }
  });

  it("rejects a range type that doesn't match the exercise metric", () => {
    const plan = valid();
    const item = plan.weeks[0].days[0].exercises.find((e) => e.exercise_id === "push_up")!;
    item.hold_range = item.rep_range;
    item.rep_range = null;
    const result = validatePlan(plan, ctx);
    expect(!result.ok && result.errors.some((e) => e.includes("rep_range is required"))).toBe(true);
  });

  it("rejects the wrong number of days, duplicate weekdays and missing blocks", () => {
    const plan = valid();
    plan.weeks[0].days.pop();
    plan.weeks[1].days[1].weekday = plan.weeks[1].days[0].weekday;
    plan.weeks[2].days[0].exercises = plan.weeks[2].days[0].exercises.filter((e) => e.block !== "cooldown");
    const result = validatePlan(plan, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const text = result.errors.join("\n");
      expect(text).toMatch(/week 1: has 2 days/);
      expect(text).toMatch(/week 2: two days share the same weekday/);
      expect(text).toMatch(/week 3 day 1: needs at least one cooldown/);
    }
  });

  it("rejects sessions that are much longer than the user's time", () => {
    const plan = valid();
    for (const e of plan.weeks[0].days[0].exercises) if (e.block === "main") e.sets = 10;
    const result = validatePlan(plan, ctx);
    expect(!result.ok && result.errors.some((e) => e.includes("over the user's 45 min"))).toBe(true);
  });

  it("rejects mobility drills in the main block", () => {
    const plan = valid();
    plan.weeks[0].days[0].exercises.find((e) => e.block === "main")!.exercise_id = "arm_circles";
    const fix = plan.weeks[0].days[0].exercises.find((e) => e.exercise_id === "arm_circles" && e.block === "main")!;
    fix.hold_range = { min: 30, max: 30 };
    fix.rep_range = null;
    const result = validatePlan(plan, ctx);
    expect(!result.ok && result.errors.some((e) => e.includes("mobility drill"))).toBe(true);
  });
});
