-- Content state machine (SPEC §4). transition_content() is the only way to change
-- contents.state; a trigger rejects every other write to state and the routing columns.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Set for the duration of a sanctioned write; the guard trigger lets it through.
create or replace function private.allow_workflow_write(p_on boolean)
returns void
language sql
set search_path = ''
as $$
  select set_config('brandlens.workflow_write', case when p_on then 'on' else 'off' end, true);
$$;

-- Guard: users may edit title/channel/format, never workflow columns.
create or replace function public.contents_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('brandlens.workflow_write', true), 'off') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.state <> 'draft' or new.route_to is not null or new.risk_score is not null
       or new.current_version_id is not null then
      raise exception 'new content must start as a draft with no version or routing'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if new.state is distinct from old.state then
    raise exception 'contents.state can only change through transition_content()'
      using errcode = 'insufficient_privilege';
  end if;
  if new.route_to is distinct from old.route_to
     or new.risk_score is distinct from old.risk_score
     or new.current_version_id is distinct from old.current_version_id
     or new.owner_id is distinct from old.owner_id
     or new.org_id is distinct from old.org_id
     or new.campaign_id is distinct from old.campaign_id then
    raise exception 'workflow columns of contents are managed by BrandLens'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger contents_guard before insert or update on public.contents
  for each row execute function public.contents_guard();

-- Latest finished run on any version of a content item.
create or replace function private.latest_done_run(p_content_id uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select r.id
  from public.review_runs r
  join public.versions v on v.id = r.version_id
  where v.content_id = p_content_id and r.status = 'done'
  order by coalesce(r.finished_at, r.created_at) desc
  limit 1;
$$;

create or replace function private.open_blockers(p_run_id uuid)
returns int
language sql
stable
set search_path = ''
as $$
  select count(*)::int from public.findings f
  where f.run_id = p_run_id and f.severity = 'blocker' and f.status = 'open';
$$;

-- The rule table. p_actor is null and p_system true for the worker.
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

-- User-facing entry point (authenticated). Submitting goes through enqueue_review() instead.
create or replace function public.transition_content(
  p_content_id uuid,
  p_to public.content_state,
  p_reason text default null,
  p_route_to text default null
)
returns public.contents
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;
  if p_to = 'ai_check' then
    raise exception 'submit with enqueue_review()' using errcode = 'invalid_parameter_value';
  end if;
  if not public.can_read_content(p_content_id) then
    raise exception 'content % not found', p_content_id using errcode = 'no_data_found';
  end if;
  return private.apply_transition(p_content_id, p_to, p_reason, (select auth.uid()), false, p_route_to, null);
end;
$$;

-- Worker entry point (service role only). route_to and risk_score are computed by the worker
-- from config.py weights (SPEC §10).
create or replace function public.transition_content_system(
  p_content_id uuid,
  p_to public.content_state,
  p_reason text default null,
  p_route_to text default null,
  p_risk_score real default null
)
returns public.contents
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.apply_transition(p_content_id, p_to, p_reason, null, true, p_route_to, p_risk_score);
end;
$$;

revoke execute on function public.transition_content(uuid, public.content_state, text, text) from public, anon;
grant execute on function public.transition_content(uuid, public.content_state, text, text) to authenticated;
revoke execute on function public.transition_content_system(uuid, public.content_state, text, text, real)
  from public, anon, authenticated;
grant execute on function public.transition_content_system(uuid, public.content_state, text, text, real)
  to service_role;

-- Versions: number them, point the content at the newest one, and supersede open findings whose
-- quote no longer appears (SPEC §4, changes_requested -> draft).
create or replace function public.versions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.contents where id = new.content_id for update;
  select coalesce(max(v.n), 0) + 1 into new.n from public.versions v where v.content_id = new.content_id;
  new.created_by := coalesce(new.created_by, (select auth.uid()));
  return new;
end;
$$;

create or replace function public.versions_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.allow_workflow_write(true);
  update public.contents set current_version_id = new.id where id = new.content_id;

  if new.body is not null then
    update public.findings f
    set status = 'superseded'
    from public.versions v
    where f.version_id = v.id
      and v.content_id = new.content_id
      and v.id <> new.id
      and f.status = 'open'
      and strpos(new.body, f.quote) = 0;
  end if;
  perform private.allow_workflow_write(false);
  return new;
end;
$$;

create trigger versions_number before insert on public.versions
  for each row execute function public.versions_before_insert();
create trigger versions_current after insert on public.versions
  for each row execute function public.versions_after_insert();

-- Finding resolution: stamp who/when, forbid users from superseding, audit every change.
create or replace function public.findings_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if new.status is not distinct from old.status
     and new.dismiss_reason is not distinct from old.dismiss_reason
     and new.dismiss_note is not distinct from old.dismiss_note then
    return new;
  end if;
  if v_actor is not null and new.status = 'superseded' and old.status <> 'superseded'
     and coalesce(current_setting('brandlens.workflow_write', true), 'off') <> 'on' then
    raise exception 'findings are superseded by BrandLens, not by hand' using errcode = 'insufficient_privilege';
  end if;
  if new.status <> 'dismissed' then
    new.dismiss_reason := null;
    new.dismiss_note := null;
  end if;
  if new.status = 'open' then
    new.resolved_by := null;
    new.resolved_at := null;
  else
    new.resolved_by := coalesce(v_actor, new.resolved_by);
    new.resolved_at := now();
  end if;

  insert into public.audit_events (org_id, actor_id, event)
  values (new.org_id, v_actor, jsonb_build_object(
    'type', 'finding_status',
    'finding_id', new.id,
    'version_id', new.version_id,
    'from', old.status,
    'to', new.status,
    'dismiss_reason', new.dismiss_reason
  ));
  return new;
end;
$$;

create trigger findings_status before update on public.findings
  for each row execute function public.findings_status_change();

revoke execute on function public.contents_guard() from public, anon, authenticated;
revoke execute on function public.versions_before_insert() from public, anon, authenticated;
revoke execute on function public.versions_after_insert() from public, anon, authenticated;
revoke execute on function public.findings_status_change() from public, anon, authenticated;
