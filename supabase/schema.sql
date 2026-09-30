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
