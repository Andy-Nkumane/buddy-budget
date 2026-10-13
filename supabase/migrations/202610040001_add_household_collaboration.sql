create table public.households (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  data_owner_user_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_memberships (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  joined_at timestamptz not null default now(),
  primary key (household_id,user_id)
);

create unique index household_single_owner_idx on public.household_memberships(household_id)
where role='owner';
create index household_memberships_user_idx on public.household_memberships(user_id,household_id);

create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null check (email=lower(btrim(email)) and email like '%@%'),
  role text not null check (role in ('editor','viewer')),
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  declined_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at>created_at),
  check (num_nonnulls(accepted_at,declined_at,revoked_at)<=1)
);
create unique index household_pending_invitation_idx
on public.household_invitations(household_id,email)
where accepted_at is null and declined_at is null and revoked_at is null;

create table public.household_activity (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index household_activity_timeline_idx on public.household_activity(household_id,created_at desc,id desc);

create table public.household_deletion_execution (
  transaction_id bigint primary key,
  user_id uuid not null references auth.users(id) on delete cascade
);
alter table public.household_deletion_execution enable row level security;

alter table public.profiles add column active_household_id uuid references public.households(id) on delete set null;

insert into public.households(id,owner_user_id,data_owner_user_id,name)
select users.id,users.id,users.id,coalesce(nullif(btrim(profile.display_name),''),users.email||'''s household','My household')
from auth.users users left join public.profiles profile on profile.user_id=users.id
on conflict (id) do nothing;

insert into public.household_memberships(household_id,user_id,role)
select id,owner_user_id,'owner' from public.households on conflict do nothing;

update public.profiles set active_household_id=user_id where active_household_id is null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(user_id) values(new.id) on conflict do nothing;
  insert into public.user_preferences(user_id) values(new.id) on conflict do nothing;
  insert into public.households(id,owner_user_id,data_owner_user_id,name)
  values(new.id,new.id,new.id,coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'),''),new.email||'''s household','My household'))
  on conflict do nothing;
  insert into public.household_memberships(household_id,user_id,role) values(new.id,new.id,'owner') on conflict do nothing;
  update public.profiles set active_household_id=new.id where user_id=new.id and active_household_id is null;
  return new;
end $$;

create or replace function public.has_household_role(requested_household_id uuid,allowed_roles text[])
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.household_memberships membership
    where membership.household_id=requested_household_id and membership.user_id=auth.uid()
      and membership.role=any(allowed_roles));
$$;

create or replace function public.current_household_id()
returns uuid language sql stable security definer set search_path='' as $$
  select membership.household_id
  from public.household_memberships membership
  left join public.profiles profile on profile.user_id=auth.uid()
  where membership.user_id=auth.uid()
  order by (membership.household_id=profile.active_household_id) desc,membership.joined_at,membership.household_id
  limit 1;
$$;

create or replace function public.current_household_owner_id()
returns uuid language sql stable security definer set search_path='' as $$
  select household.data_owner_user_id from public.households household
  where household.id=public.current_household_id();
$$;

revoke all on function public.has_household_role(uuid,text[]) from public,anon;
revoke all on function public.current_household_id() from public,anon;
revoke all on function public.current_household_owner_id() from public,anon;
grant execute on function public.has_household_role(uuid,text[]) to authenticated;
grant execute on function public.current_household_id() to authenticated;
grant execute on function public.current_household_owner_id() to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'categories','budget_templates','template_items','budget_months','budget_month_items',
    'financial_accounts','budget_transactions','transaction_import_batches',
    'transaction_categorisation_rules','categorisation_suggestion_dismissals','payment_schedules',
    'payment_schedule_occurrences','financial_goals','goal_contributions','goal_month_recommendations',
    'budget_month_lifecycle','month_close_summaries','month_adjustments','month_lifecycle_events',
    'backup_restore_runs','backup_recovery_snapshots'
  ] loop
    execute format('alter table public.%I add column household_id uuid references public.households(id) on delete cascade',table_name);
    execute format('update public.%I set household_id=user_id where household_id is null',table_name);
    execute format('alter table public.%I alter column household_id set not null',table_name);
    execute format('alter table public.%I alter column household_id set default public.current_household_id()',table_name);
    execute format('create index %I on public.%I(household_id)',table_name||'_household_idx',table_name);
  end loop;
end $$;

