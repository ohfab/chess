-- Rookly: accounts, the Pro plan, the synced app state and the coach's daily allowance.
-- Clients only ever read their own rows; the plan is written by the Stripe webhook alone.

-- ------------------------------------------------------------------ profiles

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Pro while this lies in the future (end of the paid period plus a short grace)
  pro_until timestamptz,
  stripe_customer_id text unique,
  subscription_id text,
  subscription_status text,
  -- monthly | yearly, for the account page
  subscription_interval text
);

alter table public.profiles enable row level security;

create policy "profiles: read own"
  on public.profiles for select
  using (auth.uid() = id);
-- no insert, update or delete policy: only the service role writes profiles

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_pro(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select pro_until > now() from public.profiles where id = uid), false);
$$;

-- ------------------------------------------------------------------ synced app state

-- One JSON document per user: archive, progress, settings. Last writer wins per document;
-- the app merges before it writes, so two devices do not undo each other.
create table public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  device text,
  constraint user_state_size check (pg_column_size(data) < 3000000)
);

alter table public.user_state enable row level security;

create policy "user_state: read own" on public.user_state
  for select using (auth.uid() = user_id);
create policy "user_state: insert own" on public.user_state
  for insert with check (auth.uid() = user_id);
create policy "user_state: update own" on public.user_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_state: delete own" on public.user_state
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------------ coach allowance

-- Calls to the AI coach per user and day; written by the coach function (service role).
create table public.coach_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  calls integer not null default 0,
  primary key (user_id, day)
);

alter table public.coach_usage enable row level security;

create policy "coach_usage: read own" on public.coach_usage
  for select using (auth.uid() = user_id);

-- counts one call and says whether it is still within the daily limit
create function public.use_coach(uid uuid, daily_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  used integer;
begin
  insert into public.coach_usage (user_id, day, calls)
  values (uid, current_date, 1)
  on conflict (user_id, day) do update set calls = public.coach_usage.calls + 1
  returning calls into used;
  return used <= daily_limit;
end;
$$;

revoke execute on function public.use_coach(uuid, integer) from public, anon, authenticated;
