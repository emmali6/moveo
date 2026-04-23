## Supabase workouts + history for Moveo

Moveo can run without accounts using `localStorage`, but if you want workouts + history synced to accounts, create these tables and policies.

### 1) Tables

Run in Supabase SQL editor:

```sql
-- Saved workouts (templates)
create table if not exists public.user_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  goal text,
  exercise_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Completed sessions (history)
create table if not exists public.user_workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  goal text,
  duration_seconds int,
  ended_at timestamptz not null default now(),
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
```

### 2) Row Level Security (RLS) policies

Enable RLS and allow users to access only their own rows:

```sql
alter table public.user_workouts enable row level security;
alter table public.user_workout_sessions enable row level security;

-- user_workouts
create policy "user_workouts_select_own"
on public.user_workouts for select
using (auth.uid() = user_id);

create policy "user_workouts_insert_own"
on public.user_workouts for insert
with check (auth.uid() = user_id);

create policy "user_workouts_delete_own"
on public.user_workouts for delete
using (auth.uid() = user_id);

-- user_workout_sessions
create policy "user_workout_sessions_select_own"
on public.user_workout_sessions for select
using (auth.uid() = user_id);

create policy "user_workout_sessions_insert_own"
on public.user_workout_sessions for insert
with check (auth.uid() = user_id);
```

### 3) Frontend behavior

- Anonymous users:
  - Workout builder and history are stored in `localStorage`.
- Signed-in users:
  - **Save to account** inserts into `public.user_workouts`.
  - Ending a session inserts into `public.user_workout_sessions`.

