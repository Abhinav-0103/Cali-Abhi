import { describe, expect, it } from "vitest";
import { ONBOARDING_STEPS, onboardingSchema, validateFields } from "@/lib/schemas/onboarding";
import { EMPTY_DRAFT, toOnboardingInput, type OnboardingDraft } from "./draft";

const env = { timezone: "Europe/London", today: "2026-10-28" };

const complete: OnboardingDraft = {
  ...EMPTY_DRAFT,
  age: "29",
  sex: "male",
  heightCm: "178",
  weight: "75",
  goal: "first_pull_up",
  experience: "beginner",
  pushUps: "12",
  pullUps: "0",
  squats: "30",
  plankSeconds: "45",
  deadHangSeconds: "20",
  equipment: ["pull_up_bar"],
  parq: { q1: false, q2: false, q3: false, q4: false, q5: false, q6: false, q7: false },
};

const stepFields = (id: string) => ONBOARDING_STEPS.find((s) => s.id === id)!.fields;

describe("onboarding draft → schema", () => {
  it("accepts a complete draft", () => {
    expect(onboardingSchema.safeParse(toOnboardingInput(complete, env)).success).toBe(true);
  });

  it("converts imperial height and weight to metric", () => {
    const input = toOnboardingInput(
      { ...complete, unitSystem: "imperial", heightFt: "5", heightIn: "10", weight: "176" },
      env,
    );
    expect(input.heightCm).toBe(177.8);
    expect(input.weightKg).toBe(79.83);
  });

  it("asks for missing values instead of reporting NaN", () => {
    const errors = validateFields(toOnboardingInput(EMPTY_DRAFT, env), stepFields("body"));
    expect(errors.age).toBe("Enter your age");
    expect(errors.sex).toBe("Choose an option");
    expect(errors.heightCm).toBe("Enter your height");
  });

  it("rejects non-numeric input and under-16s", () => {
    expect(validateFields(toOnboardingInput({ ...complete, age: "abc" }, env), ["age"]).age).toMatch(/must be a number/);
    expect(validateFields(toOnboardingInput({ ...complete, age: "15" }, env), ["age"]).age).toBe("Must be at least 16");
  });

  it("only reports errors for the step being validated", () => {
    const errors = validateFields(toOnboardingInput({ ...EMPTY_DRAFT, goal: "lose_fat" }, env), stepFields("goal"));
    expect(errors).toEqual({});
  });

  it("requires a skill when the goal is skills", () => {
    const errors = validateFields(toOnboardingInput({ ...complete, goal: "skills" }, env), stepFields("goal"));
    expect(errors.skillGoals).toBe("Pick at least one skill");
  });

  it("drops skill choices for other goals", () => {
    expect(toOnboardingInput({ ...complete, skillGoals: ["handstand"] }, env).skillGoals).toEqual([]);
  });

  it("requires preferred days to match days per week (or be empty)", () => {
    const fields = stepFields("schedule");
    expect(validateFields(toOnboardingInput({ ...complete, preferredDays: [0, 2] }, env), fields).preferredDays).toBe(
      "Pick exactly 3 days, or none to stay flexible",
    );
    expect(validateFields(toOnboardingInput({ ...complete, preferredDays: [0, 2, 4] }, env), fields)).toEqual({});
    expect(validateFields(toOnboardingInput({ ...complete, preferredDays: [] }, env), fields)).toEqual({});
  });

  it("requires every health question to be answered", () => {
    const errors = validateFields(toOnboardingInput({ ...complete, parq: { q1: false } }, env), stepFields("health"));
    expect(errors.parq).toBeDefined();
  });

  it("requires acknowledgement when any health answer is yes", () => {
    const flagged = { ...complete, parq: { ...complete.parq, q6: true } };
    const fields = stepFields("health");
    expect(validateFields(toOnboardingInput(flagged, env), fields).parqAcknowledged).toBeDefined();
    expect(validateFields(toOnboardingInput({ ...flagged, parqAcknowledged: true }, env), fields)).toEqual({});
  });

  it("rejects an invalid time zone", () => {
    const result = onboardingSchema.safeParse(toOnboardingInput(complete, { ...env, timezone: "Mars/Base" }));
    expect(result.success).toBe(false);
  });
});