create or replace function public.assign_active_household()
returns trigger language plpgsql security definer set search_path='' as $$
declare selected_household uuid:=public.current_household_id(); selected_owner uuid;
begin
  if auth.uid() is null then
    new.household_id:=coalesce(new.household_id,new.user_id);
    return new;
  end if;
  if selected_household is null then raise exception 'No active household' using errcode='42501'; end if;
  if not public.has_household_role(selected_household,array['owner','editor']) then
    raise exception 'This household role cannot make changes' using errcode='42501';
  end if;
  if tg_op='UPDATE' and new.household_id<>old.household_id then
    raise exception 'Household ownership cannot be changed' using errcode='42501';
  end if;
  select data_owner_user_id into selected_owner from public.households where id=selected_household;
  if not exists(select 1 from public.backup_restore_execution execution
      where execution.transaction_id=txid_current() and execution.user_id=auth.uid())
    and new.household_id is not null and new.household_id<>selected_household then
    raise exception 'Cross-household ownership is not allowed' using errcode='42501';
  end if;
  if not exists(select 1 from public.backup_restore_execution execution
      where execution.transaction_id=txid_current() and execution.user_id=auth.uid())
    and new.user_id is not null and new.user_id not in (auth.uid(),selected_owner) then
    raise exception 'Cross-user ownership is not allowed' using errcode='42501';
  end if;
  new.household_id:=selected_household;
  new.user_id:=selected_owner;
  return new;
end $$;

create or replace function public.record_household_activity()
returns trigger language plpgsql security definer set search_path='' as $$
declare household uuid; record_id text;
begin
  if exists(select 1 from public.household_deletion_execution execution
    where execution.transaction_id=txid_current() and execution.user_id=auth.uid()) then
    return case when tg_op='DELETE' then old else new end;
  end if;
  if exists(select 1 from public.backup_restore_execution execution
    where execution.transaction_id=txid_current() and execution.user_id=auth.uid()) then
    return case when tg_op='DELETE' then old else new end;
  end if;
  household:=case when tg_op='DELETE' then old.household_id else new.household_id end;
  record_id:=case when tg_op='DELETE' then to_jsonb(old)->>'id' else to_jsonb(new)->>'id' end;
  insert into public.household_activity(household_id,actor_user_id,action,entity_type,entity_id)
  values(household,auth.uid(),lower(tg_op),tg_table_name,record_id);
  return case when tg_op='DELETE' then old else new end;
end $$;

do $$
declare table_name text; policy record;
begin
  foreach table_name in array array[
    'categories','budget_templates','template_items','budget_months','budget_month_items',
    'financial_accounts','budget_transactions','transaction_import_batches',
    'transaction_categorisation_rules','categorisation_suggestion_dismissals','payment_schedules',
    'payment_schedule_occurrences','financial_goals','goal_contributions','goal_month_recommendations',
    'budget_month_lifecycle','month_close_summaries','month_adjustments','month_lifecycle_events'
  ] loop
    for policy in select policyname from pg_policies where schemaname='public' and tablename=table_name loop
      execute format('drop policy %I on public.%I',policy.policyname,table_name);
    end loop;
    execute format('create policy household_select on public.%I for select to authenticated using (household_id=public.current_household_id() and public.has_household_role(household_id,array[''owner'',''editor'',''viewer'']))',table_name);
    execute format('create policy household_insert on public.%I for insert to authenticated with check (household_id=public.current_household_id() and public.has_household_role(household_id,array[''owner'',''editor'']))',table_name);
    execute format('create policy household_update on public.%I for update to authenticated using (household_id=public.current_household_id() and public.has_household_role(household_id,array[''owner'',''editor''])) with check (household_id=public.current_household_id() and public.has_household_role(household_id,array[''owner'',''editor'']))',table_name);
    execute format('create policy household_delete on public.%I for delete to authenticated using (household_id=public.current_household_id() and public.has_household_role(household_id,array[''owner'',''editor'']))',table_name);
    execute format('create trigger assign_active_household before insert or update on public.%I for each row execute function public.assign_active_household()',table_name);
    execute format('create trigger record_household_activity after insert or update or delete on public.%I for each row execute function public.record_household_activity()',table_name);
  end loop;
end $$;

