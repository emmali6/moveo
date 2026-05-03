-- Moveo: workout session history + notes + set feedback + per-exercise load profiles.
-- Run once in Supabase Dashboard → SQL → New query.
--
-- If you saw: relation "public.user_workout_sessions" does not exist
-- → this script creates that table first, then adds extras + RLS.

-- ---------------------------------------------------------------------------
-- 1) Session log table (required for “End session” + Account → Workout history)
-- ---------------------------------------------------------------------------
create table if not exists public.user_workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  goal text,
  duration_seconds integer,
  ended_at timestamptz,
  exercises jsonb not null default '[]'::jsonb,
  session_notes text,
  set_feedback jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_workout_sessions_user_ended_idx
  on public.user_workout_sessions (user_id, ended_at desc);

-- If the table already existed from an older setup, add missing columns:
alter table public.user_workout_sessions
  add column if not exists session_notes text;

alter table public.user_workout_sessions
  add column if not exists set_feedback jsonb default '[]'::jsonb;

alter table public.user_workout_sessions
  alter column set_feedback set default '[]'::jsonb;

alter table public.user_workout_sessions enable row level security;

drop policy if exists "workout_sessions_select_own" on public.user_workout_sessions;
create policy "workout_sessions_select_own"
  on public.user_workout_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "workout_sessions_insert_own" on public.user_workout_sessions;
create policy "workout_sessions_insert_own"
  on public.user_workout_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "workout_sessions_update_own" on public.user_workout_sessions;
create policy "workout_sessions_update_own"
  on public.user_workout_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "workout_sessions_delete_own" on public.user_workout_sessions;
create policy "workout_sessions_delete_own"
  on public.user_workout_sessions for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2) Aggregated “reps left after set” samples (adaptive rep targets)
-- ---------------------------------------------------------------------------
create table if not exists public.user_exercise_load_profiles (
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null,
  goal text not null,
  reps_after_samples integer[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id, goal)
);

create index if not exists user_exercise_load_profiles_user_idx
  on public.user_exercise_load_profiles (user_id);

alter table public.user_exercise_load_profiles enable row level security;

drop policy if exists "load_profiles_select_own" on public.user_exercise_load_profiles;
create policy "load_profiles_select_own"
  on public.user_exercise_load_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "load_profiles_insert_own" on public.user_exercise_load_profiles;
create policy "load_profiles_insert_own"
  on public.user_exercise_load_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "load_profiles_update_own" on public.user_exercise_load_profiles;
create policy "load_profiles_update_own"
  on public.user_exercise_load_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "load_profiles_delete_own" on public.user_exercise_load_profiles;
create policy "load_profiles_delete_own"
  on public.user_exercise_load_profiles for delete
  using (auth.uid() = user_id);
