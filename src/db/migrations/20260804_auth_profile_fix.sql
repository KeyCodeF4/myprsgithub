-- Makes auth profile creation collision-safe across email providers and domains.
-- Apply after the base schema when connecting a restored or replacement project.

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
