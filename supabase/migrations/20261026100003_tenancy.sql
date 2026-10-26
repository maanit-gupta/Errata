-- Core tenancy: profiles, organisations, memberships, campaigns.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  specialist_kind public.specialist_kind,
  created_at timestamptz not null default now(),
  unique (org_id, user_id),
  -- specialist_kind is set exactly when the role is specialist
  constraint memberships_specialist_kind_check
    check ((role = 'specialist') = (specialist_kind is not null))
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  name text not null,
  starts_on date,
  ends_on date,
  status public.campaign_status not null default 'planned',
  created_at timestamptz not null default now(),
  -- lets child tables enforce "campaign belongs to the same org" with a composite FK
  unique (org_id, id),
  constraint campaigns_dates_check check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
