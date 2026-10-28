import { describe, expect, it } from "vitest";
import { dateInTimeZone, localIsoDate, weekdayInTimeZone } from "./dates";

describe("dates", () => {
  const instant = new Date("2026-10-29T23:30:00Z"); // Thursday in UTC, Friday in Tokyo

  it("computes the calendar date and weekday in a time zone", () => {
    expect(dateInTimeZone("UTC", instant)).toBe("2026-10-29");
    expect(dateInTimeZone("Asia/Tokyo", instant)).toBe("2026-10-30");
    expect(weekdayInTimeZone("UTC", instant)).toBe(3);
    expect(weekdayInTimeZone("Asia/Tokyo", instant)).toBe(4);
  });

  it("formats a local date", () => {
    expect(localIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
