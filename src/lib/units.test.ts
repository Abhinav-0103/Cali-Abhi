import { describe, expect, it } from "vitest";
import { cmFromFtIn, formatHeight, formatWeight, ftInFromCm, kgFromLb, lbFromKg } from "./units";

describe("units", () => {
  it("converts feet and inches to cm", () => {
    expect(cmFromFtIn(5, 10)).toBe(177.8);
    expect(cmFromFtIn(6, 0)).toBe(182.9);
  });

  it("round-trips height", () => {
    expect(ftInFromCm(177.8)).toEqual({ feet: 5, inches: 10 });
    expect(ftInFromCm(182.9)).toEqual({ feet: 6, inches: 0 });
  });

  it("converts pounds and kilograms", () => {
    expect(kgFromLb(176)).toBe(79.83);
    expect(lbFromKg(79.83)).toBe(176);
  });

  it("formats for display", () => {
    expect(formatHeight(177.8, "metric")).toBe("178 cm");
    expect(formatHeight(177.8, "imperial")).toBe("5′10″");
    expect(formatWeight(80, "imperial")).toBe("176.4 lb");
  });
});
