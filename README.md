# CaliCoach

An AI-powered calisthenics coach. Users answer a 2-minute questionnaire, get a personalised 4-week bodyweight plan, log their workouts (even offline), and the plan adapts automatically as they progress. Installable as an app on phones (PWA).

> **Status:** MVP complete except the weekly check-in (phase 7), which is planned next. Design and decisions: [`docs/PLAN.md`](docs/PLAN.md).
>
> **Not medical advice.** CaliCoach gives general fitness guidance only.

## Features

- **Sign in** with an email magic link or Google.
- **Onboarding** in 8 short steps: body stats (metric/imperial), goal, experience, baseline test, equipment, schedule, injuries and a PAR-Q health screen. A "yes" on any health question shows a doctor recommendation and switches to a conservative plan.
- **AI plan**: Claude writes a 4-week plan using only exercises from a curated 88-exercise library that suit the user's equipment, injuries and level. The output is validated; if it fails, Claude retries once with the errors, and if it fails again a deterministic template plan is used.
- **Workout logger**: per-set logging, a stopwatch for timed holds, RPE per exercise, a rest timer (beep and vibration, keeps the screen on), and a summary at the end.
- **Offline**: the app opens and logs workouts with no connection, then syncs when back online. Logs sync live across devices.
- **Automatic progression**: after each workout, rule-based logic raises targets, moves you to the next exercise in the chain, or eases off. Each change is saved as a new plan version; history is never rewritten.
- **Progress**: week streak, weekly adherence, baseline-test trends with retests, body-weight log, personal bests and paginated workout history.
- **Production basics**: Row Level Security on every table, AI rate limits (3 plans per day), token-usage logging, security headers and CSP, account deletion, WCAG 2.1 AA checks, dark mode.

## Tech stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS 4 · shadcn/ui · Supabase (Postgres, Auth, Realtime, RLS) · Anthropic Claude (`@anthropic-ai/sdk`, server-side only) · Zod · Recharts · Vitest · Playwright · deployed on Vercel.

## How it fits together

```
Phone / browser (PWA)                       Vercel (Next.js server)                 Supabase
─────────────────────                       ───────────────────────                 ────────
Pages (server-rendered) ──────────────────▶ reads with the user's session ────────▶ Postgres + RLS
Workout logger → IndexedDB → sync ─────────────────────────────────────────────────▶ upserts (RLS)
Realtime subscription ◀──────────────────────────────────────────────────────────── workout tables
Service worker (offline shell)
                                            POST /api/plans → Claude (Sonnet) ───▶ save_plan_version
                                            POST /api/sessions/:id/complete
                                              → progression engine ──────────────▶ new plan version
```

- The Claude API key exists only on the server. Prompts contain training data only: never names, emails or IDs.
- Users write their own workout logs directly, protected by RLS. Plans, AI usage and quotas are written only by the server, using the service-role key.

## Project layout

```
src/app/                 routes (App Router); (app)/ = signed-in pages, api/ = route handlers
src/components/          UI (ui/ = shadcn primitives; onboarding/, workout/, plan/, progress/, pwa/, settings/)
src/lib/ai/              Claude client + prompts
src/lib/plan/            plan schema, validation, template fallback, generation
src/lib/progression/     progression engine (pure) + server runner
src/lib/workout/         workout state logic (pure)
src/lib/offline/         IndexedDB + sync
src/lib/exercises/       exercise library (source of truth) + eligibility filter
supabase/migrations/     database schema, RLS policies, seed data
public/sw.js             service worker
e2e/                     Playwright tests
scripts/                 RLS smoke test, exercise seed and icon generators
```

---

## Local development

**Requirements:** Node 22+, pnpm 10, Docker (for local Supabase).

1. Install the dependencies:
   ```bash
   pnpm install
   ```
2. Start a local Supabase. The first run downloads the Docker images, which takes a few minutes:
   ```bash
   pnpm db:start
   ```
3. Create your local environment file:
   ```bash
   cp .env.example .env.local
   ```
   Fill in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` with the values printed by `pnpm db:start`. You can print them again with `pnpm exec supabase status`. Set `AI_MOCK=1` to work without an Anthropic key: plans then come from the template.
4. Start the app:
   ```bash
   pnpm dev
   ```

Open http://localhost:3000. Magic-link emails land in the local inbox at http://127.0.0.1:54324 (Mailpit).

### Checks and tests

Run the type checker, linter and unit tests:
```bash
pnpm check
```

Run the RLS smoke test (proves users can't read or write each other's data):
```bash
pnpm db:test-rls
```

Run the end-to-end tests. These need local Supabase running. They start the dev server, plus a production build on port 3100 for the offline/PWA test.
```bash
pnpm test:e2e
```

Playwright tests in `e2e/`:

| Spec | What it covers |
|---|---|
| `auth` | Login redirects, magic-link sign-in, account deletion |
| `onboarding` | All 8 steps, validation, going back, the health warning, resuming after a reload |
| `plan` | Plan generation, week view, regeneration, the 3-per-day limit |
| `workout` | Logging, offline sync, live updates on a second device, finishing |
| `progression` | Strong sessions level the plan up |
| `progress` | Streak, adherence, baselines, weight, personal bests, pagination |
| `a11y` | axe WCAG 2.1 AA on every main screen, light and dark |
| `pwa` | Production build: manifest, CSP, a full workout while offline, cache cleared on sign-out |

### Changing the database

- Add a **new** file in `supabase/migrations/`. Never edit a migration that has already been applied.
- Every table needs RLS enabled, a `user_id` column and indexes on its foreign keys and date columns.
- After changing the schema, regenerate the types and re-run the RLS test:
  ```bash
  pnpm db:types
  ```
  ```bash
  pnpm db:test-rls
  ```

---

## Deploying to production

You need accounts on **Supabase**, **Vercel** and **Anthropic**, plus **Google Cloud** if you want Google sign-in. The free tiers are fine to start with.

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com) in the region closest to your users.
2. Apply the migrations. Either way works:
   - **CLI (recommended):** log in, link the project (using the ref from the project URL), then push:
     ```bash
     pnpm exec supabase login
     ```
     ```bash
     pnpm exec supabase link --project-ref <your-project-ref>
     ```
     ```bash
     pnpm exec supabase db push
     ```
   - **SQL Editor:** run every file in `supabase/migrations/`, one at a time, **in filename order**.

   If you applied some migrations by hand earlier and switch to the CLI later, first mark those as applied:
   ```bash
   pnpm exec supabase migration repair --status applied <version>
   ```
3. Copy the **Project URL**, **publishable key** and **secret key** from **Project Settings → API Keys**. The secret key is server-only; never expose it in the browser or commit it.
4. Open **Authentication → URL Configuration**:
   - **Site URL:** `https://<your-domain>`
   - **Redirect URLs:** add `https://<your-domain>/auth/callback`. Optionally also add `https://*-<your-vercel-team>.vercel.app/auth/callback` for preview deployments.
