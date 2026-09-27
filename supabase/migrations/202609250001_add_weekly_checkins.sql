create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table public.weekly_checkin_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  opted_in boolean not null default false,
  weekday smallint not null default 1 check (weekday between 1 and 7),
  delivery_time time without time zone not null default '18:00',
  timezone text not null default 'UTC',
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  email_detail_enabled boolean not null default false,
  paused boolean not null default false,
  email_delivery_state text not null default 'active'
    check (email_delivery_state in ('active', 'bounced', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_checkin_channel_required check (
    not opted_in or in_app_enabled or email_enabled
  ),
  constraint weekly_checkin_email_detail_requires_email check (
    not email_detail_enabled or email_enabled
  )
);

create table public.notification_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('in_app', 'email')),
  delivery_kind text not null default 'weekly' check (delivery_kind in ('weekly', 'test')),
  job_key text not null check (char_length(job_key) between 8 and 200),
  period_start date not null,
  scheduled_for timestamptz not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'delivered', 'failed', 'failed_final', 'skipped')),
  attempt_count smallint not null default 0 check (attempt_count between 0 and 3),
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  next_attempt_at timestamptz,
  error_code text check (error_code is null or char_length(error_code) <= 64),
  error_summary text check (error_summary is null or char_length(error_summary) <= 160),
  provider_message_id text check (provider_message_id is null or char_length(provider_message_id) <= 200),
  read_at timestamptz,
  action_path text not null default '/app/budget/current'
    check (action_path ~ '^/app/[a-z0-9/_?=&-]*$'),
  summary_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_key)
);

create index notification_deliveries_queue_idx
  on public.notification_deliveries(status, next_attempt_at, scheduled_for, id)
  where status in ('queued', 'failed');
create index notification_deliveries_user_idx
  on public.notification_deliveries(user_id, scheduled_for desc, id);

create trigger weekly_checkin_preferences_set_updated_at
  before update on public.weekly_checkin_preferences
  for each row execute function public.set_updated_at();
create trigger notification_deliveries_set_updated_at
  before update on public.notification_deliveries
  for each row execute function public.set_updated_at();

alter table public.weekly_checkin_preferences enable row level security;
alter table public.notification_deliveries enable row level security;

create policy weekly_checkin_preferences_select_own
  on public.weekly_checkin_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy notification_deliveries_select_own
  on public.notification_deliveries for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.weekly_checkin_preferences from anon, authenticated;
revoke all on public.notification_deliveries from anon, authenticated;
grant select on public.weekly_checkin_preferences to authenticated;
grant select on public.notification_deliveries to authenticated;

create or replace function public.update_weekly_checkin_preferences(requested_preferences jsonb)
returns setof public.weekly_checkin_preferences
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_timezone text := nullif(requested_preferences->>'timezone', '');
  selected_opt_in boolean := coalesce((requested_preferences->>'opted_in')::boolean, false);
  selected_in_app boolean := coalesce((requested_preferences->>'in_app_enabled')::boolean, true);
  selected_email boolean := coalesce((requested_preferences->>'email_enabled')::boolean, false);
  selected_detail boolean := coalesce((requested_preferences->>'email_detail_enabled')::boolean, false);
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if selected_timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = selected_timezone
  ) then raise exception 'Invalid timezone' using errcode = '22023'; end if;
  if selected_opt_in and not selected_in_app and not selected_email then
    raise exception 'Choose at least one delivery channel' using errcode = '23514';
  end if;
  if selected_detail and not selected_email then
    raise exception 'Detailed email requires email delivery' using errcode = '23514';
  end if;

  insert into public.weekly_checkin_preferences (
    user_id, opted_in, weekday, delivery_time, timezone, in_app_enabled,
    email_enabled, email_detail_enabled, paused
  ) values (
    current_user_id, selected_opt_in,
    coalesce((requested_preferences->>'weekday')::smallint, 1),
    coalesce((requested_preferences->>'delivery_time')::time, '18:00'::time),
    selected_timezone, selected_in_app, selected_email, selected_detail,
    coalesce((requested_preferences->>'paused')::boolean, false)
  ) on conflict (user_id) do update set
    opted_in = excluded.opted_in,
    weekday = excluded.weekday,
    delivery_time = excluded.delivery_time,
    timezone = excluded.timezone,
    in_app_enabled = excluded.in_app_enabled,
    email_enabled = excluded.email_enabled,
    email_detail_enabled = excluded.email_detail_enabled,
    paused = excluded.paused;
  return query select * from public.weekly_checkin_preferences where user_id = current_user_id;
end;
$$;

