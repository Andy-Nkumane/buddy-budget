alter table public.budget_templates
  add constraint budget_templates_id_household_unique unique(id,household_id);

create table public.shared_template_links (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  source_template_id uuid not null,
  version integer not null default 1 check (version>0),
  token_hash text not null unique check (token_hash~'^[0-9a-f]{64}$'),
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  includes_amounts boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null check (expires_at>created_at and expires_at<=created_at+interval '90 days'),
  revoked_at timestamptz,
  constraint shared_template_source_fk foreign key(source_template_id,household_id)
    references public.budget_templates(id,household_id) on delete cascade
);
create index shared_template_links_household_idx on public.shared_template_links(household_id,created_at desc);
create index shared_template_links_expiry_idx on public.shared_template_links(expires_at) where revoked_at is null;
create unique index shared_template_links_version_idx on public.shared_template_links(source_template_id,version);

create table public.shared_template_rate_limits (
  link_id uuid not null references public.shared_template_links(id) on delete cascade,
  visitor_hash text not null check(visitor_hash~'^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  request_count integer not null default 1 check(request_count between 1 and 300),
  primary key(link_id,visitor_hash,window_start)
);

create table public.shared_template_copies (
  link_id uuid not null references public.shared_template_links(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_household_id uuid not null references public.households(id) on delete cascade,
  copy_key uuid not null,
  created_template_id uuid not null,
  copied_at timestamptz not null default now(),
  primary key(recipient_user_id,copy_key),
  unique(link_id,recipient_household_id,copy_key),
  constraint shared_template_copy_template_fk foreign key(created_template_id,recipient_household_id)
    references public.budget_templates(id,household_id) on delete cascade
);

alter table public.shared_template_links enable row level security;
alter table public.shared_template_rate_limits enable row level security;
alter table public.shared_template_copies enable row level security;
create policy shared_template_links_owner_select on public.shared_template_links for select to authenticated
using(household_id=public.current_household_id() and public.has_household_role(household_id,array['owner']));
create policy shared_template_copies_recipient_select on public.shared_template_copies for select to authenticated
using(recipient_user_id=auth.uid() and recipient_household_id=public.current_household_id());
revoke all on public.shared_template_links,public.shared_template_rate_limits,public.shared_template_copies from public,anon,authenticated;
grant select on public.shared_template_links,public.shared_template_copies to authenticated;

create or replace function public.create_shared_template_link(
  requested_user_id uuid,requested_template_id uuid,requested_token_hash text,
  requested_include_amounts boolean,requested_expires_at timestamptz
) returns table(id uuid,expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare household uuid; selected_template public.budget_templates%rowtype; selected_version integer;
begin
  household:=public.require_shared_report_owner(requested_user_id);
  if requested_token_hash!~'^[0-9a-f]{64}$' or requested_expires_at<=now()
    or requested_expires_at>now()+interval '90 days' then
    raise exception 'Invalid template link request' using errcode='22023'; end if;
  select * into selected_template from public.budget_templates
  where budget_templates.id=requested_template_id and household_id=household and archived_at is null;
  if not found then raise exception 'Template unavailable' using errcode='P0002'; end if;
  if not exists(select 1 from public.template_items where template_id=selected_template.id
    and household_id=household and archived_at is null) then
    raise exception 'Template has no active items' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(requested_template_id::text,0));
  select coalesce(max(version),0)+1 into selected_version from public.shared_template_links
    where source_template_id=requested_template_id;
  return query insert into public.shared_template_links(
    household_id,created_by,source_template_id,version,token_hash,snapshot,includes_amounts,expires_at
  ) select household,requested_user_id,selected_template.id,selected_version,requested_token_hash,
    jsonb_build_object('schemaVersion',1,'name',selected_template.name,'version',selected_version,
      'includesAmounts',requested_include_amounts,'items',coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'key',gen_random_uuid()::text,'name',item.name,'itemType',item.item_type,
        'categoryName',coalesce(category.name,'Uncategorised'),'sortOrder',item.sort_order,
        'amount',case when requested_include_amounts then item.default_amount else null end
      )) order by item.sort_order,item.id),'[]'::jsonb))
    ,requested_include_amounts,requested_expires_at
  from public.template_items item left join public.categories category
    on category.id=item.category_id and category.household_id=household
  where item.template_id=selected_template.id and item.household_id=household and item.archived_at is null
  returning shared_template_links.id,shared_template_links.expires_at;
