-- =============================================================
-- MyPRS Supabase Schema
-- Run this in the Supabase SQL Editor to set up your database.
-- =============================================================

-- 1. USERS (extends auth.users)
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz default now(),
  username    text unique,
  display_name text,
  referral_code text unique,
  selected_theme text default 'default',
  unlocked_themes text[] default array['default'],
  level       int default 1,
  xp          bigint default 0,
  founder_number int unique check (founder_number between 1 and 100)
);

alter table public.users
  add column if not exists founder_number int unique check (founder_number between 1 and 100);

-- Founder numbers are server-issued and permanent. The sequence can continue
-- beyond 100, but only the first 100 claims receive an entitlement.
create sequence if not exists public.founder_number_seq;

create or replace function public.claim_founder_status()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  current_number int;
  candidate bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Serialise claims so two simultaneous sign-ups cannot receive the same slot.
  perform pg_advisory_xact_lock(73924100);

  select founder_number into current_number
  from public.users
  where id = auth.uid();

  if current_number is not null then
    return current_number;
  end if;

  candidate := nextval('public.founder_number_seq');
  if candidate <= 100 then
    update public.users
    set founder_number = candidate::int
    where id = auth.uid() and founder_number is null;
    return candidate::int;
  end if;

  return null;
end;
$$;

revoke all on function public.claim_founder_status() from public;
grant execute on function public.claim_founder_status() to authenticated;

alter table public.users enable row level security;

create policy "Users can read own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.users for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

-- Do not let a client forge or change its founder serial. Profile writes remain
-- available for the fields the app legitimately owns.
revoke insert, update on public.users from authenticated;
grant insert (id, username, display_name, referral_code, selected_theme, unlocked_themes, level, xp)
  on public.users to authenticated;
grant update (username, display_name, referral_code, selected_theme, unlocked_themes, level, xp)
  on public.users to authenticated;

-- Ensure every auth account has a profile even when email confirmation means
-- the client does not receive a signed-in session immediately after sign-up.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_prefix text;
  id_suffix text;
