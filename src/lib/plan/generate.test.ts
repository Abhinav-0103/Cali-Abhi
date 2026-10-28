import { describe, expect, it, vi } from "vitest";
import { EXERCISES } from "@/lib/exercises/library";
import { filterExercises, startingPoints } from "@/lib/exercises/filter";
import { generatePlan, type ChatMessage, type ModelResult } from "./generate";
import { templatePlan, type TemplateInput } from "./template";
import type { PlanContext } from "./validate";

const eligible = filterExercises(EXERCISES, { equipment: ["pull_up_bar"], injuryAreas: [], experience: "beginner", conservative: false });
const input: TemplateInput = {
  goal: "first_pull_up",
  skillGoals: [],
  experience: "beginner",
  daysPerWeek: 3,
  minutesPerSession: 45,
  preferredDays: [],
  conservative: false,
  eligible,
  starts: startingPoints(eligible, { pushUps: 5, pullUps: 0, squats: 20, plankSeconds: 30, deadHangSeconds: 20 }),
};
const ctx: PlanContext = { eligibleById: new Map(eligible.map((e) => [e.id, e])), daysPerWeek: 3, preferredDays: [], minutesPerSession: 45 };

const validJson = () => JSON.stringify({ ...templatePlan(input), summary: "AI summary" });
const invalidJson = () => {
  const plan = templatePlan(input);
  plan.weeks[0].days[0].exercises[3].exercise_id = "invented_exercise";
  return JSON.stringify(plan);
};
const template = () => templatePlan(input);

describe("generatePlan", () => {
  it("returns the AI plan when the first answer is valid", async () => {
    const callModel = vi.fn(async () => ({ text: validJson() }));
    const result = await generatePlan("make a plan", ctx, { callModel, template });
    expect(result).toMatchObject({ source: "ai", summary: "AI summary", attempts: 1 });
    expect(callModel).toHaveBeenCalledTimes(1);
  });

  it("retries once with the validation errors, then accepts a fixed plan", async () => {
    const seen: ChatMessage[][] = [];
    const callModel = vi.fn(async (messages: ChatMessage[]) => {
      seen.push(structuredClone(messages));
      return { text: seen.length === 1 ? invalidJson() : validJson() };
    });
    const result = await generatePlan("make a plan", ctx, { callModel, template });
    expect(result).toMatchObject({ source: "ai", attempts: 2 });
    const retry = seen[1];
    expect(retry.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(retry[2].content).toMatch(/invented_exercise/);
  });

  it("falls back to the template after two invalid answers", async () => {
    const callModel = vi.fn(async () => ({ text: invalidJson() }));
    const result = await generatePlan("make a plan", ctx, { callModel, template });
    expect(result.source).toBe("template");
    expect(callModel).toHaveBeenCalledTimes(2);
    expect(result.weeks).toHaveLength(4);
  });

  it("handles non-JSON output, refusals and API errors", async () => {
    const callModel = vi
      .fn()
      .mockResolvedValueOnce({ text: "not json" })
      .mockRejectedValueOnce(new Error("529 overloaded"));
    const result = await generatePlan("make a plan", ctx, { callModel, template });
    expect(result.source).toBe("template");

    const refusal = vi.fn<(messages: ChatMessage[]) => Promise<ModelResult>>(async () => ({ text: null, problem: "The model declined" }));
    expect((await generatePlan("x", ctx, { callModel: refusal, template })).source).toBe("template");
    expect(refusal.mock.calls[1][0].at(-1)!.content).toMatch(/The model declined/);
  });
});
