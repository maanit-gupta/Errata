-- Collaboration: decisions, comments, append-only audit log, generated example suggestions.
create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  version_id uuid not null references public.versions (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action public.decision_action not null,
  -- set for 'override' decisions: the open warning being overridden (feeds GCS, SPEC §11)
  finding_id uuid references public.findings (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  constraint decisions_override_check
    check (action <> 'override' or (finding_id is not null and nullif(btrim(reason), '') is not null))
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  version_id uuid not null references public.versions (id) on delete cascade,
  author_id uuid not null references auth.users (id),
  body text not null,
  -- {"type":"span","start","end"} | {"type":"finding","finding_id"} | {"type":"region","page","x0".."y1"}
  anchor jsonb,
  parent_id uuid references public.comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint comments_body_not_blank check (btrim(body) <> '')
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organisations (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  -- {"type":"transition","content_id","from","to","reason"} | {"type":"finding_status",...} | ...
  event jsonb not null,
  at timestamptz not null default now()
);

-- Append-only, even for privileged roles. This also blocks cascaded deletes, so an org with
-- audit history can't be hard-deleted.
create or replace function public.audit_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_events is append-only' using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_events_no_update before update or delete on public.audit_events
  for each row execute function public.audit_events_append_only();

create table public.example_suggestions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  rule_id uuid not null references public.rule_cards (id) on delete cascade,
  examples jsonb not null,
  status public.suggestion_status not null default 'pending',
  created_at timestamptz not null default now(),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz
);
