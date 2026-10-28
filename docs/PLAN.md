# CaliCoach — MVP Design & Build Plan

Status: **approved 2026-10-28**. Phases 1–4 complete.

Versions checked on 2026-10-28: Next.js 16.4, Tailwind 4.3, Zod 4.6, @anthropic-ai/sdk 1.3, Serwist 9.5.

---

## 1. Architecture

```
┌──────────────────────────── Browser (installable PWA) ────────────────────────────┐
│ Next.js React UI (shadcn/ui, Tailwind, Recharts)                                   │
│  • Server Components render pages from Supabase (user's session cookie, RLS)       │
│  • Workout logger = client component; writes go to IndexedDB first, then an       │
│    outbox syncs to Supabase (idempotent upserts on client-generated UUIDs)         │
│  • Supabase Realtime subscription on own set_logs → other devices update live      │
│  • Service worker (Serwist): app shell + static assets cached, offline fallback    │
└───────────────┬───────────────────────────────────────────────┬───────────────────┘
                │ supabase-js (anon key + user JWT, RLS)         │ fetch / server actions
                ▼                                                ▼
┌──────────── Supabase ────────────┐        ┌──────────── Vercel (Next.js server) ───────────┐
│ Auth: magic link + Google OAuth  │◄──────►│ proxy.ts: refreshes Supabase session cookie     │
│ Postgres + RLS on every table    │        │ Server actions: profile, onboarding, weights    │
│ Realtime (workout tables)        │        │ Route handlers (only place the AI is called):   │
│ RPCs (service-role only):        │        │   POST /api/plans          → generate plan      │
│   save_plan_version              │        │   POST /api/checkins       → weekly check-in    │
│   consume_ai_quota               │        │   POST /api/sessions/:id/complete → progression │
└──────────────────────────────────┘        │ lib/ai → @anthropic-ai/sdk → Claude API         │
                                            └────────────────────────────────────────────────┘
```

Key decisions

| Concern | Decision |
|---|---|
| Data access | Reads: server components with the user-scoped Supabase client (RLS enforced). User-owned logs (sessions, sets, weight, baselines) are written directly by the client under RLS — required for offline sync and Realtime. Plans, check-ins, AI usage and quotas are written **only by the server** with the service-role key via `security definer` RPCs that are not executable by `anon`/`authenticated`. |
| RLS | Every table has RLS enabled. Every user-owned row carries a denormalised `user_id` so every policy is the fast form `user_id = (select auth.uid())`. Composite foreign keys `(parent_id, user_id)` make it impossible to attach a row to someone else's parent. |
| Plan generation latency | A 4-week plan is several thousand output tokens (tens of seconds). `POST /api/plans` inserts a `plans` row with `status='generating'`, returns `202` with the id, and does the work in Next's `after()` (`maxDuration = 300`). The loading screen polls `GET` status every 2s. Survives the phone screen locking. |
| Structured AI output | Claude structured output with a JSON schema generated from the Zod schema (`z.toJSONSchema`), then **re-validated with Zod** plus semantic checks (known exercise IDs, metric matches range type, day count, time budget). On failure: retry once with the errors appended; then a deterministic template plan. Exact SDK call verified against current docs in phase 3. |
| AI privacy | The prompt builder takes a whitelisted `TrainingProfile` type (age, sex, height, weight, goal, experience, baselines, equipment, schedule, injury areas/notes, PAR-Q flag). No ids, names or emails ever reach it. Injury notes truncated to 500 chars. |
| Models | `ANTHROPIC_PLAN_MODEL=claude-sonnet-5-5`, `ANTHROPIC_CHECKIN_MODEL=claude-haiku-5-5` in env, validated by `lib/env.ts`. Static system prompt (programming rules) marked for prompt caching. |
| Rate limits | `consume_ai_quota(user, kind, limit, window)` — atomic `insert … on conflict do update … where count < limit`. Plan: 3/day. Check-in: 1/week (also unique per plan week). |
| Cost logging | Every Claude call (incl. retries and failures) writes a row to `ai_usage` with model, input/output/cache tokens, latency, outcome. |
| Progression | Pure TS functions in `lib/progression`, run by `POST /api/sessions/:id/complete` after a session is synced. Changes create a new plan version; history is never mutated. |
| Weekly check-in | Haiku returns a summary + a list of **constrained adjustment ops** (scale volume, adjust target, swap to chain neighbour, deload). Ops are validated and applied by deterministic code with clamps → new plan version. Falls back to rule-based adjustments if the AI fails. |
| Scheduling | Flexible "next workout" model: Today shows the next not-yet-completed day of the current plan (in week/day order), labelled with its intended weekday. Missed days don't break the plan. Adherence = completed / scheduled sessions per week. |
| Offline | IndexedDB (`idb`) stores the in-progress session, the current/next plan day and the exercise library. Each mutation is appended to an outbox and flushed on `online`, on visibility change and every 30s while online. Conflicts: last write wins by `updated_at`. |
| Units | Stored metric (cm, kg). Converted for display only, per `profiles.unit_system`. |
| Safety | PAR-Q "yes" → doctor recommendation screen, acknowledgement stored, `conservative` mode: level cap 5, lower volume, no skill work above level 5, extra rest. Persistent "not medical advice" disclaimer in onboarding, plan overview and footer. |

