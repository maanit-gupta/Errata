-- Vault admin RPCs: approve archives the previous version; revise bumps versions; non-admins can't.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into public.rule_cards (id, org_id, code, dimension, title, summary, body, severity, status, version)
values ('70000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1', 'CL-03', 'claims',
        'Proposed', 'Proposed summary', 'Proposed body', 'blocker', 'draft', 2);

set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$ select public.approve_rule_card('70000000-0000-4000-8000-000000000001') $$,
  'P0002', null, 'a creator cannot approve rule cards');
update public.rule_cards set status = 'approved' where id = '70000000-0000-4000-8000-000000000001';
reset role;
select is((select status from public.rule_cards where id = '70000000-0000-4000-8000-000000000001'),
  'draft'::public.rule_status, 'a creator''s direct UPDATE changes nothing (RLS)');
set local role authenticated;

set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((public.approve_rule_card('70000000-0000-4000-8000-000000000001')).status,
  'approved'::public.rule_status, 'admin approves the v2 draft');
select is((select status from public.rule_cards where code = 'CL-03' and version = 1),
  'archived'::public.rule_status, 'the previous approved version is archived');
select is((select count(*)::int from public.rule_cards where code = 'CL-03' and status = 'approved'), 1,
  'exactly one approved CL-03');

select is(
  (public.revise_rule_card('70000000-0000-4000-8000-000000000001', 'Edited', 'S', 'B', '[]', 'blocker', 'claims')).version,
  3, 'editing an approved card creates version 3');
select is((select status from public.rule_cards where id = '70000000-0000-4000-8000-000000000001'),
  'archived'::public.rule_status, 'and archives version 2');
select throws_ok(
  $$ select public.revise_rule_card('70000000-0000-4000-8000-000000000001', ' ', 'S', 'B', '[]', 'blocker', 'claims') $$,
  '23514', null, 'title is required');
reset role;

select cmp_ok((select count(*)::int from pgmq.q_vault_jobs where message ->> 'job' = 'embed_vault'), '>=', 2,
  'approve and revise queue embed_vault');

select * from finish();
rollback;
