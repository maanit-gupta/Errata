-- R3, improvement 2: Clarity Score on real data.
-- 1. contents.simulated marks rows written by scripts/simulate_activity.py (was only a "[Simulated] "
--    title prefix). App users can't set or clear it; only direct DB sessions (simulator, worker) can.
-- 2. rule_gcs() and insights_summary() take p_include_simulated (default true keeps the demo flow).
-- 3. insights_summary.simulated is true only when simulated review runs are in the window and
--    included; simulated_versions says how many are there, so the UI can offer the filter.

alter table public.contents add column simulated boolean not null default false;

-- Backfill: the simulator has always titled its contents "[Simulated] …" (P13).
update public.contents set simulated = true where title like '[Simulated] %';

create index contents_simulated_idx on public.contents (org_id) where simulated;

create or replace function private.contents_simulated_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and new.simulated is distinct from (case when tg_op = 'UPDATE' then old.simulated else false end) then
    raise exception 'contents.simulated is set by the activity simulator only'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger contents_simulated_guard before insert or update of simulated on public.contents
  for each row execute function private.contents_simulated_guard();

-- Signatures change (new trailing parameter), so drop the old ones first. flag_unclear_rules()
-- calls rule_gcs(p_org) by name and keeps working through the default.
drop function public.rule_gcs(uuid, timestamptz);
drop function public.insights_summary(uuid, timestamptz);

create or replace function public.rule_gcs(
  p_org uuid,
  p_since timestamptz default now() - interval '90 days',
  p_include_simulated boolean default true
)
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
  sim as (  -- versions of simulated contents, only when they are excluded
    select v.id from public.versions v join public.contents c on c.id = v.content_id
    where c.org_id = p_org and c.simulated and not p_include_simulated
  ),
  f as (
    select f.* from public.findings f
    where f.org_id = p_org and f.rule_id is not null and f.status <> 'superseded'
      and f.created_at >= p_since and exists (select 1 from allowed)
      and not exists (select 1 from sim where sim.id = f.version_id)
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
      and not exists (select 1 from sim where sim.id = d.version_id)
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

create or replace function public.insights_summary(
  p_org uuid,
  p_since timestamptz default now() - interval '30 days',
  p_include_simulated boolean default true
)
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

  with sim_all as (  -- every version of a simulated content in this org
    select v.id from public.versions v join public.contents c on c.id = v.content_id
    where c.org_id = p_org and c.simulated
  ),
  sim as (select id from sim_all where not p_include_simulated),  -- the ones to leave out
  runs as (
    select distinct on (r.version_id) r.id, r.version_id
    from public.review_runs r
    where r.org_id = p_org and r.status = 'done' and r.created_at >= p_since
      and not exists (select 1 from sim where sim.id = r.version_id)
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
      and not exists (select 1 from sim where sim.id = d.version_id)
    order by v.content_id, d.created_at
  ),
  approval as (
    select extract(epoch from min(d.created_at) - min(v0.created_at)) / 86400.0 as days
    from public.decisions d
    join public.versions v on v.id = d.version_id
    join public.versions v0 on v0.content_id = v.content_id
    where d.org_id = p_org and d.action = 'approve' and d.created_at >= p_since
      and not exists (select 1 from sim where sim.id = d.version_id)
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
      and not exists (select 1 from sim where sim.id = f.version_id)
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
         and f.created_at >= now() - interval '7 days'
         and not exists (select 1 from sim where sim.id = f.version_id)),
    'top_issues', coalesce((select jsonb_agg(to_jsonb(i)) from issues i), '[]'::jsonb),
    -- R3: true only when simulated rows are in the window AND counted (was: any simulated audit
    -- event, which stayed true after the simulated contents were deleted).
    'simulated', p_include_simulated and exists (
      select 1 from public.review_runs r join sim_all on sim_all.id = r.version_id
      where r.org_id = p_org and r.created_at >= p_since),
    'simulated_versions', (
      select count(distinct r.version_id)::int from public.review_runs r
      join sim_all on sim_all.id = r.version_id
      where r.org_id = p_org and r.created_at >= p_since),
    'include_simulated', p_include_simulated
  ) into v;
  return v;
end;
$$;

revoke execute on function public.rule_gcs(uuid, timestamptz, boolean) from public, anon;
grant execute on function public.rule_gcs(uuid, timestamptz, boolean) to authenticated, service_role;
revoke execute on function public.insights_summary(uuid, timestamptz, boolean) from public, anon;
grant execute on function public.insights_summary(uuid, timestamptz, boolean) to authenticated, service_role;