---

## 2. Database schema

Single initial migration: `supabase/migrations/20261028000000_init.sql`. Exercise library goes in a separate generated seed migration (`…000001_exercise_library.sql`) so it ships to production with `supabase db push` (not just local `seed.sql`).

```sql
-- =========================================================================
-- CaliCoach initial schema
-- Conventions: text + CHECK instead of enums (easier to evolve),
-- every user-owned table has user_id + RLS "user_id = (select auth.uid())".
-- =========================================================================

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- profiles (1:1 with auth.users; no name/email stored) ----------
create table public.profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  unit_system             text not null default 'metric' check (unit_system in ('metric','imperial')),
  birth_year              smallint check (birth_year between 1900 and 2100),
  sex                     text check (sex in ('male','female','other','prefer_not_to_say')),
  height_cm               numeric(4,1) check (height_cm between 100 and 250),
  goal                    text check (goal in ('build_muscle','lose_fat','first_pull_up','skills','general_fitness')),
  skill_goals             text[] not null default '{}'
                          check (skill_goals <@ array['handstand','muscle_up','l_sit','front_lever']),
  experience              text check (experience in ('beginner','intermediate','advanced')),
  equipment               text[] not null default '{}'
                          check (equipment <@ array['pull_up_bar','dip_bars','rings','bands']),
  days_per_week           smallint check (days_per_week between 2 and 6),
  minutes_per_session     smallint check (minutes_per_session between 20 and 90),
  preferred_days          smallint[] not null default '{}'          -- 0 = Monday … 6 = Sunday
                          check (preferred_days <@ array[0,1,2,3,4,5,6]::smallint[]),
  injury_areas            text[] not null default '{}'
                          check (injury_areas <@ array['neck','shoulder','elbow','wrist','lower_back','hip','knee','ankle']),
  injury_notes            text check (char_length(injury_notes) <= 500),
  parq_answers            jsonb,                                     -- {"q1": false, …}
  parq_flagged            boolean generated always as
                          (coalesce(jsonb_path_exists(parq_answers, '$.* ? (@ == true)'), false)) stored,
  parq_acknowledged_at    timestamptz,
  timezone                text not null default 'UTC',
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- create a profile row for every new auth user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- body weight & baseline tests ----------
create table public.body_weight_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  logged_on  date not null,
  weight_kg  numeric(5,2) not null check (weight_kg between 25 and 350),
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)                       -- also serves as (user_id, date) index
);

create table public.baseline_tests (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  tested_on         date not null,
  push_ups          smallint not null check (push_ups between 0 and 500),
  pull_ups          smallint not null check (pull_ups between 0 and 100),
  squats            smallint not null check (squats between 0 and 1000),
  plank_seconds     smallint not null check (plank_seconds between 0 and 3600),
  dead_hang_seconds smallint not null check (dead_hang_seconds between 0 and 3600),
  source            text not null default 'onboarding' check (source in ('onboarding','retest')),
  created_at        timestamptz not null default now()
);
create index baseline_tests_user_date_idx on public.baseline_tests (user_id, tested_on desc);

-- ---------- exercise library (global, read-only for users) ----------
create table public.exercises (
  id                text primary key check (id ~ '^[a-z0-9_]+$'),
  name              text not null,
  category          text not null check (category in ('push','pull','dips','legs','core','skill','mobility')),
  chain             text not null,                -- e.g. 'push_up', 'pull_up', 'handstand'
  chain_order       smallint not null,            -- position in progression chain
  level             smallint not null check (level between 1 and 10),
  equipment         text[] not null default '{}'  -- ALL required; empty = no equipment
                    check (equipment <@ array['pull_up_bar','dip_bars','rings','bands']),
  metric            text not null check (metric in ('reps','seconds')),
  unilateral        boolean not null default false, -- value is per side
  cues              text[] not null default '{}',
  contraindications text[] not null default '{}'
                    check (contraindications <@ array['neck','shoulder','elbow','wrist','lower_back','hip','knee','ankle']),
  media_url         text,
  unique (chain, chain_order)
);
create index exercises_chain_idx on public.exercises (chain, chain_order);

-- ---------- plans (versioned: plan → version → week → day → exercise) ----------
create table public.plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  status     text not null default 'generating'
             check (status in ('generating','active','archived','failed')),
  source     text check (source in ('ai','template')),
  start_date date,
  error      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index plans_user_created_idx on public.plans (user_id, created_at desc);
create unique index plans_one_active_idx     on public.plans (user_id) where status = 'active';
create unique index plans_one_generating_idx on public.plans (user_id) where status = 'generating';
create trigger plans_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

create table public.plan_versions (
  id                uuid primary key default gen_random_uuid(),
  plan_id           uuid not null,
  user_id           uuid not null,
  version           int not null check (version >= 1),
  reason            text not null check (reason in ('initial','progression','checkin')),
  summary           text,                         -- "why this plan" or change notes
  parent_version_id uuid references public.plan_versions(id),
  is_current        boolean not null default true,
  created_at        timestamptz not null default now(),
  foreign key (plan_id, user_id) references public.plans(id, user_id) on delete cascade,
  unique (plan_id, version),
  unique (id, user_id)
);
create index plan_versions_user_idx   on public.plan_versions (user_id, created_at desc);
create index plan_versions_parent_idx on public.plan_versions (parent_version_id);
create unique index plan_versions_one_current_idx on public.plan_versions (plan_id) where is_current;

create table public.plan_weeks (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null,
  user_id     uuid not null,
  week_number smallint not null check (week_number between 1 and 4),
  focus       text,
  foreign key (version_id, user_id) references public.plan_versions(id, user_id) on delete cascade,
  unique (version_id, week_number),
  unique (id, user_id)
);
create index plan_weeks_user_idx on public.plan_weeks (user_id);

create table public.plan_days (
  id         uuid primary key default gen_random_uuid(),
  week_id    uuid not null,
  user_id    uuid not null,
  day_number smallint not null check (day_number between 1 and 6),
  weekday    smallint not null check (weekday between 0 and 6),  -- intended day, 0 = Monday
  title      text not null,
  focus      text,
  foreign key (week_id, user_id) references public.plan_weeks(id, user_id) on delete cascade,
  unique (week_id, day_number),
  unique (id, user_id)
);
create index plan_days_user_idx on public.plan_days (user_id);

create table public.plan_exercises (
  id           uuid primary key default gen_random_uuid(),
  day_id       uuid not null,
  user_id      uuid not null,
  position     smallint not null,
  block        text not null check (block in ('warmup','main','cooldown')),
  exercise_id  text not null references public.exercises(id),
  sets         smallint not null check (sets between 1 and 10),
  target_min   smallint not null check (target_min between 1 and 600),  -- reps or seconds per exercise.metric
  target_max   smallint not null check (target_max between 1 and 600),
  rest_seconds smallint not null check (rest_seconds between 0 and 600),
  notes        text check (char_length(notes) <= 300),
  check (target_min <= target_max),
  foreign key (day_id, user_id) references public.plan_days(id, user_id) on delete cascade,
  unique (day_id, position)
);
create index plan_exercises_user_idx     on public.plan_exercises (user_id);
create index plan_exercises_exercise_idx on public.plan_exercises (exercise_id);

-- ---------- workout logging (client-generated UUIDs → idempotent offline sync) ----------
create table public.workout_sessions (
  id           uuid primary key,                  -- generated on the device
  user_id      uuid not null references auth.users(id) on delete cascade,
  plan_id      uuid,
  plan_day_id  uuid,
  week_number  smallint check (week_number between 1 and 4),
  day_number   smallint check (day_number between 1 and 6),
  status       text not null default 'in_progress'
               check (status in ('in_progress','completed','abandoned')),
  performed_on date not null,                     -- user's local date
  started_at   timestamptz not null,
  completed_at timestamptz,
  notes        text check (char_length(notes) <= 1000),
  progression_applied_at timestamptz,             -- set by server; makes /complete idempotent
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (plan_id, user_id)     references public.plans(id, user_id) on delete set null (plan_id),
  foreign key (plan_day_id, user_id) references public.plan_days(id, user_id) on delete set null (plan_day_id),
  unique (id, user_id)
);
create index workout_sessions_user_date_idx on public.workout_sessions (user_id, performed_on desc);
create index workout_sessions_plan_idx      on public.workout_sessions (plan_id, week_number, day_number);
create index workout_sessions_plan_day_idx  on public.workout_sessions (plan_day_id);
create unique index workout_sessions_one_completion_idx
  on public.workout_sessions (plan_id, week_number, day_number) where status = 'completed';
create trigger workout_sessions_updated_at before update on public.workout_sessions
  for each row execute function public.set_updated_at();

create table public.session_exercises (
  id               uuid primary key,              -- generated on the device
  session_id       uuid not null,
  user_id          uuid not null,
  exercise_id      text not null references public.exercises(id),
  plan_exercise_id uuid references public.plan_exercises(id) on delete set null,
  position         smallint not null,
  -- snapshot of the prescription so the progression engine never depends on mutable data
  planned_sets     smallint not null check (planned_sets between 1 and 10),
  target_min       smallint not null,
  target_max       smallint not null,
  rpe              smallint check (rpe between 1 and 10),
  skipped          boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (session_id, user_id) references public.workout_sessions(id, user_id) on delete cascade,
  unique (session_id, position),
  unique (id, user_id)
);
create index session_exercises_user_ex_idx  on public.session_exercises (user_id, exercise_id);
create index session_exercises_exercise_idx on public.session_exercises (exercise_id);
create index session_exercises_plan_ex_idx  on public.session_exercises (plan_exercise_id);
create trigger session_exercises_updated_at before update on public.session_exercises
  for each row execute function public.set_updated_at();

create table public.set_logs (
  id                  uuid primary key,           -- generated on the device
  session_exercise_id uuid not null,
  user_id             uuid not null,
  set_number          smallint not null check (set_number between 1 and 20),
  value               smallint not null check (value between 0 and 3600),  -- reps or seconds
  logged_at           timestamptz not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  foreign key (session_exercise_id, user_id)
    references public.session_exercises(id, user_id) on delete cascade,
  unique (session_exercise_id, set_number)
);
create index set_logs_user_logged_idx on public.set_logs (user_id, logged_at desc);
create trigger set_logs_updated_at before update on public.set_logs
  for each row execute function public.set_updated_at();

-- personal bests, computed (RLS of underlying tables applies)
create view public.personal_bests with (security_invoker = true) as
select distinct on (sl.user_id, se.exercise_id)
  sl.user_id, se.exercise_id, sl.value as best_value, ws.performed_on as achieved_on
from public.set_logs sl
join public.session_exercises se on se.id = sl.session_exercise_id
join public.workout_sessions ws  on ws.id = se.session_id
where ws.status = 'completed'
order by sl.user_id, se.exercise_id, sl.value desc, ws.performed_on asc;

-- ---------- weekly check-ins (server-written) ----------
create table public.weekly_checkins (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null,
  plan_id              uuid not null,
  week_number          smallint not null check (week_number between 1 and 4),
  energy               smallint not null check (energy between 1 and 5),
  soreness             smallint not null check (soreness between 1 and 5),
  difficulty           smallint not null check (difficulty between 1 and 5),
  source               text not null check (source in ('ai','rules')),
  summary              text,
  adjustments          jsonb not null default '[]',
  resulting_version_id uuid references public.plan_versions(id),
  created_at           timestamptz not null default now(),
  foreign key (plan_id, user_id) references public.plans(id, user_id) on delete cascade,
  unique (plan_id, week_number)
);
create index weekly_checkins_user_created_idx on public.weekly_checkins (user_id, created_at desc);
create index weekly_checkins_version_idx      on public.weekly_checkins (resulting_version_id);

-- ---------- AI cost monitoring & rate limiting (server-only) ----------
create table public.ai_usage (
  id                          bigint generated always as identity primary key,
  user_id                     uuid references auth.users(id) on delete set null,
  kind                        text not null check (kind in ('plan','checkin')),
  model                       text not null,
  attempt                     smallint not null default 1,
  outcome                     text not null check (outcome in ('ok','invalid_output','api_error')),
  input_tokens                int not null default 0,
  output_tokens               int not null default 0,
  cache_read_input_tokens     int not null default 0,
  cache_creation_input_tokens int not null default 0,
  latency_ms                  int,
  created_at                  timestamptz not null default now()
);
create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);
create index ai_usage_created_idx      on public.ai_usage (created_at desc);

create table public.ai_quota (
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('plan','checkin')),
  window_start date not null,
  count        int not null default 0,
  primary key (user_id, kind, window_start)
);
create index ai_quota_window_idx on public.ai_quota (window_start);

-- returns true if a unit of quota was consumed, false if the limit is reached
create or replace function public.consume_ai_quota(
  p_user_id uuid, p_kind text, p_limit int, p_window text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_start date;
  v_count int;
begin
  v_start := case p_window
    when 'day'  then (now() at time zone 'utc')::date
    when 'week' then date_trunc('week', now() at time zone 'utc')::date
  end;
  if v_start is null then raise exception 'invalid window %', p_window; end if;

  insert into public.ai_quota as q (user_id, kind, window_start, count)
  values (p_user_id, p_kind, v_start, 1)
  on conflict (user_id, kind, window_start)
    do update set count = q.count + 1 where q.count < p_limit
  returning count into v_count;

  return v_count is not null;
end $$;

-- atomically write a full plan version from validated JSON
-- p_weeks: [{week_number, focus, days:[{day_number, weekday, title, focus,
--            exercises:[{block, exercise_id, sets, target_min, target_max, rest_seconds, notes}]}]}]
create or replace function public.save_plan_version(
  p_user_id uuid, p_plan_id uuid, p_reason text, p_summary text,
  p_weeks jsonb, p_parent_version_id uuid default null, p_start_date date default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_version_id uuid;
  v_week_id    uuid;
  v_day_id     uuid;
  v_next       int;
  w jsonb;
  d jsonb;
begin
  perform 1 from public.plans where id = p_plan_id and user_id = p_user_id for update;
  if not found then raise exception 'plan % not found for user', p_plan_id; end if;

  select coalesce(max(version), 0) + 1 into v_next
  from public.plan_versions where plan_id = p_plan_id;

  update public.plan_versions set is_current = false
  where plan_id = p_plan_id and is_current;

  insert into public.plan_versions (plan_id, user_id, version, reason, summary, parent_version_id)
  values (p_plan_id, p_user_id, v_next, p_reason, p_summary, p_parent_version_id)
  returning id into v_version_id;

  for w in select * from jsonb_array_elements(p_weeks) loop
    insert into public.plan_weeks (version_id, user_id, week_number, focus)
    values (v_version_id, p_user_id, (w->>'week_number')::smallint, w->>'focus')
    returning id into v_week_id;

    for d in select * from jsonb_array_elements(w->'days') loop
      insert into public.plan_days (week_id, user_id, day_number, weekday, title, focus)
      values (v_week_id, p_user_id, (d->>'day_number')::smallint, (d->>'weekday')::smallint,
              d->>'title', d->>'focus')
      returning id into v_day_id;

      insert into public.plan_exercises
        (day_id, user_id, position, block, exercise_id, sets, target_min, target_max, rest_seconds, notes)
      select v_day_id, p_user_id, x.ord::smallint, x.e->>'block', x.e->>'exercise_id',
             (x.e->>'sets')::smallint, (x.e->>'target_min')::smallint, (x.e->>'target_max')::smallint,
             (x.e->>'rest_seconds')::smallint, x.e->>'notes'
      from jsonb_array_elements(d->'exercises') with ordinality as x(e, ord);
    end loop;
  end loop;

  -- first version activates the plan and archives the previous one
  if v_next = 1 then
    update public.plans set status = 'archived'
    where user_id = p_user_id and status = 'active' and id <> p_plan_id;
    update public.plans set status = 'active', start_date = coalesce(p_start_date, current_date)
    where id = p_plan_id;
  end if;

  return v_version_id;
end $$;

-- server-only functions
revoke execute on function public.consume_ai_quota(uuid, text, int, text) from public, anon, authenticated;
revoke execute on function public.save_plan_version(uuid, uuid, text, text, jsonb, uuid, date) from public, anon, authenticated;
grant  execute on function public.consume_ai_quota(uuid, text, int, text) to service_role;
grant  execute on function public.save_plan_version(uuid, uuid, text, text, jsonb, uuid, date) to service_role;

-- =========================================================================
-- Row Level Security — enabled on EVERY table
-- =========================================================================
alter table public.profiles          enable row level security;
alter table public.body_weight_logs  enable row level security;
alter table public.baseline_tests    enable row level security;
alter table public.exercises         enable row level security;
alter table public.plans             enable row level security;
alter table public.plan_versions     enable row level security;
alter table public.plan_weeks        enable row level security;
alter table public.plan_days         enable row level security;
alter table public.plan_exercises    enable row level security;
alter table public.workout_sessions  enable row level security;
alter table public.session_exercises enable row level security;
alter table public.set_logs          enable row level security;
alter table public.weekly_checkins   enable row level security;
alter table public.ai_usage          enable row level security;
alter table public.ai_quota          enable row level security;

-- profiles: read + update own (row is created by trigger; deleted via auth cascade)
create policy "profiles: select own" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- exercise library: readable by any signed-in user, no writes
create policy "exercises: read" on public.exercises for select to authenticated using (true);

-- fully user-owned logging tables: CRUD own rows
do $$
declare t text;
begin
  foreach t in array array['body_weight_logs','baseline_tests','workout_sessions','session_exercises','set_logs'] loop
    execute format('create policy "%1$s: select own" on public.%1$I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s: insert own" on public.%1$I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s: update own" on public.%1$I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s: delete own" on public.%1$I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- server-written tables: users may only read their own rows
do $$
declare t text;
begin
  foreach t in array array['plans','plan_versions','plan_weeks','plan_days','plan_exercises','weekly_checkins'] loop
    execute format('create policy "%1$s: select own" on public.%1$I for select to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- the progression flag on sessions is server-owned (a column REVOKE would be
-- ineffective against Supabase's table-level grants, so enforce it in a trigger)
create or replace function public.protect_progression_flag()
returns trigger language plpgsql as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.progression_applied_at := case when tg_op = 'UPDATE' then old.progression_applied_at end;
  end if;
  return new;
end $$;
create trigger workout_sessions_protect_flag before insert or update on public.workout_sessions
  for each row execute function public.protect_progression_flag();

-- ai_usage / ai_quota: RLS on with NO policies → only service_role can touch them
revoke all on public.ai_usage, public.ai_quota from anon, authenticated;

-- =========================================================================
-- Realtime (cross-device sync of workout logs; RLS applies to subscriptions)
-- =========================================================================
alter publication supabase_realtime add table
  public.workout_sessions, public.session_exercises, public.set_logs;
```

