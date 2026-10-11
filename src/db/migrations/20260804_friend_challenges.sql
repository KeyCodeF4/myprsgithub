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