5. **Email (important for real users):** Supabase's built-in email sender only sends a few emails per hour and is meant for testing. Under **Authentication → Emails → SMTP Settings**, connect a provider such as Resend, Postmark or Amazon SES. Then raise the email rate limit under **Authentication → Rate Limits**.
6. **Google sign-in (optional):**
   1. In [Google Cloud Console](https://console.cloud.google.com), go to **APIs & Services**. Set up the **OAuth consent screen** first: app name, support email and your domain.
   2. Go to **Credentials → Create credentials → OAuth client ID**, choose **Web application**, and add this **Authorized redirect URI**: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
   3. In Supabase, go to **Authentication → Sign In / Providers → Google**, enable it, and paste the client ID and secret.

### 2. Anthropic

1. Create an API key at [console.anthropic.com](https://console.anthropic.com) and **add credit**. Without credit, every plan falls back to the template, and `ai_usage.error` shows why.
2. Optional: set a monthly spend limit in the Console.

### 3. Vercel

1. **Add New → Project**, then import the GitHub repository. The framework (Next.js) and pnpm are detected automatically.
2. Under **Settings → Environment Variables**, add these for Production and Preview:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
   | `SUPABASE_SECRET_KEY` | Supabase secret key (server only) |
   | `ANTHROPIC_API_KEY` | Anthropic API key (server only) |
   | `ANTHROPIC_PLAN_MODEL` | `claude-sonnet-5-5` |
   | `ANTHROPIC_CHECKIN_MODEL` | `claude-haiku-5-5` |
   | `AI_PLAN_DAILY_LIMIT` | `3` (optional) |

   Do **not** set `AI_MOCK` in production; it's ignored there anyway.
3. Deploy. After changing environment variables, use **Deployments → ⋯ → Redeploy**: `NEXT_PUBLIC_*` values are baked in at build time.
4. **Production branch:** Vercel builds the repository's default branch. To release from `main`, change it under **Settings → Git → Production Branch**.
5. **Custom domain (optional):** add it under **Settings → Domains**, then update the Supabase Site URL and Redirect URLs to match.

Plan generation runs for up to 5 minutes after the request returns (`maxDuration = 300` in `src/app/api/plans/route.ts`). Vercel's default limits allow this with Fluid compute. If generations are cut off, check **Settings → Functions**.

### 4. Go-live checklist

- [ ] Every migration has been applied. In the SQL Editor, run `select count(*) from exercises;`: it should return 88.
- [ ] Magic-link sign-in works on the production domain, and Google sign-in too if enabled.
- [ ] A custom SMTP provider is set up.
- [ ] Generate a plan, then check `select outcome, error, input_tokens, output_tokens from ai_usage order by created_at desc limit 5;`. `outcome` should be `ok`.
- [ ] On a phone, install the app (Settings → Install the app), start a workout, switch on airplane mode, log a set, then reconnect. It should show "Synced".
- [ ] You can see the disclaimer at `/disclaimer`.

### Monitoring and costs

- **AI cost and failures:** `ai_usage` has one row per Claude call, with model, tokens, latency, outcome and error. For example, to see tokens per day:
  ```sql
  select date_trunc('day', created_at) day, model, count(*), sum(input_tokens) input, sum(output_tokens) output
  from ai_usage group by 1, 2 order by 1 desc;
  ```
- **Rate limits:** `ai_quota` holds one counter per user, kind and day or week. Change the limits with `AI_PLAN_DAILY_LIMIT` and `AI_CHECKIN_WEEKLY_LIMIT`.
- **Errors:** check Vercel's **Logs** tab. Server errors are logged with context, such as "plan generation failed" or "progression failed".

## Troubleshooting

| Symptom | Fix |
|---|---|
| Magic link opens `localhost` | Set the Supabase **Site URL** and **Redirect URLs** to your domain |
| "Sign-in failed" after opening the link | Open the link in the same browser that requested it, and only once |
| Every plan says "Built from our standard template" | Look at `ai_usage.error`: usually no credit, an invalid key or a wrong model name |
| "We'll update your plan next time you open the app" after a workout | The `progression_events` migration hasn't been applied |
| The app doesn't work offline | Offline needs a production build (not `pnpm dev`), and the app must be opened once while online after signing in |
| Charts are empty | They need at least two data points: log two weights, or do a retest |

## Licence and disclaimer

CaliCoach provides general fitness information and is not a substitute for professional medical advice. Users train at their own risk.
