-- embed_vault (P04): remember what text each embedding was computed from, so re-embedding only
-- touches rows whose content changed (e.g. examples appended, SPEC §11).
alter table public.rule_cards add column embedding_source_hash text;
alter table public.facts add column embedding_source_hash text;

-- Let the service role (seed_demo.py, the worker) enqueue vault jobs as well as brand admins.
create or replace function public.enqueue_vault_job(p_org uuid, p_job text, p_payload jsonb default '{}')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) is distinct from 'service_role'
     and not public.has_org_role(p_org, array['brand_admin']::public.member_role[]) then
    raise exception 'only a brand admin can run vault jobs' using errcode = 'insufficient_privilege';
  end if;
  if p_job not in ('ingest_guide', 'embed_vault', 'generate_examples') then
    raise exception 'unknown vault job %', p_job using errcode = 'invalid_parameter_value';
  end if;
  return pgmq.send(
    'vault_jobs',
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('job', p_job, 'org_id', p_org)
  );
end;
$$;