end $$;

create or replace function public.consume_shared_template_link(
  requested_token_hash text,requested_visitor_hash text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare shared_link public.shared_template_links%rowtype; selected_window timestamptz:=date_trunc('minute',now()); changed integer;
begin
  if current_user not in ('service_role','postgres') then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into shared_link from public.shared_template_links where token_hash=requested_token_hash for update;
  if not found or shared_link.revoked_at is not null or shared_link.expires_at<=now() then return null; end if;
  delete from public.shared_template_rate_limits where link_id=shared_link.id
    and window_start<selected_window-interval '1 day';
  insert into public.shared_template_rate_limits(link_id,visitor_hash,window_start)
  values(shared_link.id,repeat('0',64),selected_window)
  on conflict(link_id,visitor_hash,window_start) do update set request_count=public.shared_template_rate_limits.request_count+1
  where public.shared_template_rate_limits.request_count<300;
  get diagnostics changed=row_count;
  if changed=0 then return null; end if;
  insert into public.shared_template_rate_limits(link_id,visitor_hash,window_start)
  values(shared_link.id,requested_visitor_hash,selected_window)
  on conflict(link_id,visitor_hash,window_start) do update set request_count=public.shared_template_rate_limits.request_count+1
  where public.shared_template_rate_limits.request_count<30;
  get diagnostics changed=row_count;
  if changed=0 then return null; end if;
  return jsonb_build_object('snapshot',shared_link.snapshot,'expires_at',shared_link.expires_at);
end $$;

create or replace function public.copy_shared_template_link(
  requested_user_id uuid,requested_token_hash text,requested_copy_key uuid,
  requested_template_name text,requested_items jsonb
) returns setof public.budget_templates language plpgsql security definer set search_path='' as $$
declare household uuid; owner_id uuid; shared_link public.shared_template_links%rowtype; existing_id uuid; new_id uuid; input_count integer;
begin
  if current_user not in ('service_role','postgres') or requested_user_id is null then raise exception 'Forbidden' using errcode='42501'; end if;
  select active_household_id into household from public.profiles where user_id=requested_user_id;
  if household is null or not exists(select 1 from public.household_memberships
    where household_id=household and user_id=requested_user_id and role in ('owner','editor')) then
    raise exception 'This household role cannot copy templates' using errcode='42501'; end if;
  if requested_copy_key is null or char_length(btrim(requested_template_name)) not between 1 and 80
    or jsonb_typeof(requested_items)<>'array' or jsonb_array_length(requested_items) not between 1 and 100 then
    raise exception 'Invalid template copy request' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(requested_user_id::text||requested_copy_key::text,0));
  select created_template_id into existing_id from public.shared_template_copies
    where recipient_user_id=requested_user_id and copy_key=requested_copy_key;
  if existing_id is not null then return query select * from public.budget_templates where id=existing_id and household_id=household; return; end if;
  select * into shared_link from public.shared_template_links where token_hash=requested_token_hash
    and revoked_at is null and expires_at>now();
  if not found then raise exception 'Shared template unavailable' using errcode='P0002'; end if;
  select count(distinct input->>'key') into input_count from jsonb_array_elements(requested_items) input
    where exists(select 1 from jsonb_array_elements(shared_link.snapshot->'items') source
      where source->>'key'=input->>'key' and source->>'itemType'=input->>'itemType')
      and input->>'itemType' in ('income','expense') and char_length(btrim(input->>'name')) between 1 and 100
      and char_length(btrim(input->>'categoryName')) between 1 and 80
      and input->>'amount'~'^\d{1,12}(\.\d{1,2})?$'
      and (input->>'amount')::numeric between 0 and 999999999999.99;
  if input_count<>jsonb_array_length(requested_items) then raise exception 'Invalid shared template items' using errcode='22023'; end if;
  select data_owner_user_id into owner_id from public.households where id=household;
  insert into public.categories(user_id,household_id,item_type,name,sort_order)
  select owner_id,household,input->>'itemType',btrim(input->>'categoryName'),row_number() over()-1
  from jsonb_array_elements(requested_items) input
  where not exists(select 1 from public.categories category where category.household_id=household
    and category.item_type=input->>'itemType' and lower(category.name)=lower(btrim(input->>'categoryName')) and category.archived_at is null)
  on conflict do nothing;
  insert into public.budget_templates(user_id,household_id,name,is_default)
    values(owner_id,household,btrim(requested_template_name),false) returning id into new_id;
  insert into public.template_items(template_id,user_id,household_id,category_id,item_type,name,default_amount,sort_order)
  select new_id,owner_id,household,category.id,input.value->>'itemType',btrim(input.value->>'name'),(input.value->>'amount')::numeric,input.ordinality-1
  from jsonb_array_elements(requested_items) with ordinality input(value,ordinality)
  join public.categories category on category.household_id=household and category.item_type=input.value->>'itemType'
    and lower(category.name)=lower(btrim(input.value->>'categoryName')) and category.archived_at is null;
  if (select count(*) from public.template_items where template_id=new_id)<>jsonb_array_length(requested_items) then
    raise exception 'Every item requires an active category' using errcode='22023'; end if;
  insert into public.shared_template_copies(link_id,recipient_user_id,recipient_household_id,copy_key,created_template_id)
    values(shared_link.id,requested_user_id,household,requested_copy_key,new_id);
  return query select * from public.budget_templates where id=new_id;
