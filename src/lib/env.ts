import "server-only";
import { z } from "zod";

// Server-side environment, validated once on first use.
const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_PLAN_MODEL: z.string().min(1).default("claude-sonnet-5-5"),
  ANTHROPIC_CHECKIN_MODEL: z.string().min(1).default("claude-haiku-5-5"),
  AI_PLAN_DAILY_LIMIT: z.coerce.number().int().positive().default(3),
  AI_CHECKIN_WEEKLY_LIMIT: z.coerce.number().int().positive().default(1),
  // Test-only fake AI. Ignored in production builds.
  AI_MOCK: z.enum(["0", "1"]).default("0"),
});

let cached: z.infer<typeof serverSchema> | undefined;

export function serverEnv() {
  cached ??= serverSchema.parse(process.env);
  return cached;
}

export function aiMockEnabled() {
  return process.env.NODE_ENV !== "production" && serverEnv().AI_MOCK === "1";
}
