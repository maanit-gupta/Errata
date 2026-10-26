-- State machine (SPEC §4): valid transitions succeed, invalid ones and wrong roles raise,
-- every transition is audited, direct state updates fail, enqueue_review queues a job.
begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

-- Fixtures (as postgres): three drafts owned by the creator in Diwali SIP.
insert into public.contents (id, org_id, campaign_id, owner_id, title, channel)
select x.id, '00000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-000000000001',
       '10000000-0000-4000-8000-000000000002', x.title, 'instagram_caption'
from (values
  ('40000000-0000-4000-8000-00000000000c'::uuid, 'Happy path'),
  ('40000000-0000-4000-8000-00000000000d'::uuid, 'Blocker path'),
  ('40000000-0000-4000-8000-00000000000e'::uuid, 'Legal path')
) as x (id, title);

-- ---------------------------------------------------------------------------------------------
-- Creator saves and submits C
set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';

insert into public.versions (id, content_id, body, format, intent)
values ('50000000-0000-4000-8000-00000000000c', '40000000-0000-4000-8000-00000000000c',
        'Start a SIP on PayWise this Diwali.', 'text',
        '{"goal":"webinar sign-ups","audience":"first-time investors","cta":"Register now","channel":"instagram_caption","campaign_id":"20000000-0000-4000-8000-000000000001"}');

select is((select n from public.versions where id = '50000000-0000-4000-8000-00000000000c'), 1,
          'first version is numbered 1');
select is((select current_version_id from public.contents where id = '40000000-0000-4000-8000-00000000000c'),
          '50000000-0000-4000-8000-00000000000c'::uuid, 'saving a version makes it current');

select throws_ok(
  $$ update public.contents set state = 'approved' where id = '40000000-0000-4000-8000-00000000000c' $$,
  '42501', 'contents.state can only change through transition_content()',
  'direct UPDATE of contents.state is rejected'
);
select throws_ok(
  $$ update public.contents set route_to = 'legal' where id = '40000000-0000-4000-8000-00000000000c' $$,
  '42501', null, 'direct UPDATE of routing columns is rejected'
);
select lives_ok(
  $$ update public.contents set title = 'Happy path (renamed)' where id = '40000000-0000-4000-8000-00000000000c' $$,
  'owner can still edit the title'
);
select throws_ok(
  $$ update public.versions set body = 'changed' where id = '50000000-0000-4000-8000-00000000000c' $$,
  '42501', null, 'users cannot UPDATE versions'
);
select throws_ok(
  $$ select public.transition_content('40000000-0000-4000-8000-00000000000c', 'approved') $$,
  '22023', null, 'draft -> approved is not a valid transition'
);
select throws_ok(
  $$ select public.transition_content('40000000-0000-4000-8000-00000000000c', 'ai_check') $$,
  '22023', 'submit with enqueue_review()', 'transition_content refuses ai_check'
);
select throws_ok(
  $$ select public.transition_content_system('40000000-0000-4000-8000-00000000000c', 'in_review') $$,
  '42501', null, 'users cannot call transition_content_system'
);

select isnt(
  set_config('test.run_c', public.enqueue_review('50000000-0000-4000-8000-00000000000c')::text, true),
  null, 'enqueue_review returns a run id'
);
select is((select state from public.contents where id = '40000000-0000-4000-8000-00000000000c'),
          'ai_check'::public.content_state, 'submitting moves the content to ai_check');
select is((select status from public.review_runs where id = current_setting('test.run_c')::uuid),
          'queued'::public.run_status, 'a queued review run exists');
select throws_ok(
  $$ select public.transition_content('40000000-0000-4000-8000-00000000000c', 'needs_revision') $$,
  '42501', null, 'only the worker moves content out of ai_check'
);

reset role;
select is(
  (select count(*)::int from pgmq.q_review_jobs
   where message ->> 'run_id' = current_setting('test.run_c')
     and message ->> 'version_id' = '50000000-0000-4000-8000-00000000000c'
     and message ->> 'org_id' = '00000000-0000-4000-8000-0000000000a1'),
  1, 'enqueue_review sends {run_id, version_id, org_id} to review_jobs'
);
select throws_ok(
  $$ update public.versions set body = 'changed' where id = '50000000-0000-4000-8000-00000000000c' $$,
  '23514', 'versions are immutable; save a new version instead', 'versions are immutable even for postgres'
);
select throws_ok(
  $$ delete from public.audit_events $$,
  '42501', 'audit_events is append-only', 'audit_events is append-only'
);