begin
  safe_prefix := left(regexp_replace(split_part(coalesce(new.email, 'lifter'), '@', 1), '[^a-zA-Z0-9_-]', '', 'g'), 18);
  id_suffix := left(replace(new.id::text, '-', ''), 6);

  insert into public.users (id, username, referral_code)
  values (
    new.id,
    coalesce(nullif(safe_prefix, ''), 'lifter') || '-' || id_suffix,
    'MPRS-' || upper(id_suffix)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Restored projects can already contain auth users even when the public schema
-- is empty. Give those accounts the same collision-safe profile shape as new
-- sign-ups so their workouts and backups can reference public.users.
insert into public.users (id, username, referral_code)
select
  existing.id,
  coalesce(
    nullif(left(regexp_replace(split_part(coalesce(existing.email, 'lifter'), '@', 1), '[^a-zA-Z0-9_-]', '', 'g'), 18), ''),
    'lifter'
  ) || '-' || left(replace(existing.id::text, '-', ''), 6),
  'MPRS-' || upper(left(replace(existing.id::text, '-', ''), 6))
from auth.users existing
on conflict (id) do nothing;

-- 2. WORKOUTS (exercises stored as jsonb for simplicity)
create table if not exists public.workouts (
  id         text primary key,
  user_id    uuid not null references public.users(id) on delete cascade,
  date       timestamptz not null default now(),
  duration   int default 0,
  mood       int default 3,
  exercises  jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_workouts_user_date
  on public.workouts(user_id, date desc);

alter table public.workouts enable row level security;

create policy "Users can read own workouts"
  on public.workouts for select
  using (auth.uid() = user_id);

create policy "Users can insert own workouts"
  on public.workouts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own workouts"
  on public.workouts for update
  using (auth.uid() = user_id);

create policy "Users can delete own workouts"
  on public.workouts for delete
  using (auth.uid() = user_id);

-- 3. WRAPPED CARDS (stats stored as jsonb)
create table if not exists public.wrapped_cards (
  id          text primary key,
  user_id     uuid not null references public.users(id) on delete cascade,
  type        text not null check (type in ('daily', 'weekly', 'monthly')),
  period_key  text,
  period_start timestamptz,
  period_end  timestamptz,
  title       text,
  stats       jsonb default '{}'::jsonb,
  headline_stat jsonb default '{}'::jsonb,
  secondary_stats jsonb default '[]'::jsonb,
  tier        int default 1,
  locked      boolean default false,
  created_at  timestamptz default now()
);

create index if not exists idx_wrapped_cards_user_type
  on public.wrapped_cards(user_id, type, created_at desc);

alter table public.wrapped_cards enable row level security;

create policy "Users can read own wrapped cards"
  on public.wrapped_cards for select
  using (auth.uid() = user_id);

create policy "Users can insert own wrapped cards"
  on public.wrapped_cards for insert
  with check (auth.uid() = user_id);

create policy "Users can update own wrapped cards"
  on public.wrapped_cards for update
  using (auth.uid() = user_id);

create policy "Users can delete own wrapped cards"
  on public.wrapped_cards for delete
  using (auth.uid() = user_id);

-- 4. MEDALS
create table if not exists public.medals (
  id          text primary key,
  user_id     uuid not null references public.users(id) on delete cascade,
  medal_type  text not null,
  pinned      boolean default false,
  unlocked_at timestamptz default now()
);

create index if not exists idx_medals_user
  on public.medals(user_id);

alter table public.medals enable row level security;

create policy "Users can read own medals"
  on public.medals for select
  using (auth.uid() = user_id);

create policy "Users can insert own medals"
  on public.medals for insert
  with check (auth.uid() = user_id);

create policy "Users can update own medals"
  on public.medals for update
  using (auth.uid() = user_id);

create policy "Users can delete own medals"
  on public.medals for delete
  using (auth.uid() = user_id);

-- 5. PUSH TOKENS (for Expo push notifications)
create table if not exists public.push_tokens (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null references public.users(id) on delete cascade,
  token       text not null,
  created_at  timestamptz default now(),
  unique(user_id, token)
);

alter table public.push_tokens enable row level security;

create policy "Users can read own push tokens"
  on public.push_tokens for select
  using (auth.uid() = user_id);

create policy "Users can insert own push tokens"
  on public.push_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own push tokens"
  on public.push_tokens for delete
  using (auth.uid() = user_id);

-- =============================================================
-- 6. ACCOUNT DELETION (App Store requirement)
-- Apple requires any app offering account creation to also offer
-- in-app account deletion. This lets a signed-in user erase their
-- own auth record; the ON DELETE CASCADE foreign keys above remove
-- their workouts, wrapped cards, medals and push tokens with it.
-- =============================================================
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

-- =============================================================
-- 7. OPT-IN PRODUCT EVENTS
-- Events intentionally contain no user_id, email or workout contents. An
-- authenticated session is required to insert, which limits anonymous abuse,
-- but the stored rows are identified only by a random installation id.
-- =============================================================
create table if not exists public.product_events (
  id              bigint generated always as identity primary key,
  installation_id text not null check (char_length(installation_id) between 12 and 80),
  event_name       text not null check (event_name in (
    'onboarding.completed',
    'workout.logged',
    'wrapped.created',
    'wrapped.shared',
    'medal.unlocked',
    'medal.equipped',
    'theme.equipped'
  )),
  properties      jsonb not null default '{}'::jsonb,
  platform        text not null check (platform in ('ios', 'android', 'web')),
  occurred_at     timestamptz not null,
  received_at     timestamptz not null default now()
);

create index if not exists idx_product_events_name_time
  on public.product_events(event_name, occurred_at desc);

alter table public.product_events enable row level security;

create policy "Signed-in users can submit anonymous product events"
  on public.product_events for insert
  to authenticated
  with check (true);

revoke all on public.product_events from anon, authenticated;
grant insert on public.product_events to authenticated;
grant usage, select on sequence public.product_events_id_seq to authenticated;

-- Private, one-to-one Wrapped card challenges.
-- Apply once in the Supabase SQL editor before enabling challenge links in production.

create table if not exists public.friend_challenges (
  id                    uuid primary key default gen_random_uuid(),
  invite_token          uuid not null unique default gen_random_uuid(),
  challenger_id         uuid not null references public.users(id) on delete cascade,
  recipient_id          uuid references public.users(id) on delete cascade,
  card_type              text not null check (card_type in ('daily', 'weekly', 'monthly')),
  challenger_snapshot   jsonb not null,
  recipient_snapshot    jsonb,
  status                 text not null default 'open' check (status in ('open', 'accepted')),
  challenger_viewed     boolean not null default false,
  recipient_viewed      boolean not null default false,
  created_at             timestamptz not null default now(),
  expires_at             timestamptz not null default (now() + interval '7 days'),
  accepted_at            timestamptz
);

create index if not exists idx_friend_challenges_challenger
  on public.friend_challenges(challenger_id, accepted_at desc);
create index if not exists idx_friend_challenges_recipient
  on public.friend_challenges(recipient_id, accepted_at desc);

alter table public.friend_challenges enable row level security;

drop policy if exists "Challenge participants can read results" on public.friend_challenges;
create policy "Challenge participants can read results"
  on public.friend_challenges for select
  to authenticated
  using (auth.uid() = challenger_id or auth.uid() = recipient_id);

drop policy if exists "Users can create own challenges" on public.friend_challenges;
create policy "Users can create own challenges"
  on public.friend_challenges for insert
  to authenticated
  with check (auth.uid() = challenger_id and recipient_id is null and status = 'open');

drop policy if exists "Challenge participants can mark results viewed" on public.friend_challenges;
create policy "Challenge participants can mark results viewed"
  on public.friend_challenges for update
  to authenticated
  using (auth.uid() = challenger_id or auth.uid() = recipient_id)
  with check (auth.uid() = challenger_id or auth.uid() = recipient_id);

create or replace function public.preview_friend_challenge(challenge_token uuid)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', id,
    'card_type', card_type,
    'challenger_snapshot', challenger_snapshot,
    'status', status,
    'expires_at', expires_at
  )
  from public.friend_challenges
  where invite_token = challenge_token
    and status = 'open'
    and expires_at > now()
  limit 1;
$$;

create or replace function public.accept_friend_challenge(
  challenge_token uuid,
  response_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted public.friend_challenges%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in to accept this challenge';
  end if;

  update public.friend_challenges
  set recipient_id = auth.uid(),
      recipient_snapshot = response_snapshot,
      status = 'accepted',
      accepted_at = now()
  where invite_token = challenge_token
    and status = 'open'
    and expires_at > now()
    and challenger_id <> auth.uid()
    and (response_snapshot ->> 'cardType') = card_type
  returning * into accepted;

  if accepted.id is null then
    raise exception 'This challenge is invalid, expired, already accepted, or belongs to you';
  end if;

  return jsonb_build_object(
    'id', accepted.id,
    'challenger_id', accepted.challenger_id,
    'recipient_id', accepted.recipient_id,
    'card_type', accepted.card_type,
    'challenger_snapshot', accepted.challenger_snapshot,
    'recipient_snapshot', accepted.recipient_snapshot,
    'accepted_at', accepted.accepted_at
  );
end;
$$;

revoke all on function public.preview_friend_challenge(uuid) from public;
revoke all on function public.accept_friend_challenge(uuid, jsonb) from public;
grant execute on function public.preview_friend_challenge(uuid) to authenticated;
grant execute on function public.accept_friend_challenge(uuid, jsonb) to authenticated;

revoke all on public.friend_challenges from anon;
grant select, insert, update on public.friend_challenges to authenticated;