create or replace function public.claim_due_weekly_checkins(requested_limit integer default 25)
returns setof public.notification_deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_preference public.weekly_checkin_preferences%rowtype;
  local_now timestamp;
  selected_period_start date;
  selected_channel text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if requested_limit not between 1 and 100 then
    raise exception 'Limit must be between 1 and 100' using errcode = '22023';
  end if;

  update public.notification_deliveries delivery set
    status = case when delivery.channel = 'in_app' then 'failed' else 'failed_final' end,
    next_attempt_at = case when delivery.channel = 'in_app' then now() else null end,
    error_code = 'stale_processing',
    error_summary = case
      when delivery.channel = 'in_app' then 'Interrupted in-app delivery will be retried.'
      else 'Email outcome was uncertain, so it was not retried.'
    end
  where delivery.status = 'processing'
    and delivery.last_attempt_at < now() - interval '15 minutes';

  for selected_preference in
    select preference.* from public.weekly_checkin_preferences preference
    where preference.opted_in and not preference.paused
      and (preference.in_app_enabled or (
        preference.email_enabled and preference.email_delivery_state = 'active'
      ))
  loop
    local_now := now() at time zone selected_preference.timezone;
    if extract(isodow from local_now)::smallint = selected_preference.weekday
      and local_now >= local_now::date + selected_preference.delivery_time
      and local_now < local_now::date + selected_preference.delivery_time + interval '30 minutes' then
      selected_period_start := date_trunc('week', local_now)::date;
      foreach selected_channel in array array['in_app', 'email'] loop
        if (selected_channel = 'in_app' and selected_preference.in_app_enabled)
          or (selected_channel = 'email' and selected_preference.email_enabled
            and selected_preference.email_delivery_state = 'active') then
          insert into public.notification_deliveries (
            user_id, channel, job_key, period_start, scheduled_for, next_attempt_at
          ) values (
            selected_preference.user_id,
            selected_channel,
            'weekly:' || selected_period_start::text || ':' || selected_channel,
            selected_period_start,
            now(),
            now()
          ) on conflict (user_id, job_key) do nothing;
        end if;
      end loop;
    end if;
  end loop;

  return query
  with candidates as (
    select delivery.id from public.notification_deliveries delivery
    join public.weekly_checkin_preferences preference on preference.user_id = delivery.user_id
    where delivery.status in ('queued', 'failed')
      and delivery.attempt_count < 3
      and coalesce(delivery.next_attempt_at, delivery.scheduled_for) <= now()
      and preference.opted_in and not preference.paused
      and (
        delivery.channel = 'in_app' and preference.in_app_enabled
        or delivery.channel = 'email' and preference.email_enabled
          and preference.email_delivery_state = 'active'
      )
    order by delivery.scheduled_for, delivery.id
    for update of delivery skip locked
    limit requested_limit
  )
  update public.notification_deliveries delivery set
    status = 'processing',
    attempt_count = delivery.attempt_count + 1,
    last_attempt_at = now(),
    error_code = null,
    error_summary = null
  from candidates where delivery.id = candidates.id
  returning delivery.*;
end;
$$;

create or replace function public.mark_notification_delivery_read(requested_delivery_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  update public.notification_deliveries
  set read_at = coalesce(read_at, now())
  where id = requested_delivery_id and user_id = auth.uid() and channel = 'in_app';
  if not found then raise exception 'Notification not found' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.create_test_checkin_delivery(requested_channel text)
returns setof public.notification_deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_preference public.weekly_checkin_preferences%rowtype;
  created_delivery public.notification_deliveries%rowtype;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into selected_preference from public.weekly_checkin_preferences
    where user_id = current_user_id for update;
  if not found or not selected_preference.opted_in or selected_preference.paused then
    raise exception 'Enable weekly check-ins before sending a test' using errcode = '55000';
  end if;
  if requested_channel = 'email' and (
    not selected_preference.email_enabled or selected_preference.email_delivery_state <> 'active'
  ) then raise exception 'Email delivery is unavailable' using errcode = '55000'; end if;
  if requested_channel = 'in_app' and not selected_preference.in_app_enabled then
    raise exception 'In-app delivery is unavailable' using errcode = '55000';
  end if;
  if requested_channel not in ('email', 'in_app') then
    raise exception 'Invalid delivery channel' using errcode = '22023';
  end if;
  if (
    select count(*) from public.notification_deliveries delivery
    where delivery.user_id = current_user_id and delivery.delivery_kind = 'test'
      and delivery.created_at >= now() - interval '1 hour'
  ) >= 3 then raise exception 'Test-send limit reached. Try again later.' using errcode = '57014'; end if;

  insert into public.notification_deliveries (
    user_id, channel, delivery_kind, job_key, period_start, scheduled_for,
    status, attempt_count, last_attempt_at
  ) values (
    current_user_id, requested_channel, 'test',
    'test:' || requested_channel || ':' || extensions.gen_random_uuid()::text,
    date_trunc('week', now() at time zone selected_preference.timezone)::date,
    now(), 'processing', 1, now()
  ) returning * into created_delivery;
  return query select * from public.notification_deliveries where id = created_delivery.id;
end;
$$;

revoke all on function public.update_weekly_checkin_preferences(jsonb) from public;
revoke all on function public.claim_due_weekly_checkins(integer) from public;
revoke all on function public.create_test_checkin_delivery(text) from public;
revoke all on function public.mark_notification_delivery_read(uuid) from public;
grant execute on function public.update_weekly_checkin_preferences(jsonb) to authenticated;
grant execute on function public.claim_due_weekly_checkins(integer) to service_role;
grant execute on function public.create_test_checkin_delivery(text) to authenticated;
grant execute on function public.mark_notification_delivery_read(uuid) to authenticated;

select cron.schedule(
  'buddy-budget-weekly-checkins',
  '*/15 * * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'buddy_budget_project_url')
        || '/functions/v1/weekly-checkin',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'buddy_budget_service_role_key'
        )
      ),
      body := '{"mode":"dispatch"}'::jsonb
    );
  $cron$
);
