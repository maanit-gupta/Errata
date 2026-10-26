-- Job queues and the submit entry point. The web never touches pgmq directly.
select pgmq.create('review_jobs');
select pgmq.create('vault_jobs');

-- SPEC §3: check the caller may submit, create a queued run, move the content to ai_check and
-- send {"run_id","version_id","org_id"} to review_jobs. Returns the run id.
create or replace function public.enqueue_review(p_version_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.versions;
  c public.contents;
  v_missing text[];
  v_run uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  select * into v from public.versions where id = p_version_id;
  if not found or not public.can_read_content(v.content_id) then
    raise exception 'version % not found', p_version_id using errcode = 'no_data_found';
  end if;
  select * into c from public.contents where id = v.content_id for update;

  if c.current_version_id is distinct from v.id then
    raise exception 'only the latest version can be submitted' using errcode = 'check_violation';
  end if;

  -- SPEC §5: intent must be complete and match the content's campaign.
  select array_agg(k order by k) into v_missing
  from unnest(array['goal', 'audience', 'cta', 'channel', 'campaign_id']) as k
  where coalesce(btrim(v.intent ->> k), '') = '';
  if v_missing is not null then
    raise exception 'intent is incomplete; missing: %', array_to_string(v_missing, ', ')
      using errcode = 'check_violation';
  end if;
  if v.intent ->> 'campaign_id' is distinct from c.campaign_id::text then
    raise exception 'intent campaign_id must match the content''s campaign' using errcode = 'check_violation';
  end if;

  insert into public.review_runs (org_id, version_id, status)
  values (c.org_id, v.id, 'queued')
  returning id into v_run;

  -- validates owner/role and, from needs_revision, that every blocker is resolved
  perform private.apply_transition(c.id, 'ai_check', null, (select auth.uid()), false);

  perform pgmq.send(
    'review_jobs',
    jsonb_build_object('run_id', v_run, 'version_id', v.id, 'org_id', c.org_id)
  );
  return v_run;
end;
$$;

-- Vault jobs (guide ingestion, embedding, example generation), brand admins only.
create or replace function public.enqueue_vault_job(p_org uuid, p_job text, p_payload jsonb default '{}')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_org_role(p_org, array['brand_admin']::public.member_role[]) then
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

revoke execute on function public.enqueue_review(uuid) from public, anon;
grant execute on function public.enqueue_review(uuid) to authenticated;
revoke execute on function public.enqueue_vault_job(uuid, text, jsonb) from public, anon;
grant execute on function public.enqueue_vault_job(uuid, text, jsonb) to authenticated, service_role;
