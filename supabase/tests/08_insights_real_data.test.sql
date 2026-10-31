-- R3: Clarity Score on real data. contents.simulated splits simulator rows from real reviews;
-- rule_gcs / insights_summary can leave them out; the pill reflects rows in the window; app users
-- can't set the flag. Runs as postgres (no JWT) unless a role is set, like the worker.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into public.rule_cards (id, org_id, code, dimension, title, summary, body, examples, severity, status, version)
values ('81000000-0000-4000-8000-000000000096', '00000000-0000-4000-8000-0000000000a1', 'TV-96', 'tone',
        'Split rule', 'S', 'Body', '[]', 'suggestion', 'approved', 1);

-- Real content: 10 versions, each with an accepted TV-96 finding.
-- Simulated content: 20 versions, each with a TV-96 finding dismissed as "doesn't apply".
insert into public.contents (id, org_id, campaign_id, owner_id, title, channel, simulated)
values
  ('82000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1',
   '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
   'Real draft', 'instagram_post', false),
  ('82000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000a1',
   '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
   '[Simulated] history', 'instagram_post', true);

insert into public.versions (id, content_id, n, body, format, intent)
select ('83000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       case when i <= 10 then '82000000-0000-4000-8000-000000000001'
            else '82000000-0000-4000-8000-000000000002' end::uuid,
       0, 'copy ' || i, 'text', '{}'
from generate_series(1, 30) i;
insert into public.review_runs (id, org_id, version_id, status)
select ('84000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       '00000000-0000-4000-8000-0000000000a1',
       ('83000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'done'
from generate_series(1, 30) i;
insert into public.findings (org_id, version_id, run_id, dimension, rule_id, quote, span, severity,
                             confidence, source, explanation, status, dismiss_reason)
select '00000000-0000-4000-8000-0000000000a1',
       ('83000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       ('84000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       'tone', '81000000-0000-4000-8000-000000000096', 'quote ' || i, '{"start":0,"end":5}',
       'suggestion', 0.9, 'llm', 'x',
       case when i <= 10 then 'accepted' else 'dismissed' end::public.finding_status,
       case when i > 10 then 'doesnt_apply' end::public.dismiss_reason
from generate_series(1, 30) i;

-- GCS -----------------------------------------------------------------------------------------
select is((select n from public.rule_gcs('00000000-0000-4000-8000-0000000000a1') where code = 'TV-96'),
  30, 'by default rule_gcs counts simulated findings (demo flow unchanged)');
select is((select status from public.rule_gcs('00000000-0000-4000-8000-0000000000a1') where code = 'TV-96'),
  'watch', 'with simulated dismissals TV-96 is on watch (GCS 70)');
select is((select n from public.rule_gcs('00000000-0000-4000-8000-0000000000a1', now() - interval '90 days', false)
           where code = 'TV-96'),
  10, 'excluding simulated rows leaves the 10 real findings');
select is((select gcs from public.rule_gcs('00000000-0000-4000-8000-0000000000a1', now() - interval '90 days', false)
           where code = 'TV-96'),
  100, 'real-only GCS is 100 (nothing dismissed)');

-- Summary -------------------------------------------------------------------------------------
create temp table s as select
  public.insights_summary('00000000-0000-4000-8000-0000000000a1') as inc,
  public.insights_summary('00000000-0000-4000-8000-0000000000a1', now() - interval '30 days', false) as exc;
select is(((select inc from s) ->> 'simulated')::boolean, true,
  'simulated runs in the window and included → Illustrative data pill');
select is(((select exc from s) ->> 'simulated')::boolean, false,
  'simulated rows excluded → no pill');
select is(((select exc from s) ->> 'simulated_versions')::int, 20,
  'the summary still reports how many simulated versions are in the window');
select is(((select inc from s) ->> 'versions_checked')::int - ((select exc from s) ->> 'versions_checked')::int,
  20, 'versions_checked drops by exactly the simulated versions');
select is(((select exc from s) -> 'top_issues' -> 0 ->> 'n')::int, 10,
  'top issues count only real findings when excluded');

-- Guard ---------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ insert into public.contents (org_id, campaign_id, owner_id, title, channel, simulated)
     values ('00000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-000000000001',
             '10000000-0000-4000-8000-000000000002', 'sneaky', 'instagram_post', true) $$,
  '42501', null, 'a creator cannot insert a content marked simulated');
select throws_ok(
  $$ update public.contents set simulated = true where id = '82000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'a creator cannot mark their content simulated (hiding it from insights)');
select lives_ok(
  $$ insert into public.contents (org_id, campaign_id, owner_id, title, channel)
     values ('00000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-000000000001',
             '10000000-0000-4000-8000-000000000002', 'normal draft', 'instagram_post') $$,
  'normal inserts are unaffected');

select * from finish();
rollback;
