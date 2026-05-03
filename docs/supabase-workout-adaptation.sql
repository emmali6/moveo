-- Moveo: notes, set feedback on sessions, and per-exercise rep adaptation (optional).
-- Run once in Supabase Dashboard → SQL → New query.

-- Session extras (safe if columns already exist)
alter table public.user_workout_sessions
  add column if not exists session_notes text;

alter table public.user_workout_sessions
  add column if not exists set_feedback jsonb default '[]'::jsonb;

-- Aggregated “reps left after set” samples per move + goal (for auto progression)
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