Notes on the schema
- **Versioning**: a progression or check-in change reads the current version as JSON, edits only future days, and calls `save_plan_version` with `parent_version_id` — previous versions stay intact. Completed sessions point at the `plan_day_id` they were done from, plus a stable `(plan_id, week_number, day_number)` used to find "next workout" across versions.
- **Integrity across users**: composite FKs (`(parent_id, user_id)`) mean a client can't attach a set to another user's session even though it writes directly.
- **Indexes**: every FK column and date column is indexed (either directly or as the leading column of a unique/composite index). History queries use keyset pagination on `(user_id, performed_on desc)`.
- **Account deletion**: everything cascades from `auth.users`; `ai_usage` keeps anonymised rows (`user_id` set null) for cost reporting.

### Exercise library (seed, 88 exercises, source: `src/lib/exercises/library.ts`)

| Chain | Category | Progression (level) |
|---|---|---|
| `push_up` | push | wall push-up (1) → incline (2) → knee (2) → full (3) → diamond (4) → decline (5) → archer (6) → pseudo-planche push-up (7) |
| `pike_push` | push | pike push-up (4) → elevated pike (5) → wall HSPU negative (8) |
| `pull_up` | pull | dead hang (1) → scapular pulls (2) → negative pull-up (3) → band-assisted (3) → chin-up (4) → full pull-up (5) → archer pull-up (8) |
| `row` | pull | towel door row (1) → band row (1) → high ring row (2) → ring row (3) → feet-elevated ring row (5) → archer ring row (7) |
| `dip` | dips | bench dip (2) → support hold (2) → negative dip (3) → band-assisted dip (3) → parallel-bar dip (5) → ring support hold (5) → ring dip (7) |
| `squat` | legs | assisted squat (1) → bodyweight squat (2) → split squat (3) → reverse lunge (3) → Bulgarian split squat (4) → assisted shrimp (6) → shrimp squat (7) → assisted pistol (7) → pistol squat (8) |
| `hinge` | legs | glute bridge (1) → single-leg glute bridge (2) → elevated single-leg hip thrust (3) → Nordic curl negative (6) |
| `calf` | legs | calf raise (1) → single-leg calf raise (3) |
| `l_sit` | core | plank (1) → hollow body tuck (2) → hollow hold (3) → tuck L-sit (5) → one-leg L-sit (6) → L-sit (7) |
| `leg_raise` | core | dead bug (1) → lying leg raise (2) → hanging knee raise (4) → hanging leg raise (6) → toes-to-bar (7) |
| `side_plank`, `arch` | core | side plank (2); arch body hold (2) — single-exercise chains |
| `handstand` | skill | pike box hold (3) → wall walk (4) → chest-to-wall handstand (5) → back-to-wall handstand (5) → kick-up practice (6) → freestanding handstand (8) |
| `muscle_up` | skill | chest-to-bar pull-up (6) → straight-bar dip (6) → explosive pull-up (7) → band-assisted muscle-up (7) → muscle-up negative (8) → bar muscle-up (9) |
| `front_lever` | skill | tuck front lever (6) → advanced tuck (7) → one-leg (8) → straddle (9) → full front lever (10) |
| `warmup` | mobility | arm circles, wrist prep, cat-cow, hip circles, scapular push-ups, jumping jacks, deep squat hold |
| `cooldown` | mobility | child's pose, doorway chest stretch, hamstring stretch, hip-flexor stretch, thoracic rotation |

