-- Content, immutable versions, review runs, findings.
create table public.contents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  campaign_id uuid not null,
  owner_id uuid not null references auth.users (id),
  title text not null,
  channel text not null,
  format public.content_format not null default 'text',
  state public.content_state not null default 'draft',
  current_version_id uuid,
  -- 'manager' | 'legal' | 'a11y' | 'brand'
  route_to text,
  risk_score real,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (org_id, campaign_id) references public.campaigns (org_id, id),
  constraint contents_route_to_check check (route_to in ('manager', 'legal', 'a11y', 'brand'))
);

create trigger contents_updated_at before update on public.contents
  for each row execute function public.set_updated_at();

create table public.versions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents (id) on delete cascade,
  n int not null,
  body text,
  storage_path text,
  format public.content_format not null,
  -- SPEC §5: {goal, audience, cta, channel, campaign_id, notes?}
  intent jsonb not null default '{}',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (content_id, n),
  constraint versions_payload_check check (body is not null or storage_path is not null),
  constraint versions_intent_object check (jsonb_typeof(intent) = 'object')
);

alter table public.contents
  add constraint contents_current_version_fk
  foreign key (current_version_id) references public.versions (id) on delete set null;

-- Versions are immutable snapshots.
create or replace function public.versions_block_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'versions are immutable; save a new version instead'
    using errcode = 'check_violation';
end;
$$;

create trigger versions_immutable before update on public.versions
  for each row execute function public.versions_block_update();

create table public.review_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  version_id uuid not null references public.versions (id) on delete cascade,
  status public.run_status not null default 'queued',
  degraded boolean not null default false,
  error_code text,
  -- [{id, code, kind:'rule'|'fact', dimension, similarity}]
  retrieved jsonb not null default '[]',
  -- per-stage ms
  timings jsonb not null default '{}',
  provider text,
  model_version text,
  prompt_version text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  version_id uuid not null references public.versions (id) on delete cascade,
  run_id uuid not null references public.review_runs (id) on delete cascade,
  dimension public.dimension not null,
  rule_id uuid references public.rule_cards (id),
  fact_id uuid references public.facts (id),
  wcag_ref text,
  quote text not null,
  -- text: {"start":int,"end":int}; pdf/image: {"page":int,"x0":..,"y0":..,"x1":..,"y1":..}
  span jsonb not null,
  severity public.severity not null,
  confidence real not null,
  source public.finding_source not null,
  explanation text not null,
  rewrite text,
  status public.finding_status not null default 'open',
  dismiss_reason public.dismiss_reason,
  dismiss_note text,
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  model_version text,
  prompt_version text,
  created_at timestamptz not null default now(),
  -- Invariant 1: no uncited finding is ever stored.
  constraint findings_cited check (rule_id is not null or fact_id is not null or wcag_ref is not null),
  constraint findings_confidence_range check (confidence between 0 and 1),
  -- Invariant 6: overrides (dismissals) require a reason.
  constraint findings_dismiss_reason check ((status = 'dismissed') = (dismiss_reason is not null))
);
