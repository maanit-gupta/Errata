-- R3 Hero 2: deleting a fact from the Vault UI (lib/vault/actions.ts deleteFact), through RLS.
-- PASS IF: only brand admins can delete; deleting an uncited fact moves its approved dependants back
-- to revision (audited); a fact that a finding cites can't be deleted and the failed delete changes
-- nothing; retiring it (valid_until = now()) moves its dependants instead.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- Contents owned by the creator (...0002) in the Diwali campaign:
--   A approved, depends on F-048 (no finding cites F-048)
--   B approved, depends on E-19, and a finding on B cites E-19
--   D draft,    depends on F-048 (not approved: must stay put)
insert into public.contents (id, org_id, campaign_id, owner_id, title, channel)
select ('93000000-0000-4000-8000-00000000000' || n)::uuid, '00000000-0000-4000-8000-0000000000a1',
       '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
       'fact delete ' || n, 'instagram_post'
from generate_series(1, 3) n;
insert into public.versions (id, content_id, n, body, format, intent)
select ('94000000-0000-4000-8000-00000000000' || n)::uuid,
       ('93000000-0000-4000-8000-00000000000' || n)::uuid, 0,
       'Exit load is 1% within 365 days. Webinar Oct 28, 7 PM.', 'text', '{}'
from generate_series(1, 3) n;

insert into public.content_fact_dependencies (org_id, content_id, version_id, fact_id)
select '00000000-0000-4000-8000-0000000000a1', ('93000000-0000-4000-8000-00000000000' || x.n)::uuid,
       ('94000000-0000-4000-8000-00000000000' || x.n)::uuid, f.id
from (values (1, 'F-048'), (2, 'E-19'), (3, 'F-048')) as x(n, code)
join public.facts f on f.code = x.code and f.org_id = '00000000-0000-4000-8000-0000000000a1';

insert into public.review_runs (id, org_id, version_id, status)
values ('95000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000a1',
        '94000000-0000-4000-8000-000000000002', 'done');
insert into public.findings (org_id, version_id, run_id, dimension, fact_id, quote, span, severity,
                             confidence, source, explanation)
select '00000000-0000-4000-8000-0000000000a1', '94000000-0000-4000-8000-000000000002',
       '95000000-0000-4000-8000-000000000002', 'facts', f.id, 'Oct 28', '{"start":42,"end":48}',
       'warning', 1, 'deterministic', 'test'
from public.facts f where f.code = 'E-19';

-- Test setup only: A and B approved (the real path needs a full review run).
select private.allow_workflow_write(true);
update public.contents set current_version_id = ('94000000' || substr(id::text, 9))::uuid
where id::text like '93000000-%';
update public.contents set state = 'approved'
where id in ('93000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000002');
select private.allow_workflow_write(false);

set local role authenticated;

-- A creator can't delete facts: RLS matches no rows.
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
delete from public.facts where code = 'F-048';
reset role;
select is((select count(*)::int from public.facts where code = 'F-048'), 1,
  'a creator cannot delete a fact');

-- The brand admin deletes uncited F-048.
set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$ delete from public.facts where code = 'F-048' $$,
  'a brand admin deletes an uncited fact');
reset role;
select is((select count(*)::int from public.facts where code = 'F-048'), 0, 'F-048 is gone');
select is((select state::text from public.contents where id = '93000000-0000-4000-8000-000000000001'),
  'needs_revision', 'its approved dependant goes back to revision');
select is((select state::text from public.contents where id = '93000000-0000-4000-8000-000000000003'),
  'draft', 'a draft dependant is untouched');
select ok(exists (select 1 from public.audit_events
                  where event->>'type' = 'fact_kill_switch' and event->>'fact_code' = 'F-048'
                    and event->>'cause' = 'was deleted'
                    and event->>'content_id' = '93000000-0000-4000-8000-000000000001'),
  'the move is audited with the cause');

-- E-19 is cited by a finding: the delete fails as a whole (trigger moves included).
set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$ delete from public.facts where code = 'E-19' $$, '23503', null,
  'a cited fact cannot be deleted (the finding keeps its citation)');
reset role;
select is((select state::text from public.contents where id = '93000000-0000-4000-8000-000000000002'),
  'approved', 'the failed delete changed nothing');

-- What deleteFact does next: retire it. Expiring now fires the same kill-switch.
set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$ update public.facts set valid_until = now() where code = 'E-19' $$,
  'the brand admin retires the cited fact');
reset role;
select is((select state::text from public.contents where id = '93000000-0000-4000-8000-000000000002'),
  'needs_revision', 'retiring it sends its approved dependant back to revision');

select * from finish();
rollback;
