# Supabase sign-up: where users go & how to mirror into a table

## Why you don’t see rows in “my table”

Moveo calls **`auth.signUp()`** (`js/app.js` → `handleSignUp`). That creates a user in Supabase **`auth.users`** (the auth system), **not** automatically in `public.your_table`.

- **To see registered users:** Supabase Dashboard → **Authentication** → **Users**  
  (Not the same place as **Table Editor** → `public` schemas.)

- **To have a row in `public` (e.g. `profiles`):** you must add that yourself, usually with:
  - a **database trigger** on `auth.users`, or  
  - an **Edge Function** / server route that inserts after sign-up.

There is **no** insert into a custom table in the current Moveo code, only `signUp` with `user_metadata` (`full_name`).

---

## Email confirmation

If **Confirm email** is enabled (**Authentication** → **Providers** → **Email**):

- The user is still created (often **unconfirmed** in **Authentication → Users**).
- `signUp` may return **`session: null`** until they click the confirmation link.
- The app shows: *“Account created! Please check your email to confirm…”*

Disable “Confirm email” (dev only) if you want immediate sessions without mail.

---

## API URL and key

In `js/app.js`, `SUPABASE_URL` and `SUPABASE_ANON_KEY` must be from **the same project**:

**Project Settings → API**

- **Project URL** → `SUPABASE_URL`
- Prefer the **anon (public) JWT** key (long string starting with `eyJ...`) for `SUPABASE_ANON_KEY` if anything auth-related fails.  
  Some setups use the newer **publishable** key (`sb_publishable_...`); your Supabase + `@supabase/supabase-js` version must support it.

Open **browser DevTools → Network** on sign-up: failed requests to `.../auth/v1/signup` usually mean URL/key or Auth provider misconfiguration.

---

## Optional: mirror each new user into `public.profiles`

Run in **SQL Editor** (adjust columns to taste):

```sql
-- 1) Table to store public profile rows
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- 2) Trigger: new auth user → insert profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

**Note:** `auth.users` triggers run in the DB; they fire when a user row is **actually inserted** (same conditions as Dashboard → Authentication → Users).

---

## Quick checklist

| Check | Where |
|--------|--------|
| User exists after sign-up | **Authentication → Users** |
| Wrong table | Don’t expect `public.*` unless you insert/trigger |
| Email confirm blocking session | Email settings + inbox / spam |
| Client errors | DevTools **Console** + **Network** on `signUp` |