end $$;

create or replace function public.retrieve_shared_template_links(requested_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare household uuid:=public.require_shared_report_owner(requested_user_id);
begin return coalesce((select jsonb_agg(jsonb_build_object('id',id,'templateId',source_template_id,'version',version,
  'name',snapshot->>'name','includesAmounts',includes_amounts,'expiresAt',expires_at,'revokedAt',revoked_at,'createdAt',created_at)
  order by created_at desc) from public.shared_template_links where household_id=household),'[]'::jsonb); end $$;

create or replace function public.revoke_shared_template_link(requested_user_id uuid,requested_link_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare household uuid:=public.require_shared_report_owner(requested_user_id); changed integer;
begin update public.shared_template_links set revoked_at=coalesce(revoked_at,now()) where id=requested_link_id and household_id=household;
get diagnostics changed=row_count; return changed=1; end $$;

create or replace function public.prevent_shared_template_link_mutation()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.household_id<>old.household_id
    or new.created_by<>old.created_by
    or new.source_template_id<>old.source_template_id
    or new.version<>old.version
    or new.token_hash<>old.token_hash
    or new.snapshot<>old.snapshot
    or new.includes_amounts<>old.includes_amounts
    or new.expires_at<>old.expires_at
    or new.created_at<>old.created_at
    or old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'Shared template snapshots are immutable' using errcode='55000';
  end if;
  return new;
end $$;

create trigger shared_template_links_immutable
before update on public.shared_template_links
for each row execute function public.prevent_shared_template_link_mutation();

revoke all on function public.create_shared_template_link(uuid,uuid,text,boolean,timestamptz),
 public.consume_shared_template_link(text,text),public.copy_shared_template_link(uuid,text,uuid,text,jsonb),
 public.retrieve_shared_template_links(uuid),public.revoke_shared_template_link(uuid,uuid) from public,anon,authenticated;
revoke all on function public.prevent_shared_template_link_mutation() from public,anon,authenticated;
grant execute on function public.create_shared_template_link(uuid,uuid,text,boolean,timestamptz),
 public.consume_shared_template_link(text,text),public.retrieve_shared_template_links(uuid),
 public.revoke_shared_template_link(uuid,uuid) to service_role;
grant execute on function public.copy_shared_template_link(uuid,text,uuid,text,jsonb) to service_role;
