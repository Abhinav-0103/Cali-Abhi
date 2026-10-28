# CaliCoach

An AI-powered calisthenics coach. Users answer a short questionnaire, get a personalised 4-week bodyweight plan, log their workouts (even offline), and the plan adapts as they progress.

> **Status:** MVP in progress (phases 1–6 of 8 complete: setup, auth, schema, exercise library, onboarding, AI plan generation, workout logger, progression engine, progress screen). The full deploy guide arrives in phase 8. Design: [`docs/PLAN.md`](docs/PLAN.md).

## Local setup

Requirements: Node 22+, pnpm 10, Docker.

```bash
pnpm install
```

```bash
pnpm db:start
```

```bash
cp .env.example .env.local
```

Fill `.env.local` with the publishable and secret keys printed by `pnpm db:start` (run `pnpm exec supabase status` to see them again). Set `AI_MOCK=1` to work without an Anthropic key.

```bash
pnpm dev
```

Open http://localhost:3000. Magic-link emails land in Mailpit at http://127.0.0.1:54324.

## Checks

```bash
pnpm check
```

```bash
pnpm db:test-rls
```

```bash
pnpm test:e2e
```

## Medical disclaimer

CaliCoach provides general fitness guidance and is not medical advice.