Each row: id (slug, e.g. `push_up_archer`), name, category, chain, chain_order, level, equipment (all required), metric, unilateral, 2–4 coaching cues, contraindicated body parts (e.g. wrist for push-ups/handstands/L-sits, shoulder for dips/handstands/muscle-ups, knee for shrimp/pistol), `media_url` placeholder.

**Server-side filtering before the AI call** (`lib/exercises/filter.ts`, unit-tested): drop exercises whose equipment isn't a subset of the user's equipment, whose contraindications intersect the user's injury areas, or whose level exceeds the cap (beginner 6, intermediate 8, advanced 10; conservative/PAR-Q mode 5). Also computed deterministically and passed to the model: a **suggested starting exercise per chain** from the baseline test (e.g. 0 pull-ups + 20 s hang → `pull_up_negative`). The same function seeds the template fallback.

---

## 3. AI contracts

**Plan output (Zod → JSON schema)**
```ts
PlanOutput = {
  summary: string (≤ 600 chars)            // shown as "Why this plan"
  weeks: Array<{                           // exactly 4
    week_number: 1..4, focus: string,
    days: Array<{                          // exactly profile.days_per_week
      day_number, weekday: 0..6, title, focus,
      exercises: Array<{
        block: 'warmup' | 'main' | 'cooldown',
        exercise_id: string,               // must be in the filtered list
        sets: 1..10,
        rep_range?: [min, max],            // required iff exercise.metric = 'reps'
        hold_range?: [min, max],           // required iff exercise.metric = 'seconds'
        rest_seconds: 0..600,
        notes?: string (≤ 200)
      }>
    }>
  }>
}
```
Semantic validation after Zod (`lib/plan/validate.ts`, unit-tested): unknown/filtered-out IDs, metric/range mismatch, day count, distinct weekdays (preferred days honoured when given), ≥ 1 warm-up and cool-down item per day, estimated session time ≤ 115% of `minutes_per_session`, no back-to-back days hitting the same chain at high volume. Errors are returned as a readable list for the retry message.

