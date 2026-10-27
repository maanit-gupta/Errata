-- P15: rate-limit review submissions to 10 per minute per user, enforced in enqueue_review() so
-- every caller (server action, script, direct RPC) is covered. A fixed one-minute window per user
-- in a private table; the web maps SQLSTATE BL429 to a friendly message.
create table private.rate_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  n int not null,
  primary key (user_id, bucket)
);

-- Count one hit for (auth.uid(), p_bucket) and raise BL429 once the window holds more than p_max.
create or replace function private.hit_rate_limit(p_bucket text, p_max int, p_window interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  insert into private.rate_counters as r (user_id, bucket, window_start, n)
  values ((select auth.uid()), p_bucket, now(), 1)
  on conflict (user_id, bucket) do update
    set n = case when r.window_start <= now() - p_window then 1 else r.n + 1 end,
        window_start = case when r.window_start <= now() - p_window then now() else r.window_start end
  returning n into v_n;
  if v_n > p_max then
    raise exception 'rate limit: at most % % per %', p_max, p_bucket, p_window using errcode = 'BL429';
  end if;
end;
$$;

revoke all on function private.hit_rate_limit(text, int, interval) from public, anon, authenticated;

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

  perform private.hit_rate_limit('submit', 10, interval '1 minute');

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

revoke execute on function public.enqueue_review(uuid) from public, anon;
grant execute on function public.enqueue_review(uuid) to authenticated;
