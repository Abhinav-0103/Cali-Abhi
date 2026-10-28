import { describe, expect, it } from "vitest";
import { EXERCISES } from "./library";

describe("exercise library", () => {
  it("has about 80 exercises with unique ids", () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(80);
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
  });

  it("uses snake_case ids that match the database CHECK constraint", () => {
    for (const e of EXERCISES) expect(e.id).toMatch(/^[a-z0-9_]+$/);
  });

  it("has levels between 1 and 10 and never decreases along a progression chain", () => {
    const chains = Map.groupBy(EXERCISES, (e) => e.chain);
    for (const [chain, list] of chains) {
      if (chain === "warmup" || chain === "cooldown") continue;
      const levels = [...list].sort((a, b) => a.chain_order - b.chain_order).map((e) => e.level);
      expect(levels, chain).toEqual([...levels].sort((a, b) => a - b));
      for (const l of levels) expect(l).toBeGreaterThanOrEqual(1);
      for (const l of levels) expect(l).toBeLessThanOrEqual(10);
    }
  });

  it("covers the required progression chains", () => {
    const chains = new Set(EXERCISES.map((e) => e.chain));
    for (const c of ["push_up", "pull_up", "dip", "squat", "l_sit", "handstand", "muscle_up"]) {
      expect(chains.has(c), c).toBe(true);
    }
  });

  it("gives every exercise at least two coaching cues", () => {
    for (const e of EXERCISES) expect(e.cues.length, e.id).toBeGreaterThanOrEqual(2);
  });

  it("offers a no-equipment option in every main movement category", () => {
    for (const category of ["push", "pull", "dips", "legs", "core"] as const) {
      expect(EXERCISES.some((e) => e.category === category && e.equipment.length === 0), category).toBe(true);
    }
  });
});

describe("chain ordering", () => {
  it("numbers every chain 1..n", () => {
    for (const [chain, list] of Map.groupBy(EXERCISES, (e) => e.chain)) {
      expect(list.map((e) => e.chain_order).sort((a, b) => a - b), chain).toEqual(list.map((_, i) => i + 1));
    }
  });
});