-- ---------------------------------------------------------------------------------------------
-- Worker (service role) finishes C's run with one open warning; route to the manager
set local role service_role;
update public.review_runs set status = 'done', finished_at = clock_timestamp()
where id = current_setting('test.run_c')::uuid;
insert into public.findings (id, org_id, version_id, run_id, dimension, rule_id, quote, span, severity,
                             confidence, source, explanation)
select '60000000-0000-4000-8000-00000000000c', r.org_id, r.version_id, r.id, 'terms',
       (select id from public.rule_cards where code = 'G-07'), 'PayWise', '{"start":13,"end":20}',
       'warning', 0.9, 'deterministic', 'test warning'
from public.review_runs r where r.id = current_setting('test.run_c')::uuid;

select is(
  (public.transition_content_system('40000000-0000-4000-8000-00000000000c', 'in_review', null, 'manager', 3)).state,
  'in_review'::public.content_state, 'system: ai_check -> in_review when no blockers are open'
);
reset role;

-- Creator can't approve; manager needs an override for the open warning first
set local role authenticated;
select throws_ok(
  $$ select public.transition_content('40000000-0000-4000-8000-00000000000c', 'approved') $$,
  '42501', null, 'creator cannot approve'
);
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok(
  $$ select public.transition_content('40000000-0000-4000-8000-00000000000c', 'approved') $$,
  '23514', null, 'approval is blocked while an open warning has no override'
);
select lives_ok(
  $$ insert into public.decisions (org_id, version_id, actor_id, action, finding_id, reason)
     values ('00000000-0000-4000-8000-0000000000a1', '50000000-0000-4000-8000-00000000000c',
             '10000000-0000-4000-8000-000000000004', 'override', '60000000-0000-4000-8000-00000000000c',
             'Brand name in a hashtag is fine') $$,
  'manager records an override with a reason'
);
select is(
  (public.transition_content('40000000-0000-4000-8000-00000000000c', 'approved')).state,
  'approved'::public.content_state, 'manager: in_review -> approved'
);
select is(
  (select count(*)::int from public.decisions
   where version_id = '50000000-0000-4000-8000-00000000000c' and action = 'approve'),
  1, 'approval writes an approve decision'
);

-- Agency can't even see C; the owner marks it ready
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok(
  $$ select public.transition_content('40000000-0000-4000-8000-00000000000c', 'publish_ready') $$,
  'P0002', null, 'agency cannot transition content it does not own'
);
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(
  (public.transition_content('40000000-0000-4000-8000-00000000000c', 'publish_ready')).state,
  'publish_ready'::public.content_state, 'owner: approved -> publish_ready'
);
reset role;

select is(
  (select array_agg(event ->> 'to' order by id) from public.audit_events
   where event ->> 'type' = 'transition' and event ->> 'content_id' = '40000000-0000-4000-8000-00000000000c'),
  array['ai_check', 'in_review', 'approved', 'publish_ready'],
  'every transition writes an audit event'
);
select is(
  (select actor_id from public.audit_events
   where event ->> 'content_id' = '40000000-0000-4000-8000-00000000000c' and event ->> 'to' = 'approved'),
  '10000000-0000-4000-8000-000000000004'::uuid, 'audit events record the actor'
);

-- ---------------------------------------------------------------------------------------------
-- Blocker path (D): needs_revision, resubmit blocked until the blocker is resolved
set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ insert into public.versions (content_id, body, format, intent, created_by)
     values ('40000000-0000-4000-8000-00000000000d', 'x', 'text', '{}', '10000000-0000-4000-8000-000000000004') $$,
  '42501', null, 'versions cannot be attributed to someone else'
);
insert into public.versions (id, content_id, body, format, intent)
values ('50000000-0000-4000-8000-00000000000d', '40000000-0000-4000-8000-00000000000d',
        'Lock in 14.2% assured returns.', 'text', '{"goal":"sign-ups"}');
