-- P13 insights: GCS (SPEC §11) on synthetic findings and decisions, the summary, UNCLEAR flagging
-- and example approval. Runs as postgres (no JWT) unless a role is set, like the worker.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Two synthetic tone rules: TV-98 (every finding dismissed → UNCLEAR) and TV-99 (mixed → watch),
-- and TV-97 with too few findings.
insert into public.rule_cards (id, org_id, code, dimension, title, summary, body, examples, severity, status, version)
values
  ('71000000-0000-4000-8000-000000000098', '00000000-0000-4000-8000-0000000000a1', 'TV-98', 'tone',
   'Ambiguous rule', 'S', 'Body', '[]', 'suggestion', 'approved', 1),
  ('71000000-0000-4000-8000-000000000099', '00000000-0000-4000-8000-0000000000a1', 'TV-99', 'tone',
   'Mixed rule', 'S', 'Body', '[{"kind":"do","text":"Old","source":"guide"}]', 'suggestion', 'approved', 1),
  ('71000000-0000-4000-8000-000000000097', '00000000-0000-4000-8000-0000000000a1', 'TV-97', 'tone',
   'Young rule', 'S', 'Body', '[]', 'suggestion', 'approved', 1);

insert into public.contents (id, org_id, campaign_id, owner_id, title, channel)
values ('72000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1',
        '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
        'GCS fixture', 'instagram_post');

