-- Vault admin (P05): approve / revise rule cards atomically, and live updates for the vault UI.

-- Approve a draft: archive any other approved version of the same code, approve this one, and
-- queue embeddings. One approved version per code (partial unique index) is preserved.
create or replace function public.approve_rule_card(p_id uuid)
returns public.rule_cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rule_cards;
begin
  select * into r from public.rule_cards where id = p_id for update;
  if not found or not public.has_org_role(r.org_id, array['brand_admin']::public.member_role[]) then
    raise exception 'rule card % not found', p_id using errcode = 'no_data_found';
  end if;
  if r.status = 'approved' then
    return r;
  end if;
  update public.rule_cards set status = 'archived'
  where org_id = r.org_id and code = r.code and status = 'approved' and id <> r.id;
  update public.rule_cards set status = 'approved' where id = r.id returning * into r;

  insert into public.audit_events (org_id, actor_id, event)
  values (r.org_id, (select auth.uid()), jsonb_build_object(
    'type', 'rule_approved', 'rule_id', r.id, 'code', r.code, 'version', r.version));
  perform pgmq.send('vault_jobs', jsonb_build_object('job', 'embed_vault', 'org_id', r.org_id));
  return r;
end;
$$;

-- Edit a card. Drafts are edited in place; an approved card gets a new approved version (n+1)
-- and the old one is archived, so findings keep pointing at the text they were checked against.
create or replace function public.revise_rule_card(
  p_id uuid,
  p_title text,
  p_summary text,
  p_body text,
  p_examples jsonb,
  p_severity public.severity,
  p_dimension public.dimension
)
returns public.rule_cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rule_cards;
  v_next int;
begin
  select * into r from public.rule_cards where id = p_id for update;
  if not found or not public.has_org_role(r.org_id, array['brand_admin']::public.member_role[]) then
    raise exception 'rule card % not found', p_id using errcode = 'no_data_found';
  end if;
  if nullif(btrim(p_title), '') is null or nullif(btrim(p_summary), '') is null
     or nullif(btrim(p_body), '') is null then
    raise exception 'title, summary and body are required' using errcode = 'check_violation';
  end if;

  if r.status <> 'approved' then
    update public.rule_cards
    set title = p_title, summary = p_summary, body = p_body, examples = coalesce(p_examples, '[]'),
        severity = p_severity, dimension = p_dimension
    where id = r.id
    returning * into r;
    return r;
  end if;

  select max(version) + 1 into v_next from public.rule_cards where org_id = r.org_id and code = r.code;
  update public.rule_cards set status = 'archived' where id = r.id;
  insert into public.rule_cards (org_id, guide_id, code, dimension, title, summary, body, examples,
                                 severity, status, version, source_page, never_send)
  values (r.org_id, r.guide_id, r.code, p_dimension, p_title, p_summary, p_body,
          coalesce(p_examples, '[]'), p_severity, 'approved', v_next, r.source_page, r.never_send)
  returning * into r;

  insert into public.audit_events (org_id, actor_id, event)
  values (r.org_id, (select auth.uid()), jsonb_build_object(
    'type', 'rule_revised', 'rule_id', r.id, 'code', r.code, 'version', r.version));
  perform pgmq.send('vault_jobs', jsonb_build_object('job', 'embed_vault', 'org_id', r.org_id));
  return r;
end;
$$;

revoke execute on function public.approve_rule_card(uuid) from public, anon;
grant execute on function public.approve_rule_card(uuid) to authenticated;
revoke execute on function public.revise_rule_card(uuid, text, text, text, jsonb, public.severity, public.dimension)
  from public, anon;
grant execute on function public.revise_rule_card(uuid, text, text, text, jsonb, public.severity, public.dimension)
  to authenticated;

alter publication supabase_realtime add table public.brand_guides, public.rule_cards;
