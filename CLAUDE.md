# CaliCoach — notes for Claude sessions

AI calisthenics coach (PWA). Design and phase plan: `docs/PLAN.md` (the source of truth for schema, AI contracts and progression rules).

@AGENTS.md

## Stack
- Next.js 16 App Router, TypeScript strict, Tailwind CSS 4, shadcn/ui (new-york style, components in `src/components/ui`, written by hand when the registry is unreachable). `cacheComponents` is OFF on purpose.
- `src/proxy.ts` is Next 16's renamed middleware: it refreshes the Supabase session and redirects signed-out users.
- Supabase: Postgres + Auth (magic link, Google) + Realtime. RLS on every table.
- Claude via `@anthropic-ai/sdk`, server-side route handlers ONLY. Model names come from env (`ANTHROPIC_PLAN_MODEL`, `ANTHROPIC_CHECKIN_MODEL`).
- Zod 4 for every boundary: forms, API input, env (`src/lib/env.ts`), AI output.
- Recharts for charts. Vitest for unit tests, Playwright for E2E.

## Commands
```bash
pnpm dev                # app on http://localhost:3000
pnpm check              # typecheck + lint + unit tests (run after every change)
pnpm db:start           # local Supabase in Docker (needs dockerd running)
pnpm db:reset           # re-apply all migrations
pnpm db:types           # regenerate src/lib/supabase/database.types.ts after schema changes
pnpm db:test-rls        # RLS smoke test against local DB
pnpm db:gen-library     # regenerate exercise seed SQL from src/lib/exercises/library.ts
pnpm test:e2e           # Playwright (set PLAYWRIGHT_CHROMIUM_PATH to a local Chromium if needed)
```
Mailpit (local magic-link emails): http://127.0.0.1:54324

## Conventions
- **Data access**: pages read with `createClient()` from `@/lib/supabase/server` (user session, RLS). Use `requireUser` / `requireOnboardedProfile` from `@/lib/auth/session`.
- **Service role** (`@/lib/supabase/admin`) only on the server, after verifying the user, always scoping by that user id. Plans, check-ins, `ai_usage` and `ai_quota` are written only this way (via `save_plan_version` / `consume_ai_quota` RPCs).
- **Schema changes**: add a NEW migration in `supabase/migrations` (never edit applied ones), keep `src/lib/constants.ts` in sync with CHECK constraints, every new table gets RLS + a `user_id` column + indexes on FKs and dates, then `pnpm db:types` and `pnpm db:test-rls`.
- **AI privacy**: prompts are built only from whitelisted training data — never names, emails or user ids.
- Stored units are metric (cm, kg); convert only for display.
- Progression logic stays pure and unit-tested in `src/lib/progression`.
- AI flow (plans): `lib/exercises/filter.ts` (filter BEFORE prompting) → `lib/ai/plan-prompt.ts` → `lib/plan/generate.ts` (validate, retry once with errors, template fallback) → `save_plan_version`. `AI_MOCK=1` (dev/test only) swaps Claude for the template. Never send names/emails/ids to the model.
- Keep code simple: no repositories/services layers, no premature abstractions. Match the style of nearby code.
- Accessibility: every input has a label, errors use `aria-invalid` + `role="alert"`, visible focus rings, dark mode via `next-themes` (`.dark` class).
