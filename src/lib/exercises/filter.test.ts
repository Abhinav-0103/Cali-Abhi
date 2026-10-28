import { describe, expect, it } from "vitest";
import { EXERCISES } from "./library";
import { filterExercises, startingPoints, type Baseline, type FilterProfile } from "./filter";

const base: FilterProfile = { equipment: [], injuryAreas: [], experience: "beginner", conservative: false };
const ids = (p: Partial<FilterProfile>) => new Set(filterExercises(EXERCISES, { ...base, ...p }).map((e) => e.id));

describe("filterExercises", () => {
  it("removes exercises needing equipment the user doesn't have", () => {
    const none = ids({});
    expect(none.has("pull_up")).toBe(false);
    expect(none.has("push_up")).toBe(true);
    expect(ids({ equipment: ["pull_up_bar"] }).has("pull_up")).toBe(true);
    // needs BOTH bar and bands
    expect(ids({ equipment: ["pull_up_bar"] }).has("pull_up_band")).toBe(false);
    expect(ids({ equipment: ["pull_up_bar", "bands"] }).has("pull_up_band")).toBe(true);
  });

  it("removes exercises contraindicated for an injured body part", () => {
    const wrist = ids({ injuryAreas: ["wrist"] });
    expect(wrist.has("push_up")).toBe(false);
    expect(wrist.has("push_up_wall")).toBe(true);
    for (const e of filterExercises(EXERCISES, { ...base, injuryAreas: ["knee", "shoulder"] })) {
      expect(e.contraindications).not.toContain("knee");
      expect(e.contraindications).not.toContain("shoulder");
    }
  });

  it("caps levels by experience and conservative mode", () => {
    const all = ["pull_up_bar", "dip_bars", "rings", "bands"] as const;
    const max = (p: Partial<FilterProfile>) =>
      Math.max(...filterExercises(EXERCISES, { ...base, equipment: [...all], ...p }).map((e) => e.level));
    expect(max({ experience: "beginner" })).toBe(6);
    expect(max({ experience: "intermediate" })).toBe(8);
    expect(max({ experience: "advanced" })).toBe(10);
    expect(max({ experience: "advanced", conservative: true })).toBe(5);
  });

  it("always leaves warm-up, cool-down and basic exercises available", () => {
    const worst = ids({ injuryAreas: ["neck", "shoulder", "elbow", "wrist", "lower_back", "hip", "knee", "ankle"], conservative: true });
    for (const id of ["arm_circles", "cat_cow", "hip_circles", "hamstring_stretch", "plank", "squat_assisted"]) {
      expect(worst.has(id), id).toBe(true);
    }
  });
});

describe("startingPoints", () => {
  const eligible = filterExercises(EXERCISES, { ...base, equipment: ["pull_up_bar", "dip_bars", "bands"], experience: "intermediate" });
  const baseline: Baseline = { pushUps: 10, pullUps: 0, squats: 30, plankSeconds: 50, deadHangSeconds: 35 };

  it("maps the baseline test to a sensible start in each chain", () => {
    const s = startingPoints(eligible, baseline);
    expect(s.push_up).toBe("push_up");
    expect(s.pull_up).toBe("pull_up_band");
    expect(s.squat).toBe("split_squat");
    expect(s.l_sit).toBe("hollow_body_tuck");
  });

  it("starts weaker users lower", () => {
    const s = startingPoints(eligible, { pushUps: 0, pullUps: 0, squats: 5, plankSeconds: 10, deadHangSeconds: 5 });
    expect(s.push_up).toBe("push_up_incline");
    expect(s.pull_up).toBe("dead_hang");
    expect(s.squat).toBe("squat_assisted");
  });

  it("only suggests eligible exercises", () => {
    const allowed = new Set(eligible.map((e) => e.id));
    for (const id of Object.values(startingPoints(eligible, baseline))) expect(allowed.has(id), id).toBe(true);
  });
});
