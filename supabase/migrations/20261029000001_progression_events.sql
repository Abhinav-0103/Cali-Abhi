-- One row per automatic progression change (written by the server only).
-- Also marks where an exercise's history "restarts" for the engine.
create table public.progression_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  plan_id        uuid not null,
  session_id     uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id    text not null references public.exercises(id),
  decision       text not null check (decision in ('increase_target','add_set','advance','regress','reduce_volume')),
  to_exercise_id text references public.exercises(id),
  message        text not null check (char_length(message) <= 300),
  version_id     uuid references public.plan_versions(id) on delete set null,
  created_at     timestamptz not null default now(),
  foreign key (plan_id, user_id) references public.plans(id, user_id) on delete cascade
);
create index progression_events_user_created_idx on public.progression_events (user_id, created_at desc);
create index progression_events_plan_exercise_idx on public.progression_events (plan_id, exercise_id, created_at desc);
create index progression_events_session_idx on public.progression_events (session_id);
create index progression_events_exercise_idx on public.progression_events (exercise_id);
create index progression_events_to_exercise_idx on public.progression_events (to_exercise_id);
create index progression_events_version_idx on public.progression_events (version_id);

alter table public.progression_events enable row level security;
create policy "progression_events: select own" on public.progression_events for select to authenticated
  using (user_id = (select auth.uid()));