Programming rules in the system prompt: progressive overload across weeks 1–3, week 4 lighter (deload + retest cue) for intermediate/advanced, weekly hard sets per pattern (beginner 6–10, intermediate 10–16, advanced 14–20), ≥ 1 rest day between sessions training the same pattern where days allow, warm-up 5 min / cool-down 3–5 min, goal-specific emphasis, conservative mode rules.

**Check-in output**
```ts
CheckinOutput = {
  summary: string (≤ 500),
  adjustments: Array<
    | { op: 'scale_sets',    exercise_id | 'all', delta: -2..+1 }
    | { op: 'adjust_target', exercise_id, delta_pct: -20..+20 }
    | { op: 'swap_exercise', from_id, to_id }  // to_id must be a chain neighbour in the filtered library
    | { op: 'deload_week' }
  > (≤ 8)
}
```
Applied only to the following week by deterministic code, with clamps → new version. Fallback rules if AI fails: high soreness/difficulty → −1 set on main lifts; low difficulty + high energy → +10% targets.

---

## 4. Progression engine (pure, no AI)

```ts
type ExerciseResult = { date: string; plannedSets: number; targetMin: number; targetMax: number;
                        values: number[]; rpe: number | null; skipped: boolean }

decideProgression(history: ExerciseResult[] /* newest first, same exercise */,
                  chain: { current: Exercise; next?: Exercise; prev?: Exercise },
                  current: { sets: number; targetMin: number; targetMax: number })
  → { type: 'hold' }
  | { type: 'increase_target'; targetMin; targetMax }             // reps +1–2, holds +5 s
  | { type: 'advance'; exerciseId; targetMin; targetMax }         // next in chain, entry range
  | { type: 'regress'; exerciseId; targetMin; targetMax }         // previous in chain
  | { type: 'reduce_volume'; sets; targetMin; targetMax }
```
- **Success** = all planned sets logged, every value ≥ `targetMax`, RPE ≤ 8. Two consecutive successes → raise the range; once the range ceiling is reached (reps 12, holds 45 s, skill holds 30 s) → advance to the next chain exercise with an entry range (reps 5–8 / holds 10–20 s).
- **Failure** = any set below `targetMin`, or RPE 10. Two consecutive failures → regress one step in the chain (at the top of its range); if there is no easier step, reduce sets by 1 (min 1) and lower the range.
- Skipped exercises are ignored. Next/prev only considers exercises eligible for this user (same filter as above).
- `applyDecisions(planJson, decisions, fromDay)` — also pure — rewrites only future days. Each decision is recorded in the new version's `summary` ("Upgraded to diamond push-ups").