alter table public.households enable row level security;
alter table public.household_memberships enable row level security;
alter table public.household_invitations enable row level security;
alter table public.household_activity enable row level security;
create policy households_select_member on public.households for select to authenticated
using(public.has_household_role(id,array['owner','editor','viewer']));
create policy memberships_select_member on public.household_memberships for select to authenticated
using(public.has_household_role(household_id,array['owner','editor','viewer']));
create policy invitations_select_owner on public.household_invitations for select to authenticated
using(public.has_household_role(household_id,array['owner']));
create policy activity_select_member on public.household_activity for select to authenticated
using(public.has_household_role(household_id,array['owner','editor','viewer']));

create or replace function public.create_household_invitation(requested_email text,requested_role text)
returns table(invitation_id uuid,invitation_token text,expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare household uuid:=public.current_household_id(); token text; created public.household_invitations%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(household::text||':membership',0));
  if not public.has_household_role(household,array['owner']) then raise exception 'Only the household owner can invite members' using errcode='42501'; end if;
  if requested_role not in ('editor','viewer') then raise exception 'Invalid household role' using errcode='22023'; end if;
  if requested_email is null or lower(btrim(requested_email)) not like '%@%' then raise exception 'Enter a valid email address' using errcode='22023'; end if;
  if exists(select 1 from public.household_memberships membership join auth.users users on users.id=membership.user_id
    where membership.household_id=household and lower(users.email)=lower(btrim(requested_email))) then
    raise exception 'This person is already a household member' using errcode='23505';
  end if;
  update public.household_invitations set revoked_at=now()
  where household_id=household and email=lower(btrim(requested_email)) and accepted_at is null and declined_at is null and revoked_at is null;
  token:=encode(extensions.gen_random_bytes(32),'hex');
  insert into public.household_invitations(household_id,email,role,token_hash,invited_by,expires_at)
  values(household,lower(btrim(requested_email)),requested_role,encode(extensions.digest(token,'sha256'),'hex'),auth.uid(),now()+interval '7 days') returning * into created;
  insert into public.household_activity(household_id,actor_user_id,action,entity_type,entity_id,details)
  values(household,auth.uid(),'invited','household_invitation',created.id::text,jsonb_build_object('role',requested_role));
  return query select created.id,token,created.expires_at;
end $$;

