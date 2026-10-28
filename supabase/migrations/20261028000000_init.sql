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