---

## 5. Folder structure

```
calicoach/
├── CLAUDE.md                     # stack, conventions, commands for future sessions
├── README.md                     # setup, Supabase, Google OAuth, Vercel deploy
├── .env.example
├── next.config.ts                # Serwist wrapper, security headers
├── components.json               # shadcn
├── vitest.config.ts
├── playwright.config.ts
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 20261028000000_init.sql
│   │   └── 20261028000001_exercise_library.sql  # generated by scripts/gen-exercise-seed.ts
│   └── seed.sql                  # local-only demo data (empty for now)
├── public/icons/                 # PWA icons (192, 512, maskable)
├── e2e/
│   └── onboarding-to-workout.spec.ts
└── src/
    ├── proxy.ts                  # Next 16 "middleware": Supabase session refresh + auth redirect
    ├── app/
    │   ├── layout.tsx            # theme provider, fonts, disclaimer footer
    │   ├── manifest.ts           # web app manifest
    │   ├── sw.ts                 # service worker source (Serwist)
    │   ├── page.tsx              # landing → sign-in / redirect to /today
    │   ├── ~offline/page.tsx
    │   ├── login/page.tsx        # magic link + Google
    │   ├── auth/callback/route.ts
    │   ├── (app)/                # signed-in shell with bottom nav
    │   │   ├── layout.tsx        # requires user; redirects to /onboarding if incomplete
    │   │   ├── onboarding/page.tsx
    │   │   ├── plan/page.tsx               # overview + "why this plan"
    │   │   ├── plan/generating/page.tsx    # polling loading state
    │   │   ├── today/page.tsx
    │   │   ├── workout/[sessionId]/page.tsx
    │   │   ├── workout/[sessionId]/summary/page.tsx
    │   │   ├── progress/page.tsx
    │   │   ├── checkin/page.tsx
    │   │   └── settings/page.tsx           # units, theme, retest, sign out, delete account
    │   └── api/
    │       ├── plans/route.ts              # POST generate (202), GET status
    │       ├── checkins/route.ts           # POST weekly check-in
    │       └── sessions/[id]/complete/route.ts  # progression engine
    ├── components/
    │   ├── ui/                   # shadcn primitives
    │   ├── onboarding/           # step components + stepper
    │   ├── workout/              # set logger, rest timer, RPE picker
    │   ├── progress/             # charts, streak, PB list
    │   └── plan/
    └── lib/
        ├── env.ts                # Zod-validated env (server/client split)
        ├── supabase/{client,server,admin}.ts
        ├── schemas/              # Zod: onboarding, profile, logs, checkin
        ├── units.ts
        ├── exercises/filter.ts (+ .test.ts)
        ├── plan/{schema,validate,template,save}.ts (+ tests)
        ├── ai/{client,plan-prompt,generate-plan,checkin,usage,quota}.ts
        ├── progression/{engine,apply}.ts (+ tests)
        └── offline/{db,outbox,sync}.ts
```

