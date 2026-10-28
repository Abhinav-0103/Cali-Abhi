import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("allows relative paths", () => expect(safeNextPath("/plan")).toBe("/plan"));
  it.each([null, "", "https://evil.com", "//evil.com", "/\\evil.com", "plan"])("rejects %s", (v) =>
    expect(safeNextPath(v)).toBe("/today"),
  );
});
