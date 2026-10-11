-- MyPRS opt-in behaviour dashboard queries.
-- Run these in the Supabase SQL Editor. Product events never contain emails,
-- workout contents, exercise names, weights, reps or titles.

-- Daily active opted-in installations
select
  date_trunc('day', occurred_at) as day,
  count(distinct installation_id) as active_installations
from public.product_events
group by 1
order by 1 desc;

-- First-session activation: onboarding to first logged workout
with first_events as (
  select
    installation_id,
    min(occurred_at) filter (where event_name = 'onboarding.completed') as onboarded_at,
    min(occurred_at) filter (where event_name = 'workout.logged') as first_workout_at
  from public.product_events
  group by installation_id
)
select
  count(*) filter (where onboarded_at is not null) as onboarded,
  count(*) filter (where onboarded_at is not null and first_workout_at is not null) as activated,
  round(
    100.0 * count(*) filter (where onboarded_at is not null and first_workout_at is not null)
    / nullif(count(*) filter (where onboarded_at is not null), 0),
    1
  ) as activation_percent
from first_events;

-- Weekly behaviour funnel
select
  date_trunc('week', occurred_at) as week,
  count(distinct installation_id) filter (where event_name = 'workout.logged') as logged_workout,
  count(distinct installation_id) filter (where event_name = 'wrapped.created') as created_wrapped,
  count(distinct installation_id) filter (where event_name = 'wrapped.shared') as shared_wrapped
from public.product_events
group by 1
order by 1 desc;

-- Which collectibles users equip
select
  event_name,
  properties,
  count(*) as events
from public.product_events
where event_name in ('medal.equipped', 'theme.equipped')
group by event_name, properties
order by events desc;