---

## 6. Build plan

Every phase ends with `pnpm typecheck && pnpm lint && pnpm test` green, plus a short manual-test checklist for you.

| # | Phase | Contents | Exit criteria |
|---|---|---|---|
| 1 ✅ | Setup, auth, schema, seed | `create-next-app` (TS strict, Tailwind 4, ESLint), shadcn init + dark mode, Supabase CLI + local stack (Docker), migrations above, 86-exercise seed, `env.ts`, Supabase clients, `proxy.ts`, login (magic link + Google), callback, signed-in shell, Vitest + Playwright config, CLAUDE.md | Sign in locally via magic link (Mailpit); RLS smoke test (SQL script proving user A can't read/write user B rows) |
| 2 ✅ | Onboarding | 8-step wizard (body, goal, experience, baseline, equipment, schedule, injuries, PAR-Q), progress bar, back navigation, draft kept in localStorage, metric/imperial, Zod per step, server action saves profile + baseline + first weight, PAR-Q warning + acknowledgement, disclaimer | Complete onboarding on a phone-sized viewport; invalid input blocked with accessible errors |
| 3 ✅ | AI plan generation | Filter + starting-point logic, prompt builder, Zod plan schema + semantic validator, Claude call with structured output, retry-with-errors, template fallback, `save_plan_version`, quota + `ai_usage` logging, generating screen, plan overview + "why this plan" | Generate a real plan; force invalid output in a test to see retry → template; 4th generation in a day is refused |
| 4 ✅ | Today + workout logger (offline) | Today/next-workout logic, start session, per-set logging, RPE per exercise, rest timer (vibration + sound, wake lock), finish + summary, IndexedDB + outbox sync, Realtime subscription | Log a workout in airplane mode, reconnect, see it synced; open on a second device and watch sets appear |
| 5 | Progression engine | Pure engine + apply functions, exhaustive unit tests, `/complete` route (idempotent) writing a new version | Tests cover every rule incl. chain ends; two "easy" sessions visibly upgrade the next workout |
| 6 | Progress screen | Streak, weekly adherence %, baseline charts (retest flow), body-weight log + chart, personal bests, paginated history | Charts render with seeded data in light/dark; keyboard + screen-reader labels |
| 7 | Weekly check-in | 3-question form, aggregation of the week's logs, Haiku call, op validation/application, rules fallback, quota, result screen showing changes | One check-in per week enforced; adjustments appear in next week as a new version |
| 8 | PWA polish, README, deploy | Serwist precache + offline page, install prompt, icons, security headers/CSP, delete account, Lighthouse/a11y pass, Playwright E2E (onboarding → plan → log workout, with `AI_MOCK=1`), README + Vercel/Supabase deploy guide | E2E green; Lighthouse PWA installable; deploy steps verified end to end except steps that need your accounts |

Testing approach: Vitest for engine, validator, filter, template, check-in op application and unit conversion. Playwright E2E runs against local Supabase; the AI is replaced by a deterministic fake only when `AI_MOCK=1` **and** `NODE_ENV !== 'production'`; the test user is signed in via the admin `generateLink` API.

---

## 7. Decisions for you to confirm

1. **Background generation + polling** for plans (vs. a single long request).
2. **Flexible "next workout"** scheduling (vs. strict calendar dates).
3. **Store birth year** rather than age; minimum age **16** (under-16s blocked with a message).
4. **Serwist** for the service worker.
5. **pnpm** as package manager.
6. Progression thresholds above (ceilings 12 reps / 45 s, entry ranges 5–8 / 10–20 s, two-session rule for both up and down).

---

## 8. Implementation notes (deviations from the original proposal)

- `cacheComponents` (on by default in the Next 16.4 template) is disabled: nearly every page reads per-user data through RLS-protected cookies, so request-time rendering is simpler.
- shadcn/ui components were written by hand from the new-york v4 sources because `ui.shadcn.com` is unreachable from the build sandbox; `components.json` is present so `shadcn add` works on a normal machine.
- Library has 88 exercises; side plank and arch hold are single-exercise chains.
- `progression_applied_at` is protected by a trigger (a column REVOKE would be ignored because Supabase grants table-level UPDATE).
- Plan generation (phase 3) uses `client.beta.messages.stream` with structured output (`betaZodOutputFormat`), effort `medium`, `max_tokens` 32k, and server-side refusal fallback (`fallbacks: "default"`). Without an `ANTHROPIC_API_KEY` the call fails and users get the template plan.
- `ai_usage.outcome = 'ok'` means the API returned output; whether it passed validation shows in the next row (`attempt = 2`) or in `plans.source = 'template'`.
- Workout logging (phase 4): the workout lives in IndexedDB (`lib/offline/db.ts`) and is the source of truth while training; `lib/offline/sync.ts` pushes the whole workout with idempotent upserts (sets conflict on `(session_exercise_id, set_number)` → last write wins). A second completion of the same plan day is kept as an extra session (week/day cleared). Realtime refreshes a device only when it has nothing unsynced. Losing the connection mid-workout is fully supported now; opening the app cold while offline needs the service worker (phase 8).
- Only main-block exercises are logged per set; warm-up and cool-down are shown as a checklist.
- Migration `20261029000000_ai_usage_error.sql` adds `ai_usage.error` with the API failure reason.
