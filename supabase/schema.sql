create extension if not exists pgcrypto;

create table if not exists public.four_squads (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'draft' check (status in ('draft','invited','complete','registered','booked','attended')),
  creator_name text,
  creator_phone text,
  creator_email text,
  city text,
  preferred_cinema text,
  preferred_date date,
  preferred_showtime text,
  artwork_url text,
  consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.four_members (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.four_squads(id) on delete cascade,
  member_number smallint not null check (member_number between 1 and 4),
  name text,
  phone text,
  email text,
  consent boolean not null default false,
  photo_url text,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (squad_id, member_number)
);

create table if not exists public.campaign_events (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid references public.four_squads(id) on delete set null,
  event_type text not null check (event_type in (
    'created','photo_uploaded','artwork_generated','shared','invited',
    'member_joined','registered','cinema_selected','ticket_clicked',
    'reward_qualified','reward_claimed','attended'
  )),
  channel text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.reward_claims (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null unique references public.four_squads(id) on delete cascade,
  reward_code text not null unique,
  qualified_at timestamptz,
  claimed_at timestamptz,
  status text not null default 'qualified' check (status in ('qualified','claimed','expired')),
  created_at timestamptz not null default now()
);

create index if not exists idx_four_squads_status on public.four_squads(status);
create index if not exists idx_four_squads_created_at on public.four_squads(created_at);
create index if not exists idx_four_members_squad_id on public.four_members(squad_id);
create index if not exists idx_campaign_events_squad_id on public.campaign_events(squad_id);
create index if not exists idx_campaign_events_type on public.campaign_events(event_type);

alter table public.four_squads enable row level security;
alter table public.four_members enable row level security;
alter table public.campaign_events enable row level security;
alter table public.reward_claims enable row level security;

revoke all on public.four_squads from anon, authenticated;
revoke all on public.four_members from anon, authenticated;
revoke all on public.campaign_events from anon, authenticated;
revoke all on public.reward_claims from anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_four_squads_updated_at on public.four_squads;
create trigger trg_four_squads_updated_at
before update on public.four_squads
for each row execute function public.set_updated_at();

create or replace view public.four_campaign_metrics
with (security_invoker = true)
as
select
  (select count(*) from public.four_squads) as four_squads_created,
  (select count(*) from public.four_members) as people_registered,
  (select count(*) from public.campaign_events where event_type = 'shared') as social_shares,
  (select count(*) from public.campaign_events where event_type = 'cinema_selected') as cinema_intent,
  (select count(*) from public.reward_claims where status in ('qualified','claimed')) as rewards_qualified;


insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('four-photos','four-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;


create or replace function public.qualify_four_reward(p_squad_id uuid)
returns table (qualified boolean, reward_code text, rank integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  member_count integer;
  existing_code text;
  existing_created_at timestamptz;
  new_code text;
  current_count integer;
begin
  perform pg_advisory_xact_lock(41004);
  select count(*) into member_count from public.four_members where squad_id=p_squad_id;
  if member_count < 4 then return query select false,null::text,null::integer; return; end if;
  select rc.reward_code, rc.created_at into existing_code, existing_created_at from public.reward_claims rc where rc.squad_id=p_squad_id limit 1;
  if existing_code is not null then select count(*) into current_count from public.reward_claims rc where rc.created_at <= existing_created_at; return query select true,existing_code,current_count; return; end if;
  select count(*) into current_count from public.reward_claims;
  if current_count >= 500 then return query select false,null::text,null::integer; return; end if;
  loop
    new_code := 'F4R-' || upper(substr(encode(extensions.gen_random_bytes(5),'hex'),1,10));
    begin
      insert into public.reward_claims(squad_id,reward_code,qualified_at,status) values(p_squad_id,new_code,now(),'qualified'); exit;
    exception when unique_violation then
    end;
  end loop;
  return query select true,new_code,current_count+1;
end;
$$;
revoke all on function public.qualify_four_reward(uuid) from anon, authenticated;
grant execute on function public.qualify_four_reward(uuid) to service_role;

create or replace view public.four_campaign_metrics with (security_invoker = true) as
select
  (select count(*) from public.four_squads) as four_squads_created,
  (select count(*) from public.four_members) as people_registered,
  (select count(*) from public.campaign_events where event_type='shared') as social_shares,
  (select count(*) from public.campaign_events where event_type='cinema_selected') as cinema_intent,
  (select count(*) from public.reward_claims where status in ('qualified','claimed')) as rewards_qualified,
  (select count(*) from public.four_squads where status='complete') as complete_fours,
  (select count(*) from public.campaign_events where event_type='ticket_clicked') as ticket_clicks;


create or replace function public.claim_four_member(
  p_squad_id uuid,
  p_member_number smallint,
  p_name text,
  p_phone text,
  p_email text,
  p_consent boolean
)
returns table(member_id uuid, member_number smallint, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_number smallint := p_member_number;
  existing_id uuid;
  existing_phone text;
  next_number smallint;
begin
  if not p_consent then
    raise exception using errcode='P0001', message='Consent is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_squad_id::text, 44004));

  if target_number is null or target_number not between 1 and 4 then
    select fm.id, fm.member_number
      into existing_id, target_number
    from public.four_members fm
    where fm.squad_id = p_squad_id
      and trim(coalesce(fm.phone,'')) = trim(p_phone)
    order by fm.member_number
    limit 1;

    if existing_id is not null then
      update public.four_members
      set name=trim(p_name), email=nullif(trim(coalesce(p_email,'')),''), consent=true, joined_at=coalesce(joined_at, now())
      where id=existing_id;

      return query select existing_id, target_number, false;
      return;
    end if;

    for next_number in 1..4 loop
      if not exists (
        select 1 from public.four_members fm
        where fm.squad_id=p_squad_id and fm.member_number=next_number
      ) then
        target_number := next_number;
        exit;
      end if;
    end loop;

    if target_number is null or target_number not between 1 and 4 then
      raise exception using errcode='P0001', message='This Four is already complete.';
    end if;
  end if;

  select fm.id, fm.phone
    into existing_id, existing_phone
  from public.four_members fm
  where fm.squad_id=p_squad_id and fm.member_number=target_number
  limit 1;

  if existing_id is not null then
    if trim(coalesce(existing_phone,'')) <> trim(p_phone) then
      raise exception using errcode='P0001', message='That Four place is already claimed.';
    end if;

    update public.four_members
    set name=trim(p_name), email=nullif(trim(coalesce(p_email,'')),''), consent=true, joined_at=coalesce(joined_at, now())
    where id=existing_id;

    return query select existing_id, target_number, false;
    return;
  end if;

  insert into public.four_members(squad_id,member_number,name,phone,email,consent,joined_at)
  values(p_squad_id,target_number,trim(p_name),trim(p_phone),nullif(trim(coalesce(p_email,'')),''),true,now())
  returning id into existing_id;

  return query select existing_id, target_number, true;
end;
$$;

revoke all on function public.claim_four_member(uuid,smallint,text,text,text,boolean) from anon, authenticated;
grant execute on function public.claim_four_member(uuid,smallint,text,text,text,boolean) to service_role;
