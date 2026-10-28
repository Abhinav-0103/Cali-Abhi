import { buildRetryMessage } from "@/lib/ai/plan-prompt";
import type { StoredPlanWeek } from "./schema";
import { validatePlan, type PlanContext } from "./validate";
import type { PlanOutput } from "./schema";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ModelResult = {
  /** The JSON text returned, or null if the model produced none (refusal, cut off). */
  text: string | null;
  problem?: string;
};

export type GenerateDeps = {
  callModel: (messages: ChatMessage[]) => Promise<ModelResult>;
  /** Deterministic fallback. Must satisfy the same validation. */
  template: () => PlanOutput;
};

export type GeneratedPlan = {
  source: "ai" | "template";
  summary: string;
  weeks: StoredPlanWeek[];
  attempts: number;
};

const MAX_ATTEMPTS = 2;

/**
 * Asks the model for a plan; if the output is invalid, retries once with the
 * validation errors; then falls back to the deterministic template.
 */
export async function generatePlan(userMessage: string, ctx: PlanContext, deps: GenerateDeps): Promise<GeneratedPlan> {
  const messages: ChatMessage[] = [{ role: "user", content: userMessage }];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let result: ModelResult;
    try {
      result = await deps.callModel(messages);
    } catch (error) {
      console.error(`plan generation attempt ${attempt} failed`, error);
      continue; // API error: retry the same request
    }

    let errors: string[];
    if (result.text === null) {
      errors = [result.problem ?? "No plan was returned"];
    } else {
      let json: unknown;
      try {
        json = JSON.parse(result.text);
      } catch {
        json = undefined;
      }
      const validation = json === undefined ? { ok: false as const, errors: ["Output was not valid JSON"] } : validatePlan(json, ctx);
      if (validation.ok) return { source: "ai", summary: validation.summary, weeks: validation.weeks, attempts: attempt };
      errors = validation.errors;
      messages.push({ role: "assistant", content: result.text });
    }
    messages.push({ role: "user", content: buildRetryMessage(errors) });
  }

  const fallback = validatePlan(deps.template(), ctx);
  if (!fallback.ok) throw new Error(`Template plan failed validation: ${fallback.errors.join("; ")}`);
  return { source: "template", summary: fallback.summary, weeks: fallback.weeks, attempts: MAX_ATTEMPTS };
}
