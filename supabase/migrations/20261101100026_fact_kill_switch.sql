-- R3 extra, Hero 2: publish-ready manifest and the fact kill-switch.
--
-- * content_fact_dependencies: the facts a content's latest checked version relies on, written by
--   the worker from the deterministic facts stage (pipeline/filters/facts.py).
-- * publish_manifests: a receipt issued when content becomes publish_ready: SHA-256 of the
--   normalised body (trim, collapse whitespace), the facts it relies on and the earliest expiry.
--   Versions are immutable (versions_immutable trigger), so the receipt lives in its own table.
-- * Kill-switch: editing or deleting a fact moves every dependent approved/publish_ready content
--   back to needs_revision at once; an expiry is caught by sweep_expired_fact_dependencies(),
--   which the worker calls every minute (an UPDATE trigger never fires when a date just passes).
--   Every move goes through private.apply_transition (new system-only branch, reason required,
--   audited), never a direct state write.

create table public.content_fact_dependencies (
  org_id uuid not null references public.organisations (id) on delete cascade,
  content_id uuid not null references public.contents (id) on delete cascade,
  version_id uuid not null references public.versions (id) on delete cascade,
  fact_id uuid not null references public.facts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (content_id, fact_id)
);
create index content_fact_dependencies_fact_idx on public.content_fact_dependencies (fact_id);

create table public.publish_manifests (
  version_id uuid primary key references public.versions (id) on delete cascade,
  org_id uuid not null references public.organisations (id) on delete cascade,
  content_id uuid not null references public.contents (id) on delete cascade,
  content_hash text check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$'),
  manifest jsonb not null check (jsonb_typeof(manifest) = 'object'),
  valid_until timestamptz,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text
);
create index publish_manifests_content_idx on public.publish_manifests (content_id);

alter table public.content_fact_dependencies enable row level security;
alter table public.publish_manifests enable row level security;
create policy content_fact_dependencies_select on public.content_fact_dependencies
  for select to authenticated using (public.can_read_content(content_id));
create policy publish_manifests_select on public.publish_manifests
  for select to authenticated using (public.can_read_content(content_id));
revoke all on public.content_fact_dependencies, public.publish_manifests from anon, authenticated;
grant select on public.content_fact_dependencies, public.publish_manifests to authenticated;

alter publication supabase_realtime add table public.publish_manifests;

