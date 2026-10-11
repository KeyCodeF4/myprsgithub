-- Apply this migration once to an existing MyPRS Supabase project.
-- It is safe to re-run: founder claims remain permanent and schema objects are
-- created or replaced idempotently.

alter table public.users
  add column if not exists founder_number int unique check (founder_number between 1 and 100);

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

revoke insert, update on public.users from authenticated;
grant insert (id, username, display_name, referral_code, selected_theme, unlocked_themes, level, xp)
  on public.users to authenticated;
grant update (username, display_name, referral_code, selected_theme, unlocked_themes, level, xp)
  on public.users to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, username, referral_code)
  values (
    new.id,
    split_part(coalesce(new.email, 'lifter'), '@', 1),
    'MPRS-' || upper(substr(md5(new.id::text), 1, 5))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

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

drop policy if exists "Signed-in users can submit anonymous product events" on public.product_events;
create policy "Signed-in users can submit anonymous product events"
  on public.product_events for insert
  to authenticated
  with check (true);

revoke all on public.product_events from anon, authenticated;
grant insert on public.product_events to authenticated;
grant usage, select on sequence public.product_events_id_seq to authenticated;