create or replace function public.respond_to_household_invitation(requested_token text,requested_accept boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.household_invitations%rowtype; verified_email text:=lower(coalesce(auth.jwt()->>'email',''));
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into invitation from public.household_invitations
  where token_hash=encode(extensions.digest(requested_token,'sha256'),'hex') for update;
  if invitation.id is null or invitation.accepted_at is not null or invitation.declined_at is not null or invitation.revoked_at is not null then
    raise exception 'This invitation is invalid or has already been used' using errcode='22023';
  end if;
  if invitation.expires_at<=now() then raise exception 'This invitation has expired' using errcode='22023'; end if;
  if verified_email='' or verified_email<>invitation.email then raise exception 'Sign in with the invited email address' using errcode='42501'; end if;
  if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Verify your email before accepting an invitation' using errcode='42501'; end if;
  if requested_accept then
    insert into public.household_memberships(household_id,user_id,role) values(invitation.household_id,auth.uid(),invitation.role)
    on conflict (household_id,user_id) do nothing;
    update public.household_invitations set accepted_at=now() where id=invitation.id;
    update public.profiles set active_household_id=invitation.household_id where user_id=auth.uid();
  else update public.household_invitations set declined_at=now() where id=invitation.id; end if;
  insert into public.household_activity(household_id,actor_user_id,action,entity_type,entity_id)
  values(invitation.household_id,auth.uid(),case when requested_accept then 'accepted' else 'declined' end,'household_invitation',invitation.id::text);
  return invitation.household_id;
end $$;

create or replace function public.switch_household(requested_household_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.has_household_role(requested_household_id,array['owner','editor','viewer']) then raise exception 'Household access denied' using errcode='42501'; end if;
  update public.profiles set active_household_id=requested_household_id where user_id=auth.uid();
end $$;

create or replace function public.update_household_name(requested_name text)
returns void language plpgsql security definer set search_path='' as $$
declare household uuid:=public.current_household_id(); normalized_name text:=btrim(requested_name);
begin
  if not public.has_household_role(household,array['owner']) then raise exception 'Only the household owner can rename it' using errcode='42501'; end if;
  if normalized_name='' or char_length(normalized_name)>80 then raise exception 'Household name must be between 1 and 80 characters' using errcode='22023'; end if;
  update public.households set name=normalized_name,updated_at=now() where id=household;
  insert into public.household_activity(household_id,actor_user_id,action,entity_type,entity_id,details)
  values(household,auth.uid(),'renamed','household',household::text,jsonb_build_object('name',normalized_name));
end $$;

create or replace function public.retrieve_household_context()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'active_household_id',public.current_household_id(),
    'households',coalesce((select jsonb_agg(jsonb_build_object(
      'id',household.id,'name',household.name,'role',membership.role,'created_at',household.created_at
    ) order by household.name,household.id)
      from public.household_memberships membership join public.households household on household.id=membership.household_id
      where membership.user_id=auth.uid()),'[]'::jsonb),
    'members',coalesce((select jsonb_agg(jsonb_build_object(
      'user_id',membership.user_id,'role',membership.role,'joined_at',membership.joined_at,
      'display_name',coalesce(nullif(profile.display_name,''),nullif(btrim(member_user.raw_user_meta_data->>'display_name'),''),member_user.email,'Member')
    ) order by case membership.role when 'owner' then 0 when 'editor' then 1 else 2 end,membership.joined_at)
      from public.household_memberships membership
      left join public.profiles profile on profile.user_id=membership.user_id
      left join auth.users member_user on member_user.id=membership.user_id
      where membership.household_id=public.current_household_id()),'[]'::jsonb),
    'invitations',coalesce((select jsonb_agg(jsonb_build_object(
      'id',invitation.id,'email',invitation.email,'role',invitation.role,'expires_at',invitation.expires_at,
      'created_at',invitation.created_at
    ) order by invitation.created_at desc)
      from public.household_invitations invitation where invitation.household_id=public.current_household_id()
      and invitation.accepted_at is null and invitation.declined_at is null and invitation.revoked_at is null
      and public.has_household_role(invitation.household_id,array['owner'])),'[]'::jsonb),
    'activity',coalesce((select jsonb_agg(activity_row.entry order by activity_row.created_at desc,activity_row.id desc)
      from (select activity.id,activity.created_at,to_jsonb(activity)-'household_id' entry
        from public.household_activity activity where activity.household_id=public.current_household_id()
        order by activity.created_at desc,activity.id desc limit 50) activity_row),'[]'::jsonb)
  );
$$;

create or replace function public.manage_household_member(requested_action text,requested_user_id uuid,requested_role text default null)
returns void language plpgsql security definer set search_path='' as $$
declare household uuid:=public.current_household_id(); member_role text; target_role text;
begin
  perform pg_advisory_xact_lock(hashtextextended(household::text||':membership',0));
  select role into member_role from public.household_memberships where household_id=household and user_id=auth.uid() for update;
  select role into target_role from public.household_memberships where household_id=household and user_id=requested_user_id for update;
  if requested_action='leave' then
    if requested_user_id<>auth.uid() then raise exception 'You can only leave for yourself' using errcode='42501'; end if;
    if public.has_household_role(household,array['owner']) then raise exception 'Transfer ownership before leaving' using errcode='23514'; end if;
    if member_role is null then raise exception 'Household membership not found' using errcode='P0002'; end if;
    delete from public.household_memberships where household_id=household and user_id=auth.uid();
  elsif not public.has_household_role(household,array['owner']) then raise exception 'Only the household owner can manage members' using errcode='42501';
  elsif requested_action='remove' then
    if target_role='owner' then raise exception 'The last owner cannot be removed' using errcode='23514'; end if;
    delete from public.household_memberships where household_id=household and user_id=requested_user_id;
  elsif requested_action='role' then
    if target_role='owner' or requested_role not in ('editor','viewer') then raise exception 'Invalid role change' using errcode='22023'; end if;
    update public.household_memberships set role=requested_role where household_id=household and user_id=requested_user_id;
  elsif requested_action='transfer' then
    if requested_user_id=auth.uid() or target_role is null then raise exception 'Choose another household member' using errcode='22023'; end if;
    update public.household_memberships set role='editor' where household_id=household and user_id=auth.uid();
    update public.household_memberships set role='owner' where household_id=household and user_id=requested_user_id;
    update public.households set owner_user_id=requested_user_id,updated_at=now() where id=household;
  else raise exception 'Unknown membership action' using errcode='22023'; end if;
  insert into public.household_activity(household_id,actor_user_id,action,entity_type,entity_id,details)
  values(household,auth.uid(),requested_action,'household_membership',requested_user_id::text,jsonb_build_object('role',requested_role));
end $$;

create or replace function public.revoke_household_invitation(requested_invitation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare household uuid:=public.current_household_id();
begin
  if not public.has_household_role(household,array['owner']) then raise exception 'Only the household owner can revoke invitations' using errcode='42501'; end if;
  update public.household_invitations set revoked_at=now() where id=requested_invitation_id and household_id=household
    and accepted_at is null and declined_at is null and revoked_at is null;
  if not found then raise exception 'Invitation is unavailable' using errcode='P0002'; end if;
  insert into public.household_activity(household_id,actor_user_id,action,entity_type,entity_id)
  values(household,auth.uid(),'revoked','household_invitation',requested_invitation_id::text);
end $$;

create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path='' as $$
declare current_user_id uuid:=auth.uid(); blocked_household text;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select household.name into blocked_household from public.households household
  where (household.owner_user_id=current_user_id or household.data_owner_user_id=current_user_id)
    and exists(select 1 from public.household_memberships membership
      where membership.household_id=household.id and membership.user_id<>current_user_id)
  limit 1;
  if blocked_household is not null then
    raise exception 'Transfer ownership and remove or relocate all members from % before deleting your account',blocked_household using errcode='23514';
  end if;
  insert into public.household_deletion_execution(transaction_id,user_id) values(txid_current(),current_user_id);
  insert into public.backup_restore_execution(transaction_id,user_id) values(txid_current(),current_user_id) on conflict do nothing;
  delete from public.household_memberships where user_id=current_user_id;
  delete from public.households where owner_user_id=current_user_id or data_owner_user_id=current_user_id;
  delete from auth.users where id=current_user_id;
end $$;

revoke all on function public.create_household_invitation(text,text) from public,anon;
revoke all on function public.respond_to_household_invitation(text,boolean) from public,anon;
revoke all on function public.switch_household(uuid) from public,anon;
revoke all on function public.update_household_name(text) from public,anon;
revoke all on function public.retrieve_household_context() from public,anon;
revoke all on function public.manage_household_member(text,uuid,text) from public,anon;
revoke all on function public.revoke_household_invitation(uuid) from public,anon;
grant execute on function public.create_household_invitation(text,text) to authenticated;
grant execute on function public.respond_to_household_invitation(text,boolean) to authenticated;
grant execute on function public.switch_household(uuid) to authenticated;
grant execute on function public.update_household_name(text) to authenticated;
grant execute on function public.retrieve_household_context() to authenticated;
grant execute on function public.manage_household_member(text,uuid,text) to authenticated;
grant execute on function public.revoke_household_invitation(uuid) to authenticated;

create or replace function public.prevent_household_activity_changes()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' and exists(select 1 from public.household_deletion_execution execution
    where execution.transaction_id=txid_current() and execution.user_id=auth.uid()) then return old; end if;
  raise exception 'Household activity is append-only' using errcode='42501';
end $$;
create trigger household_activity_append_only before update or delete on public.household_activity
for each row execute function public.prevent_household_activity_changes();

do $$
declare function_name text; definition text;
begin
  foreach function_name in array array[
    'create_month_from_template','set_default_template','move_category','move_template_item','create_category',
    'create_template_item','create_month_item','create_financial_account','retrieve_financial_accounts',
    'retrieve_budget_month_summaries','close_budget_month','reopen_budget_month','create_month_adjustment',
    'update_financial_account','create_budget_transaction','update_budget_transaction','delete_budget_transaction',
    'import_budget_transactions','undo_transaction_import_batch','upsert_categorisation_rule','move_categorisation_rule',
    'delete_categorisation_rule','process_categorisation_rules','retrieve_categorisation_suggestions',
    'dismiss_categorisation_suggestion','create_payment_schedule','update_payment_schedule',
    'refresh_payment_schedule_occurrences','confirm_payment_occurrence','create_financial_goal','update_financial_goal',
    'create_goal_contribution','delete_goal_contribution','retrieve_budget_insights'
  ] loop
    for definition in select pg_get_functiondef(proc.oid) from pg_proc proc join pg_namespace namespace on namespace.oid=proc.pronamespace
      where namespace.nspname='public' and proc.proname=function_name loop
      execute replace(definition,'auth.uid()','public.current_household_owner_id()');
    end loop;
  end loop;
end $$;

drop policy if exists backup_restore_runs_select_own on public.backup_restore_runs;
drop policy if exists backup_recovery_snapshots_select_own on public.backup_recovery_snapshots;
create policy backup_restore_runs_select_household_owner on public.backup_restore_runs for select to authenticated
using(household_id=public.current_household_id() and public.has_household_role(household_id,array['owner']));

create or replace function public.remove_jsonb_key_recursive(value jsonb,removed_key text)
returns jsonb language sql immutable set search_path='' as $$
  select case jsonb_typeof(value)
    when 'object' then coalesce((select jsonb_object_agg(entry.key,public.remove_jsonb_key_recursive(entry.value,removed_key))
      from jsonb_each(value) entry where entry.key<>removed_key),'{}'::jsonb)
    when 'array' then coalesce((select jsonb_agg(public.remove_jsonb_key_recursive(entry.value,removed_key))
      from jsonb_array_elements(value) entry),'[]'::jsonb)
    else value end;
$$;
revoke all on function public.remove_jsonb_key_recursive(jsonb,text) from public,anon,authenticated;
alter function public.create_backup_recovery_payload(uuid) rename to create_backup_recovery_payload_household_internal;
create function public.create_backup_recovery_payload(requested_user_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select public.remove_jsonb_key_recursive(public.create_backup_recovery_payload_household_internal(requested_user_id),'household_id');
$$;
revoke all on function public.create_backup_recovery_payload(uuid) from public,anon,authenticated;
create policy backup_recovery_snapshots_select_household_owner on public.backup_recovery_snapshots for select to authenticated
using(household_id=public.current_household_id() and public.has_household_role(household_id,array['owner']));

alter function public.restore_backup(jsonb,text,text,text) rename to restore_backup_household_internal;
revoke all on function public.restore_backup_household_internal(jsonb,text,text,text) from public,anon,authenticated;
create function public.restore_backup(requested_payload jsonb,requested_mode text,requested_fingerprint text,requested_confirmation text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare household uuid:=public.current_household_id(); data_owner uuid; actual_actor uuid:=auth.uid(); result jsonb; sanitized_payload jsonb;
begin
  if not public.has_household_role(household,array['owner']) then raise exception 'Only the household owner can restore backups' using errcode='42501'; end if;
  sanitized_payload:=public.remove_jsonb_key_recursive(requested_payload,'household_id');
  sanitized_payload:=public.remove_jsonb_key_recursive(sanitized_payload,'active_household_id');
  sanitized_payload:=public.remove_jsonb_key_recursive(sanitized_payload,'owner_user_id');
  sanitized_payload:=public.remove_jsonb_key_recursive(sanitized_payload,'data_owner_user_id');
  select data_owner_user_id into data_owner from public.households where id=household;
  perform set_config('request.jwt.claim.sub',data_owner::text,true);
  result:=public.restore_backup_household_internal(sanitized_payload,requested_mode,requested_fingerprint,requested_confirmation);
  insert into public.household_activity(household_id,actor_user_id,action,entity_type,entity_id,details)
  values(household,actual_actor,'restored','backup_restore',result->>'restore_id',jsonb_build_object('mode',requested_mode));
  return result;
end $$;
revoke all on function public.restore_backup(jsonb,text,text,text) from public,anon;
grant execute on function public.restore_backup(jsonb,text,text,text) to authenticated;

alter function public.rollback_backup_restore(uuid,text) rename to rollback_backup_restore_household_internal;
revoke all on function public.rollback_backup_restore_household_internal(uuid,text) from public,anon,authenticated;
create function public.rollback_backup_restore(requested_snapshot_id uuid,requested_confirmation text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare household uuid:=public.current_household_id(); data_owner uuid; actual_actor uuid:=auth.uid(); result jsonb;
begin
  if not public.has_household_role(household,array['owner']) then raise exception 'Only the household owner can roll back a restore' using errcode='42501'; end if;
  select data_owner_user_id into data_owner from public.households where id=household;
  perform set_config('request.jwt.claim.sub',data_owner::text,true);
  result:=public.rollback_backup_restore_household_internal(requested_snapshot_id,requested_confirmation);
  insert into public.household_activity(household_id,actor_user_id,action,entity_type,entity_id)
  values(household,actual_actor,'rolled_back','backup_restore',requested_snapshot_id::text);
  return result;
end $$;
revoke all on function public.rollback_backup_restore(uuid,text) from public,anon;
grant execute on function public.rollback_backup_restore(uuid,text) to authenticated;

revoke all on public.households,public.household_memberships,public.household_invitations,public.household_activity,public.household_deletion_execution from anon;
revoke all on public.household_invitations,public.household_deletion_execution from authenticated;
grant select on public.households,public.household_memberships,public.household_activity to authenticated;
