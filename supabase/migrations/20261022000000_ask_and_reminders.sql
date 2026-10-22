-- Questions to the coach get their own daily allowance, and the daily reminder push needs
-- the browsers' push subscriptions.

-- ------------------------------------------------------------------ coach questions

alter table public.coach_usage add column asks integer not null default 0;

-- counts one question and says whether it is still within the daily limit
create function public.use_coach_ask(uid uuid, daily_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  used integer;
begin
  insert into public.coach_usage (user_id, day, asks)
  values (uid, current_date, 1)
  on conflict (user_id, day) do update set asks = public.coach_usage.asks + 1
  returning asks into used;
  return used <= daily_limit;
end;
$$;

revoke execute on function public.use_coach_ask(uuid, integer) from public, anon, authenticated;

-- ------------------------------------------------------------------ reminder push

-- One row per browser that asked for the daily reminder. The endpoint identifies the browser;
-- when someone else signs in on it, the row moves to them (see set_push_reminder).
create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  -- local hour of the reminder, in the browser's time zone
  reminder_hour smallint not null default 18 check (reminder_hour between 0 and 23),
  time_zone text not null default 'Europe/Zurich',
  lang text not null default 'de' check (lang in ('de', 'en', 'fr', 'it')),
  created_at timestamptz not null default now(),
  -- local date of the last reminder, so one day never gets two
  last_sent date
);

create index push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: read own" on public.push_subscriptions
  for select using (auth.uid() = user_id);
create policy "push_subscriptions: delete own" on public.push_subscriptions
  for delete using (auth.uid() = user_id);
-- writes go through the two functions below

-- saves (or moves to the signed-in user) this browser's subscription and reminder time
create function public.set_push_reminder(p_endpoint text, p_p256dh text, p_auth text, p_hour smallint, p_time_zone text, p_lang text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth, reminder_hour, time_zone, lang)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, p_hour, p_time_zone, p_lang)
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        reminder_hour = excluded.reminder_hour,
        time_zone = excluded.time_zone,
        lang = excluded.lang;
end;
$$;

revoke execute on function public.set_push_reminder(text, text, text, smallint, text, text) from public, anon;
grant execute on function public.set_push_reminder(text, text, text, smallint, text, text) to authenticated;