select throws_ok(
  $$ select public.enqueue_review('50000000-0000-4000-8000-00000000000d') $$,
  '23514', 'intent is incomplete; missing: audience, campaign_id, channel, cta',
  'enqueue_review rejects incomplete intent'
);
reset role;
-- (as postgres) give D a complete intent via a new version
insert into public.versions (id, content_id, body, format, intent, created_by)
values ('50000000-0000-4000-8000-0000000000d2', '40000000-0000-4000-8000-00000000000d',
        'Lock in 14.2% assured returns.', 'text',
        '{"goal":"sign-ups","audience":"first-time investors","cta":"Register now","channel":"instagram_caption","campaign_id":"20000000-0000-4000-8000-000000000001"}',
        '10000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('test.run_d', public.enqueue_review('50000000-0000-4000-8000-0000000000d2')::text, true);
reset role;

set local role service_role;
update public.review_runs set status = 'done', finished_at = clock_timestamp()
where id = current_setting('test.run_d')::uuid;
insert into public.findings (id, org_id, version_id, run_id, dimension, rule_id, quote, span, severity,
                             confidence, source, explanation)
select '60000000-0000-4000-8000-00000000000d', r.org_id, r.version_id, r.id, 'claims',
       (select id from public.rule_cards where code = 'CL-03'), 'assured returns', '{"start":14,"end":29}',
       'blocker', 0.95, 'llm', 'test blocker'
from public.review_runs r where r.id = current_setting('test.run_d')::uuid;
select throws_ok(
  $$ select public.transition_content_system('40000000-0000-4000-8000-00000000000d', 'in_review') $$,
  '23514', null, 'system cannot enter review with an open blocker'
);
select is(
  (public.transition_content_system('40000000-0000-4000-8000-00000000000d', 'needs_revision')).state,
  'needs_revision'::public.content_state, 'system: ai_check -> needs_revision with an open blocker'
);
reset role;

set local role authenticated;
select throws_ok(
  $$ select public.enqueue_review('50000000-0000-4000-8000-0000000000d2') $$,
  '23514', null, 'resubmit is blocked while a blocker is open'
);
select throws_ok(
  $$ update public.findings set status = 'dismissed' where id = '60000000-0000-4000-8000-00000000000d' $$,
  '23514', null, 'dismissing requires a reason'
);
select throws_ok(
  $$ update public.findings set explanation = 'tampered' where id = '60000000-0000-4000-8000-00000000000d' $$,
  '42501', null, 'users cannot edit finding content'
);
update public.findings set status = 'dismissed', dismiss_reason = 'approved_exception', dismiss_note = 'legal ok'
where id = '60000000-0000-4000-8000-00000000000d';
select is(
  (select resolved_by from public.findings where id = '60000000-0000-4000-8000-00000000000d'),
  '10000000-0000-4000-8000-000000000002'::uuid, 'resolving a finding stamps resolved_by'
);
select isnt(
  public.enqueue_review('50000000-0000-4000-8000-0000000000d2'), null,
  'resubmit succeeds once every blocker is resolved'
);
reset role;
select is(
  (select count(*)::int from public.audit_events
   where event ->> 'type' = 'finding_status' and event ->> 'finding_id' = '60000000-0000-4000-8000-00000000000d'),
  1, 'finding status changes are audited'
);

-- ---------------------------------------------------------------------------------------------
-- Legal path (E): routed to legal goes straight to specialist_review
insert into public.versions (id, content_id, body, format, intent, created_by)
values ('50000000-0000-4000-8000-00000000000e', '40000000-0000-4000-8000-00000000000e',
        'Returns of 14.2% CAGR.', 'text',
        '{"goal":"sign-ups","audience":"first-time investors","cta":"Register now","channel":"instagram_caption","campaign_id":"20000000-0000-4000-8000-000000000001"}',
        '10000000-0000-4000-8000-000000000002');
set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
select set_config('test.run_e', public.enqueue_review('50000000-0000-4000-8000-00000000000e')::text, true);
reset role;
set local role service_role;
update public.review_runs set status = 'done', finished_at = clock_timestamp()
where id = current_setting('test.run_e')::uuid;
select is(
  (public.transition_content_system('40000000-0000-4000-8000-00000000000e', 'in_review', null, 'legal', 9)).state,
  'specialist_review'::public.content_state, 'route_to legal skips in_review and goes to specialist_review'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}';
select throws_ok(
  $$ select public.transition_content('40000000-0000-4000-8000-00000000000e', 'approved', 'looks fine') $$,
  '42501', null, 'the a11y specialist cannot sign off legal content'
);
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated"}';
select throws_ok(
  $$ select public.transition_content('40000000-0000-4000-8000-00000000000e', 'approved') $$,
  '23514', null, 'sign-off requires a reason'
);
select is(
  (public.transition_content('40000000-0000-4000-8000-00000000000e', 'approved', 'Historical, dated, disclaimer present')).state,
  'approved'::public.content_state, 'legal specialist signs off'
);
select is(
  (select action from public.decisions where version_id = '50000000-0000-4000-8000-00000000000e'),
  'sign_off'::public.decision_action, 'sign-off writes a sign_off decision'
);
reset role;

select * from finish();
rollback;
