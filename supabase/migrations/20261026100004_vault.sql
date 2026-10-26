-- Brand vault: guides, rule cards, facts, glossary, assets.
create table public.brand_guides (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  title text not null,
  source_kind public.guide_source_kind not null,
  storage_path text,
  source_url text,
  status public.guide_status not null default 'uploaded',
  error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint brand_guides_source_check
    check ((source_kind = 'url') = (source_url is not null) and (source_kind = 'url' or storage_path is not null))
);

create table public.rule_cards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  guide_id uuid references public.brand_guides (id) on delete set null,
  code text not null,
  dimension public.dimension not null,
  title text not null,
  summary text not null,
  body text not null,
  -- [{kind:'do'|'dont', text, source:'guide'|'generated'}]
  examples jsonb not null default '[]',
  severity public.severity not null,
  status public.rule_status not null default 'draft',
  version int not null default 1,
  source_page int,
  never_send boolean not null default false,
  embedding extensions.vector(384),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, code, version),
  constraint rule_cards_examples_array check (jsonb_typeof(examples) = 'array')
);

create trigger rule_cards_updated_at before update on public.rule_cards
  for each row execute function public.set_updated_at();

create table public.facts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  -- null = org-wide (e.g. exit load)
  campaign_id uuid,
  code text not null,
  kind public.fact_kind not null,
  statement text not null,
  value jsonb not null default '{}',
  required_disclaimer text,
  valid_until timestamptz,
  never_send boolean not null default false,
  embedding extensions.vector(384),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, code),
  foreign key (org_id, campaign_id) references public.campaigns (org_id, id) on delete cascade
);

create trigger facts_updated_at before update on public.facts
  for each row execute function public.set_updated_at();

create table public.glossary_terms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  code text not null,
  preferred text not null,
  variants text[] not null default '{}',
  banned boolean not null default false,
  case_sensitive boolean not null default true,
  note text,
  unique (org_id, code)
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  kind public.asset_kind not null,
  name text not null,
  storage_path text,
  -- logo:    {"min_clear_space_ratio":0.25,"min_width_px":80}
  -- palette: {"colours":[{"name":"Ink","hex":"#141414"}],"max_delta_e":10}
  spec jsonb not null default '{}',
  created_at timestamptz not null default now()
);
