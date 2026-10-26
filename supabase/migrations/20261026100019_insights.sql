-- P13: Guideline Clarity Score (SPEC §11), the insights summary, UNCLEAR flagging and example
-- suggestion review. The dashboard is one call per function.

-- GCS per rule card *version* (a new version starts a fresh score: its examples changed what it
-- means). N counts findings citing the card, excluding superseded ones (carried over or gone).
--   DismissalRate        = dismissed 'doesnt_apply' ÷ N   ('ai_wrong' is detector error, plan p.19)
--   ReviewerOverrideRate = (reviewed versions approved with an open r-finding or an override of one
--                           + request_changes citing the code on r-clean versions)
--                          ÷ (reviewed versions with r-findings + those blocks)
--   LowConfidenceRate    = findings with confidence < 0.6 ÷ N
create or replace function public.rule_gcs(p_org uuid, p_since timestamptz default now() - interval '90 days')
returns table (
  rule_id uuid,
  code text,
  title text,
  dimension public.dimension,
  version int,
  card_status public.rule_status,
  n int,
  dismissal_rate real,
  override_rate real,
  low_confidence_rate real,
  gcs int,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  with allowed as (
    -- Direct DB sessions (worker, simulator) have no JWT; users need manager or brand admin.
    select 1 where (select auth.uid()) is null
       or public.has_org_role(p_org, array['manager', 'brand_admin']::public.member_role[])
  ),
  f as (
    select f.* from public.findings f
    where f.org_id = p_org and f.rule_id is not null and f.status <> 'superseded'
      and f.created_at >= p_since and exists (select 1 from allowed)
  ),
  per_rule as (
    select f.rule_id,
           count(*)::int as n,
           count(*) filter (where f.status = 'dismissed' and f.dismiss_reason = 'doesnt_apply')::real as dismissed,
           count(*) filter (where f.confidence < 0.6)::real as low_conf
    from f group by f.rule_id
  ),
  reviewed as (  -- versions with an r-finding that got a review decision
    select distinct f.rule_id, f.version_id
    from f join public.decisions d on d.version_id = f.version_id
    where d.action in ('approve', 'request_changes', 'sign_off', 'override')
  ),
  overridden as (
    select r.rule_id, count(*)::real as k from reviewed r
    where exists (
      select 1 from public.decisions d join f on f.id = d.finding_id
      where d.version_id = r.version_id and d.action = 'override' and f.rule_id = r.rule_id
    ) or (
      exists (select 1 from public.decisions d
              where d.version_id = r.version_id and d.action in ('approve', 'sign_off'))
      and exists (select 1 from f where f.version_id = r.version_id and f.rule_id = r.rule_id
                  and f.status = 'open')
    )
    group by r.rule_id
  ),
  blocks as (  -- reviewers asking for changes citing r on a version where r found nothing
    select rc.id as rule_id, count(*)::real as k
    from public.rule_cards rc
    join public.decisions d on d.org_id = rc.org_id and d.action = 'request_changes'
      and d.created_at >= p_since and d.reason ilike '%' || rc.code || '%'
    where rc.org_id = p_org and exists (select 1 from allowed)
      and not exists (select 1 from f where f.version_id = d.version_id and f.rule_id = rc.id)
      and (rc.status = 'approved' or exists (select 1 from f where f.rule_id = rc.id))
    group by rc.id
  ),
  scored as (
    select p.rule_id, p.n,
           p.dismissed / p.n as dr,
           coalesce((coalesce(o.k, 0) + coalesce(b.k, 0))
                    / nullif((select count(*) from reviewed r where r.rule_id = p.rule_id) + coalesce(b.k, 0), 0), 0) as orr,
           p.low_conf / p.n as lcr
    from per_rule p
    left join overridden o on o.rule_id = p.rule_id
    left join blocks b on b.rule_id = p.rule_id
  )
  select rc.id, rc.code, rc.title, rc.dimension, rc.version, rc.status,
         coalesce(s.n, 0),
         s.dr::real, s.orr::real, s.lcr::real,
         case when s.n >= 10 then round(100 * (1 - (0.45 * s.dr + 0.35 * s.orr + 0.20 * s.lcr)))::int end,
         case
           when coalesce(s.n, 0) < 10 then 'insufficient'
           when 100 * (1 - (0.45 * s.dr + 0.35 * s.orr + 0.20 * s.lcr)) < 65 then 'unclear'
           when 100 * (1 - (0.45 * s.dr + 0.35 * s.orr + 0.20 * s.lcr)) <= 75 then 'watch'
           else 'clear'
         end
  from public.rule_cards rc
  left join scored s on s.rule_id = rc.id
  where rc.org_id = p_org and exists (select 1 from allowed)
    and (rc.status = 'approved' or s.n is not null)
  order by rc.code, rc.version;
$$;

-- KPI tiles and the recurring-issues chart (plan p.19). Brand-fit per checked version is
-- 100 − 10·blockers − 3·warnings (floored at 0) over its latest finished run.
create or replace function public.insights_summary(p_org uuid, p_since timestamptz default now() - interval '30 days')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if (select auth.uid()) is not null
     and not public.has_org_role(p_org, array['manager', 'brand_admin']::public.member_role[]) then
    raise exception 'insights are for managers and brand admins' using errcode = 'insufficient_privilege';
  end if;

  with runs as (
    select distinct on (r.version_id) r.id, r.version_id
    from public.review_runs r
    where r.org_id = p_org and r.status = 'done' and r.created_at >= p_since
    order by r.version_id, r.created_at desc
  ),
  fit as (
    select greatest(0, 100
      - 10 * count(f.id) filter (where f.severity = 'blocker')
      - 3 * count(f.id) filter (where f.severity = 'warning')) as score
    from runs left join public.findings f on f.run_id = runs.id
    group by runs.id
  ),
  first_review as (
    select distinct on (v.content_id) v.content_id, d.action
    from public.decisions d join public.versions v on v.id = d.version_id
    where d.org_id = p_org and d.action in ('approve', 'request_changes') and d.created_at >= p_since
    order by v.content_id, d.created_at
  ),
  approval as (
    select extract(epoch from min(d.created_at) - min(v0.created_at)) / 86400.0 as days
    from public.decisions d
    join public.versions v on v.id = d.version_id
    join public.versions v0 on v0.content_id = v.content_id
    where d.org_id = p_org and d.action = 'approve' and d.created_at >= p_since
    group by v.content_id
  ),
  issues as (
    select coalesce(rc.code, fc.code, 'WCAG ' || f.wcag_ref) as code,
           coalesce(rc.title, fc.statement, 'WCAG ' || f.wcag_ref) as label,
           f.dimension::text as dimension,
           count(*)::int as n
    from public.findings f
    left join public.rule_cards rc on rc.id = f.rule_id
    left join public.facts fc on fc.id = f.fact_id
    where f.org_id = p_org and f.status <> 'superseded' and f.created_at >= now() - interval '30 days'
    group by 1, 2, 3
    order by n desc, code
    limit 8
  )
  select jsonb_build_object(
    'since', p_since,
    'versions_checked', (select count(*) from runs),
    'avg_brand_fit', (select round(avg(score))::int from fit),
    'first_review_approval_pct',
      (select round(100.0 * count(*) filter (where action = 'approve') / nullif(count(*), 0))::int
       from first_review),
    'reviews', (select count(*) from first_review),
    'median_days_to_approval',
      (select round((percentile_cont(0.5) within group (order by days))::numeric, 1) from approval),
    'blockers_this_week',
      (select count(*) from public.findings f
       where f.org_id = p_org and f.severity = 'blocker' and f.status <> 'superseded'
         and f.created_at >= now() - interval '7 days'),
    'top_issues', coalesce((select jsonb_agg(to_jsonb(i)) from issues i), '[]'::jsonb),
    'simulated', exists (
      select 1 from public.audit_events a
      where a.org_id = p_org and a.at >= p_since and (a.event ->> 'simulated')::boolean is true)
  ) into v;
  return v;
end;
$$;

-- Flag current (approved) rule versions that have crossed into UNCLEAR and have no suggestions yet:
-- audit it and queue one `generate_examples` job per rule. Called by the worker after each review
-- and by the activity simulator. Returns the rules it flagged.
create or replace function public.flag_unclear_rules(p_org uuid)
returns table (rule_id uuid, code text, gcs int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if (select auth.uid()) is not null then
    raise exception 'only the worker flags rules' using errcode = 'insufficient_privilege';
  end if;
  for r in
    select g.rule_id, g.code, g.gcs from public.rule_gcs(p_org) g
    where g.status = 'unclear' and g.card_status = 'approved'
      and not exists (select 1 from public.example_suggestions s where s.rule_id = g.rule_id)
  loop
    -- A pending placeholder makes flagging idempotent while the job runs.
    insert into public.example_suggestions (org_id, rule_id, examples, status)
    values (p_org, r.rule_id, '[]', 'pending');
    insert into public.audit_events (org_id, actor_id, event)
    values (p_org, null, jsonb_build_object(
      'type', 'rule_unclear', 'rule_id', r.rule_id, 'code', r.code, 'gcs', r.gcs));
    perform pgmq.send('vault_jobs', jsonb_build_object(
      'job', 'generate_examples', 'org_id', p_org, 'rule_id', r.rule_id, 'gcs', r.gcs));
    rule_id := r.rule_id; code := r.code; gcs := r.gcs;
    return next;
  end loop;
end;
$$;

-- A brand admin approves or rejects each generated example. `p_keep` is the subset (by index)
-- to add; approving appends them to the rule's examples with source 'generated', which creates the
-- next version of the card (the old one is archived) and re-embeds it via revise_rule_card.
create or replace function public.decide_example_suggestion(p_id uuid, p_keep int[])
returns public.rule_cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.example_suggestions;
  r public.rule_cards;
  v_new jsonb;
begin
  select * into s from public.example_suggestions where id = p_id for update;
  if not found or not public.has_org_role(s.org_id, array['brand_admin']::public.member_role[]) then
    raise exception 'suggestion % not found', p_id using errcode = 'no_data_found';
  end if;
  if s.status <> 'pending' or jsonb_array_length(s.examples) = 0 then
    raise exception 'this suggestion is not awaiting a decision' using errcode = 'check_violation';
  end if;
  select * into r from public.rule_cards where id = s.rule_id;

  select coalesce(jsonb_agg(e.value || jsonb_build_object('source', 'generated') order by e.ord), '[]')
  into v_new
  from jsonb_array_elements(s.examples) with ordinality e(value, ord)
  where (e.ord - 1)::int = any(coalesce(p_keep, '{}'));

  update public.example_suggestions
  set status = (case when jsonb_array_length(v_new) > 0 then 'approved' else 'rejected' end)::public.suggestion_status,
      decided_by = (select auth.uid()), decided_at = now()
  where id = s.id;
  insert into public.audit_events (org_id, actor_id, event)
  values (s.org_id, (select auth.uid()), jsonb_build_object(
    'type', 'examples_decided', 'suggestion_id', s.id, 'rule_id', s.rule_id, 'code', r.code,
    'approved', jsonb_array_length(v_new), 'offered', jsonb_array_length(s.examples)));

  if jsonb_array_length(v_new) = 0 or r.status <> 'approved' then
    return r;
  end if;
  return public.revise_rule_card(r.id, r.title, r.summary, r.body, r.examples || v_new,
                                 r.severity, r.dimension);
end;
$$;

revoke execute on function public.rule_gcs(uuid, timestamptz) from public, anon;
grant execute on function public.rule_gcs(uuid, timestamptz) to authenticated, service_role;
revoke execute on function public.insights_summary(uuid, timestamptz) from public, anon;
grant execute on function public.insights_summary(uuid, timestamptz) to authenticated, service_role;
revoke execute on function public.flag_unclear_rules(uuid) from public, anon, authenticated;
grant execute on function public.flag_unclear_rules(uuid) to service_role;
revoke execute on function public.decide_example_suggestion(uuid, int[]) from public, anon;
grant execute on function public.decide_example_suggestion(uuid, int[]) to authenticated;

alter publication supabase_realtime add table public.example_suggestions;
