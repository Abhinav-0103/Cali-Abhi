import { describe, expect, it } from "vitest";
import { addDays, weekStart, weekStreak, weeklyAdherence } from "./stats";

// 2026-10-29 is a Thursday; its week starts Monday 2026-10-26.
const today = "2026-10-29";

describe("weekStart", () => {
  it("returns the Monday of the week", () => {
    expect(weekStart("2026-10-29")).toBe("2026-10-26");
    expect(weekStart("2026-10-26")).toBe("2026-10-26");
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // Sunday
    expect(weekStart("2026-01-01")).toBe("2025-12-29"); // across a year boundary
  });
  it("adds days", () => expect(addDays("2026-10-30", 3)).toBe("2026-11-02"));
});

describe("weeklyAdherence", () => {
  it("counts workouts per week against the target, oldest first", () => {
    const weeks = weeklyAdherence(["2026-10-27", "2026-10-28", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"], 3, today, 3);
    expect(weeks).toEqual([
      { weekStart: "2026-10-12", completed: 0, target: 3, percent: 0 },
      { weekStart: "2026-10-19", completed: 4, target: 3, percent: 100 }, // capped at 100
      { weekStart: "2026-10-26", completed: 2, target: 3, percent: 67 },
    ]);
  });
});

describe("weekStreak", () => {
  const met = (monday: string) => [monday, addDays(monday, 2), addDays(monday, 4)];

  it("counts consecutive weeks that met the target", () => {
    expect(weekStreak([...met("2026-10-12"), ...met("2026-10-19")], 3, today)).toBe(2);
  });

  it("doesn't break the streak during an unfinished current week, and includes it once met", () => {
    const past = [...met("2026-10-12"), ...met("2026-10-19")];
    expect(weekStreak([...past, "2026-10-26"], 3, today)).toBe(2);
    expect(weekStreak([...past, ...met("2026-10-26")], 3, today)).toBe(3);
  });

  it("is broken by a missed week", () => {
    expect(weekStreak([...met("2026-10-05"), ...met("2026-10-19")], 3, today)).toBe(1);
    expect(weekStreak([], 3, today)).toBe(0);
  });
});