-- The hash input. Python mirror: brandlens_worker/manifest.py (tests check they agree).
create or replace function private.normalise_body(p_body text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(btrim(coalesce(p_body, ''), E' \t\n\r\f\v'), E'[ \t\n\r\f\v]+', ' ', 'g');
$$;

create or replace function private.issue_manifest(c public.contents, p_actor uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v public.versions;
  v_hash text;
  v_facts jsonb;
  v_until timestamptz;
begin
  select * into v from public.versions where id = c.current_version_id;
  if not found then
    return;
  end if;
  -- File versions (image, PDF, DOCX) have no body here: the receipt records the facts and expiry,
  -- and the file's storage path instead of a text hash.
  v_hash := case when v.body is not null
    then encode(extensions.digest(private.normalise_body(v.body), 'sha256'), 'hex') end;
  select coalesce(jsonb_agg(jsonb_build_object('code', f.code, 'valid_until', f.valid_until)
                            order by f.code), '[]'::jsonb),
         min(f.valid_until)
    into v_facts, v_until
  from public.content_fact_dependencies d join public.facts f on f.id = d.fact_id
  where d.content_id = c.id;

  insert into public.publish_manifests (version_id, org_id, content_id, content_hash, manifest, valid_until)
  values (v.id, c.org_id, c.id, v_hash, jsonb_build_object(
      'version_id', v.id,
      'version_n', v.n,
      'format', v.format,
      'sha256', v_hash,
      'hash_of', case when v_hash is null then 'none (file version)' else 'normalised body' end,
      'storage_path', v.storage_path,
      'facts', v_facts,
      'valid_until', v_until,
      'issued_by', p_actor,
      'issued_at', now()),
    v_until)
  on conflict (version_id) do update
    set content_hash = excluded.content_hash, manifest = excluded.manifest,
        valid_until = excluded.valid_until, issued_at = now(),
        revoked_at = null, revoked_reason = null;
end;
$$;

create or replace function private.apply_transition(
  p_content_id uuid,
  p_to public.content_state,
  p_reason text,
  p_actor uuid,
  p_system boolean,
  p_route_to text default null,
  p_risk_score real default null
)
returns public.contents
language plpgsql
set search_path = ''
as $$
declare
  c public.contents;
  v_from public.content_state;
  v_to public.content_state := p_to;
  v_role public.member_role;
  v_kind public.specialist_kind;
  v_owner boolean := false;
  v_action public.decision_action;
  v_reason text := nullif(btrim(p_reason), '');
  v_route text;
  v_risk real;
  v_run uuid;
  v_n int;
begin
  select * into c from public.contents where id = p_content_id for update;
  if not found then
    raise exception 'content % not found', p_content_id using errcode = 'no_data_found';
  end if;
  v_from := c.state;
  v_route := c.route_to;
  v_risk := c.risk_score;

  if not p_system then
    select m.role, m.specialist_kind into v_role, v_kind
    from public.memberships m
    where m.org_id = c.org_id and m.user_id = p_actor;
    if v_role is null then
      raise exception 'not a member of this organisation' using errcode = 'insufficient_privilege';
    end if;
    v_owner := c.owner_id = p_actor;
  end if;

  if v_from = 'archived' then
    raise exception 'archived content cannot change state' using errcode = 'invalid_parameter_value';
  end if;
  if v_from = v_to then
    raise exception 'content is already %', v_to using errcode = 'invalid_parameter_value';
  end if;

  if v_to = 'archived' then
    if p_system or v_role not in ('manager', 'brand_admin') then
      raise exception 'only a manager or brand admin can archive' using errcode = 'insufficient_privilege';
    end if;
    v_action := 'archive';

  elsif v_to = 'ai_check' and v_from in ('draft', 'needs_revision') then
    if p_system or not (v_owner or v_role = 'brand_admin') then
      raise exception 'only the owner can submit for review' using errcode = 'insufficient_privilege';
    end if;
    if c.current_version_id is null then
      raise exception 'save a version before submitting' using errcode = 'check_violation';
    end if;
    if v_from = 'needs_revision' then
      v_run := private.latest_done_run(c.id);
      v_n := private.open_blockers(v_run);
      if v_n > 0 then
        raise exception '% blocker(s) still open: accept, edit, dismiss with a reason, or route each one', v_n
          using errcode = 'check_violation';
      end if;
    end if;
    v_route := null;
    v_risk := null;

  elsif v_from = 'ai_check' and v_to in ('needs_revision', 'in_review', 'specialist_review', 'draft') then
    if not p_system then
      raise exception 'only the review worker moves content out of ai_check'
        using errcode = 'insufficient_privilege';
    end if;
    if v_to = 'draft' then
      -- the run failed outright; hand the draft back
      if v_reason is null then
        raise exception 'a reason is required' using errcode = 'check_violation';
      end if;
    else
      v_run := private.latest_done_run(c.id);
      if v_run is null then
        raise exception 'no finished review run for this content' using errcode = 'check_violation';
      end if;
      v_n := private.open_blockers(v_run);
      if v_to = 'needs_revision' then
        if v_n = 0 then
          raise exception 'needs_revision requires at least one open blocker' using errcode = 'check_violation';
        end if;
      else
        if v_n > 0 then
          raise exception 'cannot enter review with % open blocker(s)', v_n using errcode = 'check_violation';
        end if;
        v_route := coalesce(p_route_to, 'manager');
        v_risk := p_risk_score;
        -- SPEC §4: anything not for the manager goes straight to the specialist
        v_to := case when v_route = 'manager' then 'in_review' else 'specialist_review' end::public.content_state;
      end if;
    end if;

  elsif v_from = 'needs_revision' and v_to = 'draft' then
    if p_system or not (v_owner or v_role = 'brand_admin') then
      raise exception 'only the owner can revise' using errcode = 'insufficient_privilege';
    end if;

  elsif v_from = 'in_review' and v_to in ('approved', 'specialist_review', 'changes_requested') then
    if p_system or v_role not in ('manager', 'brand_admin') then
      raise exception 'only a manager or brand admin can decide on content in review'
        using errcode = 'insufficient_privilege';
    end if;
    if v_to = 'approved' then
      select count(*) into v_n
      from public.findings f
      where f.version_id = c.current_version_id
        and f.severity = 'warning' and f.status = 'open'
        and not exists (
          select 1 from public.decisions d
          where d.finding_id = f.id and d.action = 'override'
        );
      if v_n > 0 then
        raise exception '% open warning(s) need an override with a reason before approval', v_n
          using errcode = 'check_violation';
      end if;
      v_action := 'approve';
    elsif v_to = 'specialist_review' then
      if p_route_to is null or p_route_to not in ('legal', 'a11y', 'brand') then
        raise exception 'escalation needs a route: legal, a11y or brand' using errcode = 'check_violation';
      end if;
      v_route := p_route_to;
    else
      if v_reason is null then
        raise exception 'a reason is required to request changes' using errcode = 'check_violation';
      end if;
      v_action := 'request_changes';
    end if;

  elsif v_from = 'specialist_review' and v_to in ('approved', 'changes_requested') then
    if p_system or not (
      (c.route_to in ('legal', 'a11y') and v_role = 'specialist' and v_kind::text = c.route_to)
      or (c.route_to in ('a11y', 'brand') and v_role = 'brand_admin')
    ) then
      raise exception 'only the % specialist can decide on this content', coalesce(c.route_to, 'routed')
        using errcode = 'insufficient_privilege';
    end if;
    if v_reason is null then
      raise exception 'a reason is required' using errcode = 'check_violation';
    end if;
    v_action := case when v_to = 'approved' then 'sign_off' else 'request_changes' end::public.decision_action;

  elsif v_from = 'changes_requested' and v_to = 'draft' then
    if p_system or not (v_owner or v_role = 'brand_admin') then
      raise exception 'only the owner can revise' using errcode = 'insufficient_privilege';
    end if;

  elsif v_from = 'approved' and v_to = 'publish_ready' then
    if p_system or not (v_owner or v_role in ('manager', 'brand_admin')) then
      raise exception 'only the owner, a manager or a brand admin can mark ready'
        using errcode = 'insufficient_privilege';
    end if;
    if not exists (
      select 1 from public.decisions d
      where d.version_id = c.current_version_id and d.action in ('approve', 'sign_off')
    ) then
      raise exception 'publish_ready requires an approval on the current version'
        using errcode = 'check_violation';
    end if;
    v_action := 'mark_ready';

  elsif v_from in ('approved', 'publish_ready') and v_to = 'needs_revision' then
    -- R3 Hero 2 kill-switch: a fact the approved copy depends on changed or expired. System only,
    -- always with a reason; the approval no longer holds, so the owner revises and resubmits.
    if not p_system then
      raise exception 'only the system revokes an approval (a cited fact changed or expired)'
        using errcode = 'insufficient_privilege';
    end if;
    if v_reason is null then
      raise exception 'a reason is required' using errcode = 'check_violation';
    end if;
    v_route := null;
    v_risk := null;

  else
    raise exception 'invalid transition % -> %', v_from, v_to using errcode = 'invalid_parameter_value';
  end if;

  perform private.allow_workflow_write(true);
  update public.contents
  set state = v_to, route_to = v_route, risk_score = v_risk
  where id = c.id
  returning * into c;
  perform private.allow_workflow_write(false);

  if v_action is not null and c.current_version_id is not null then
    insert into public.decisions (org_id, version_id, actor_id, action, reason)
    values (c.org_id, c.current_version_id, p_actor, v_action, v_reason);
  end if;

  -- R3 Hero 2: a receipt for exactly what was approved, and its revocation.
  if v_to = 'publish_ready' then
    perform private.issue_manifest(c, p_actor);
  elsif v_from = 'publish_ready' then
    update public.publish_manifests m
    set revoked_at = now(), revoked_reason = v_reason
    where m.content_id = c.id and m.revoked_at is null;
  end if;

  insert into public.audit_events (org_id, actor_id, event)
  values (c.org_id, p_actor, jsonb_build_object(
    'type', 'transition',
    'content_id', c.id,
    'version_id', c.current_version_id,
    'from', v_from,
    'to', v_to,
    'reason', v_reason,
    'system', p_system,
    'route_to', v_route,
    'risk_score', v_risk
  ));

  return c;
end;
$$;

-- Move every approved/publish_ready content that depends on p_fact back to needs_revision.
create or replace function private.fact_kill_switch(p_fact public.facts, p_cause text)
returns int
language plpgsql
set search_path = ''
as $$
declare
  r record;
  v_n int := 0;
  v_reason text := format('Fact %s %s after approval (%s). Re-check the copy against the vault.',
                          p_fact.code, p_cause, p_fact.statement);
begin
  for r in
    select c.id, c.org_id, c.state
    from public.content_fact_dependencies d join public.contents c on c.id = d.content_id
    where d.fact_id = p_fact.id and c.state in ('approved', 'publish_ready')
    order by c.id
  loop
    perform private.apply_transition(r.id, 'needs_revision', v_reason, null, true);
    insert into public.audit_events (org_id, actor_id, event)
    values (r.org_id, null, jsonb_build_object(
      'type', 'fact_kill_switch', 'content_id', r.id, 'fact_id', p_fact.id,
      'fact_code', p_fact.code, 'cause', p_cause, 'from', r.state, 'to', 'needs_revision'));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

create or replace function public.facts_kill_switch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.fact_kill_switch(old, 'was deleted');
    return old;
  end if;
  if old.value is distinct from new.value
     or old.statement is distinct from new.statement
     or old.required_disclaimer is distinct from new.required_disclaimer then
    perform private.fact_kill_switch(new, 'changed');
  elsif new.valid_until is not null and new.valid_until <= now()
        and (old.valid_until is null or old.valid_until > now()) then
    perform private.fact_kill_switch(new, 'expired');
  end if;
  return new;
end;
$$;

create trigger facts_kill_switch_update after update on public.facts
  for each row execute function public.facts_kill_switch();
-- BEFORE DELETE: the dependency rows still exist (the FK cascade would remove them first).
create trigger facts_kill_switch_delete before delete on public.facts
  for each row execute function public.facts_kill_switch();

-- Worker, every minute: facts whose valid_until has passed with approved dependants.
create or replace function public.sweep_expired_fact_dependencies()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.facts;
  v_n int := 0;
begin
  for f in
    select distinct on (x.id) x.*
    from public.facts x
    join public.content_fact_dependencies d on d.fact_id = x.id
    join public.contents c on c.id = d.content_id
    where x.valid_until is not null and x.valid_until <= now()
      and c.state in ('approved', 'publish_ready')
    order by x.id
  loop
    v_n := v_n + private.fact_kill_switch(f, 'expired');
  end loop;
  return v_n;
end;
$$;
revoke execute on function public.sweep_expired_fact_dependencies() from public, anon, authenticated;
grant execute on function public.sweep_expired_fact_dependencies() to service_role;
