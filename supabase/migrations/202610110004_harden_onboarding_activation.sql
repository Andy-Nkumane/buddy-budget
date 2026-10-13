do $$
declare definition text;
begin
  select pg_get_functiondef('public.setup_first_budget(text,text,text,text,text,text,jsonb)'::regprocedure)
  into definition;
  if position('date_trunc(''month'', current_date)::date' in definition)>0 then
    execute replace(
      definition,
      'date_trunc(''month'', current_date)::date',
      'date_trunc(''month'', (now() at time zone requested_timezone)::date)::date'
    );
  end if;
end $$;

create or replace function public.validate_onboarding_path_payload(
  requested_path text,
  requested_starter_id text,
  requested_starter_version integer,
  requested_starter_copy_key uuid,
  requested_import jsonb
)
returns void language plpgsql immutable set search_path='' as $$
begin
  if (requested_path='starter') is distinct from (requested_starter_id is not null)
    or (requested_starter_id is null and (requested_starter_version is not null or requested_starter_copy_key is not null))
    or (requested_starter_id is not null and (requested_starter_version is null or requested_starter_copy_key is null))
    or (requested_path='csv') is distinct from (requested_import is not null) then
    raise exception 'Onboarding path payload does not match the selected path' using errcode='22023';
  end if;
end $$;

revoke all on function public.validate_onboarding_path_payload(text,text,integer,uuid,jsonb) from public,anon,authenticated;

do $$
declare definition text;
begin
  select pg_get_functiondef('public.complete_first_budget_onboarding(uuid,text,text,text,text,text,text,jsonb,text,integer,uuid,jsonb)'::regprocedure)
  into definition;
  if position('perform public.validate_onboarding_path_payload' in definition)=0 then
    definition:=replace(
      definition,
      'perform pg_advisory_xact_lock',
      'perform public.validate_onboarding_path_payload(requested_path,requested_starter_id,requested_starter_version,requested_starter_copy_key,requested_import); perform pg_advisory_xact_lock'
    );
    execute definition;
  end if;
end $$;

revoke all on function public.complete_first_budget_onboarding(uuid,text,text,text,text,text,text,jsonb,text,integer,uuid,jsonb) from public,anon;
grant execute on function public.complete_first_budget_onboarding(uuid,text,text,text,text,text,text,jsonb,text,integer,uuid,jsonb) to authenticated;