-- 14 versions, one finished run each.
insert into public.versions (id, content_id, n, body, format, intent)
select ('73000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       '72000000-0000-4000-8000-000000000001', 0, 'copy ' || i, 'text', '{}'
from generate_series(1, 14) i;
insert into public.review_runs (id, org_id, version_id, status)
select ('74000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       '00000000-0000-4000-8000-0000000000a1',
       ('73000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'done'
from generate_series(1, 14) i;

-- TV-99: 12 findings on versions 1-12. 3 dismissed "doesn't apply", 1 dismissed "AI wrong" (not
-- counted), 2 low-confidence. Versions 1-4 reviewed; version 1 approved with its finding open.
insert into public.findings (org_id, version_id, run_id, dimension, rule_id, quote, span, severity,
                             confidence, source, explanation, status, dismiss_reason)
select '00000000-0000-4000-8000-0000000000a1',
       ('73000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       ('74000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       'tone', '71000000-0000-4000-8000-000000000099', 'quote ' || i, '{"start":0,"end":5}',
       case when i <= 6 then 'blocker' else 'suggestion' end::public.severity,
       case when i in (11, 12) then 0.5 else 0.9 end, 'llm', 'x',
       case when i = 1 then 'open' when i between 5 and 8 then 'dismissed' else 'accepted' end::public.finding_status,
       case when i between 5 and 7 then 'doesnt_apply' when i = 8 then 'ai_wrong' end::public.dismiss_reason
from generate_series(1, 12) i;
insert into public.decisions (org_id, version_id, actor_id, action, reason)
select '00000000-0000-4000-8000-0000000000a1',
       ('73000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       '10000000-0000-4000-8000-000000000004', 'approve', null
from generate_series(1, 4) i;
-- A reviewer blocks TV-99-clean version 13, citing TV-99.
insert into public.decisions (org_id, version_id, actor_id, action, reason)
values ('00000000-0000-4000-8000-0000000000a1', '73000000-0000-4000-8000-000000000013',
        '10000000-0000-4000-8000-000000000004', 'request_changes', 'This breaks TV-99.');

-- TV-98: 10 findings, all dismissed "doesn't apply". TV-97: 9 findings.
insert into public.findings (org_id, version_id, run_id, dimension, rule_id, quote, span, severity,
                             confidence, source, explanation, status, dismiss_reason)
select '00000000-0000-4000-8000-0000000000a1', '73000000-0000-4000-8000-000000000014',
       '74000000-0000-4000-8000-000000000014', 'tone', '71000000-0000-4000-8000-000000000098',
       'bet big ' || i, '{"start":0,"end":3}', 'suggestion', 0.9, 'llm', 'x', 'dismissed', 'doesnt_apply'
from generate_series(1, 10) i;
insert into public.findings (org_id, version_id, run_id, dimension, rule_id, quote, span, severity,
                             confidence, source, explanation, status)
select '00000000-0000-4000-8000-0000000000a1', '73000000-0000-4000-8000-000000000014',
       '74000000-0000-4000-8000-000000000014', 'tone', '71000000-0000-4000-8000-000000000097',
       'young ' || i, '{"start":0,"end":3}', 'suggestion', 0.9, 'llm', 'x', 'open'
from generate_series(1, 9) i;

-- DR 3/12, OR (1 approval with an open finding + 1 block) / (4 reviewed + 1 block), LCR 2/12:
-- 100 × (1 − (0.45·0.25 + 0.35·0.4 + 0.20·0.1667)) = 71.4 → 71, "watch".
select results_eq(
  $$ select n, gcs, status from public.rule_gcs('00000000-0000-4000-8000-0000000000a1') where code = 'TV-99' $$,
  $$ values (12, 71, 'watch') $$, 'TV-99 scores 71 (watch) from its dismissals, overrides and low confidence');
select results_eq(
  $$ select round(dismissal_rate::numeric, 3), round(override_rate::numeric, 3), round(low_confidence_rate::numeric, 3)
     from public.rule_gcs('00000000-0000-4000-8000-0000000000a1') where code = 'TV-99' $$,
  $$ values (0.250, 0.400, 0.167) $$, '"AI wrong" dismissals are detector error, not ambiguity');
select results_eq(
  $$ select gcs, status from public.rule_gcs('00000000-0000-4000-8000-0000000000a1') where code = 'TV-98' $$,
  $$ values (55, 'unclear') $$, 'all dismissed → GCS 55, UNCLEAR');
select results_eq(
  $$ select n, gcs, status from public.rule_gcs('00000000-0000-4000-8000-0000000000a1') where code = 'TV-97' $$,
  $$ values (9, null::int, 'insufficient') $$, 'under 10 findings → no score');
select is((select count(*)::int from public.rule_gcs('00000000-0000-4000-8000-0000000000a1')
           where card_status = 'approved' and n = 0 and status = 'insufficient' and code = 'A-01'), 1,
  'approved rules with no findings are listed as insufficient data');

-- Summary
select is((public.insights_summary('00000000-0000-4000-8000-0000000000a1') ->> 'blockers_this_week')::int, 6,
  'six blockers this week');
select is((public.insights_summary('00000000-0000-4000-8000-0000000000a1') -> 'top_issues' -> 0 ->> 'code'), 'TV-99',
  'TV-99 is the top recurring issue');
select is((public.insights_summary('00000000-0000-4000-8000-0000000000a1') ->> 'first_review_approval_pct')::int, 100,
  'one content, first decided by approve → 100%');
select is((public.insights_summary('00000000-0000-4000-8000-0000000000a1') ->> 'simulated')::boolean, false,
  'not simulated');
insert into public.audit_events (org_id, event)
values ('00000000-0000-4000-8000-0000000000a1', '{"type":"simulated_activity","simulated":true}');
select is((public.insights_summary('00000000-0000-4000-8000-0000000000a1') ->> 'simulated')::boolean, true,
  'a simulated audit event turns on the Illustrative data pill');

-- Access
set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.rule_gcs('00000000-0000-4000-8000-0000000000a1')), 0,
  'a creator gets no scores');
select throws_ok($$ select public.insights_summary('00000000-0000-4000-8000-0000000000a1') $$,
  '42501', null, 'a creator cannot read the summary');
select throws_ok($$ select * from public.flag_unclear_rules('00000000-0000-4000-8000-0000000000a1') $$,
  '42501', null, 'users cannot flag rules');
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}';
select cmp_ok((select count(*)::int from public.rule_gcs('00000000-0000-4000-8000-0000000000a1')), '>', 0,
  'a manager sees scores');
set local request.jwt.claims to '{}';
reset role;

-- Flagging: TV-98 only, once.
select results_eq($$ select code, gcs from public.flag_unclear_rules('00000000-0000-4000-8000-0000000000a1') $$,
  $$ values ('TV-98', 55) $$, 'the worker flags the UNCLEAR rule');
select is((select count(*)::int from public.flag_unclear_rules('00000000-0000-4000-8000-0000000000a1')), 0,
  'flagging is idempotent');
select is((select count(*)::int from pgmq.q_vault_jobs where message ->> 'job' = 'generate_examples'
           and message ->> 'rule_id' = '71000000-0000-4000-8000-000000000098'), 1,
  'one generate_examples job queued');

-- The job fills the suggestion; an admin keeps examples 0 and 2.
update public.example_suggestions
set examples = '[{"kind":"do","text":"A"},{"kind":"dont","text":"B"},{"kind":"dont","text":"C"}]'
where rule_id = '71000000-0000-4000-8000-000000000098';
set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$ select public.decide_example_suggestion(
    (select id from public.example_suggestions limit 1), '{0}') $$,
  'P0002', null, 'a manager cannot approve examples');
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select version, jsonb_array_length(examples), examples -> 1 ->> 'source'
     from public.decide_example_suggestion(
       (select id from public.example_suggestions where rule_id = '71000000-0000-4000-8000-000000000098'), '{0,2}') $$,
  $$ values (2, 2, 'generated') $$, 'approval appends the kept examples as version 2');
reset role;
select is((select status::text from public.example_suggestions where rule_id = '71000000-0000-4000-8000-000000000098'),
  'approved', 'the suggestion is approved and v1 keeps its history (archived)');

select * from finish();
rollback;
