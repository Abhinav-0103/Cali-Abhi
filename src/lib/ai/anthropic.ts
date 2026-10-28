import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ChatMessage, ModelResult } from "@/lib/plan/generate";

let client: Anthropic | undefined;

function anthropic() {
  // Our own code retries once with validation feedback, so keep SDK retries low.
  client ??= new Anthropic({ apiKey: serverEnv().ANTHROPIC_API_KEY, timeout: 240_000, maxRetries: 1 });
  return client;
}

export type AiKind = "plan" | "checkin";

type CallOptions = {
  kind: AiKind;
  userId: string;
  model: string;
  system: string;
  schema: z.ZodType;
  maxTokens: number;
  effort: "low" | "medium" | "high";
};

/**
 * One structured-output call to Claude. Streams (large outputs), logs token
 * usage to ai_usage, and returns the raw JSON text for our own validation.
 */
export async function callClaude(messages: ChatMessage[], opts: CallOptions, attempt: number): Promise<ModelResult> {
  const started = Date.now();
  const usageRow = { user_id: opts.userId, kind: opts.kind, model: opts.model, attempt };

  try {
    const message = await anthropic()
      .beta.messages.stream({
        model: opts.model,
        max_tokens: opts.maxTokens,
        // On a policy refusal the API retries on a fallback model in the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
        messages,
        output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
      })
      .finalMessage();

    const text = message.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("");
    const problem =
      message.stop_reason === "refusal"
        ? "The model declined to write this plan"
        : message.stop_reason === "max_tokens"
          ? "The plan was cut off because it was too long; use fewer exercises and shorter notes"
          : undefined;

    await logUsage({
      ...usageRow,
      model: message.model,
      outcome: problem ? "invalid_output" : "ok",
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
      cache_read_input_tokens: message.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: message.usage.cache_creation_input_tokens ?? 0,
      latency_ms: Date.now() - started,
    });
    return problem ? { text: null, problem } : { text };
  } catch (error) {
    // e.g. "400 credit balance is too low", "401 invalid x-api-key", missing key
    const reason =
      error instanceof Anthropic.APIError
        ? `${error.status ?? "network"} ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
    console.error("Claude API error", reason);
    await logUsage({ ...usageRow, outcome: "api_error", error: reason.slice(0, 500), latency_ms: Date.now() - started });
    throw error;
  }
}

type UsageRow = {
  user_id: string;
  kind: AiKind;
  model: string;
  attempt: number;
  outcome: "ok" | "invalid_output" | "api_error";
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  latency_ms: number;
  error?: string;
};

async function logUsage(row: UsageRow) {
  const { error } = await createAdminClient().from("ai_usage").insert(row);
  if (error) console.error("failed to log ai usage", error.message);
}
