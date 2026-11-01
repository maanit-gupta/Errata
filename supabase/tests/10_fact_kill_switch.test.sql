-- R3 Hero 2: content_fact_dependencies, publish manifests and the fact kill-switch.
-- PASS IF: editing a cited fact moves every affected approved/publish_ready item back to revision at
-- once; an expired fact does so within one sweep; unrelated items are untouched.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- Four contents owned by the creator (...0002) in the Diwali campaign:
--   A approved,      depends on F-048
--   B publish_ready, depends on E-19 (made publish_ready through the real transition)
--   C approved,      depends on F-112
--   D draft,         depends on F-048 (not approved: must stay put)
insert into public.contents (id, org_id, campaign_id, owner_id, title, channel)
select ('91000000-0000-4000-8000-00000000000' || n)::uuid, '00000000-0000-4000-8000-0000000000a1',
       '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
       'kill-switch ' || n, 'instagram_post'
from generate_series(1, 4) n;
insert into public.versions (id, content_id, n, body, format, intent)
select ('92000000-0000-4000-8000-00000000000' || n)::uuid,
       ('91000000-0000-4000-8000-00000000000' || n)::uuid, 0,
       E'  Join the  Diwali\tWealth Webinar\n on Oct 28 at 7 PM.  ', 'text', '{}'
from generate_series(1, 4) n;

insert into public.content_fact_dependencies (org_id, content_id, version_id, fact_id)
select '00000000-0000-4000-8000-0000000000a1', ('91000000-0000-4000-8000-00000000000' || x.n)::uuid,
       ('92000000-0000-4000-8000-00000000000' || x.n)::uuid, f.id
from (values (1, 'F-048'), (2, 'E-19'), (3, 'F-112'), (4, 'F-048')) as x(n, code)
join public.facts f on f.code = x.code and f.org_id = '00000000-0000-4000-8000-0000000000a1';

-- Test setup only: put A, B, C into approved (the real path needs a full review run).
select private.allow_workflow_write(true);
update public.contents set state = 'approved'
where id in ('91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002',
             '91000000-0000-4000-8000-000000000003');
select private.allow_workflow_write(false);
insert into public.decisions (org_id, version_id, actor_id, action, reason)
values ('00000000-0000-4000-8000-0000000000a1', '92000000-0000-4000-8000-000000000002',
        '10000000-0000-4000-8000-000000000004', 'approve', null);

-- B: approved -> publish_ready by its owner, through transition_content (issues the manifest).
set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ select public.transition_content('91000000-0000-4000-8000-000000000002', 'publish_ready') $$,
  'owner marks B publish-ready');
select is((select count(*)::int from public.content_fact_dependencies
           where content_id = '91000000-0000-4000-8000-000000000001'), 1,
  'the owner can read their content''s dependencies (RLS)');
select is((select count(*)::int from public.publish_manifests
           where version_id = '92000000-0000-4000-8000-000000000002'), 1,
  'the owner can read the manifest (RLS)');
select throws_ok(
  $$ select public.transition_content('91000000-0000-4000-8000-000000000001', 'needs_revision', 'x') $$,
  '42501', null, 'users cannot revoke an approval themselves (system only)');
select throws_ok($$ insert into public.content_fact_dependencies (org_id, content_id, version_id, fact_id)
                    select org_id, content_id, version_id, fact_id from public.content_fact_dependencies limit 1 $$,
  '42501', null, 'users cannot write dependencies');

set local request.jwt.claims to '{"sub":"99999999-0000-4000-8000-000000000009","role":"authenticated"}';
select is((select count(*)::int from public.content_fact_dependencies), 0,
  'a non-member sees no dependencies');
select is((select count(*)::int from public.publish_manifests), 0, 'a non-member sees no manifests');
reset role;

-- The manifest -----------------------------------------------------------------------------------
select is((select content_hash from public.publish_manifests where version_id = '92000000-0000-4000-8000-000000000002'),
  encode(extensions.digest('Join the Diwali Wealth Webinar on Oct 28 at 7 PM.', 'sha256'), 'hex'),
  'manifest hash = SHA-256 of the trimmed, whitespace-collapsed body');
select is((select manifest->'facts'->0->>'code' from public.publish_manifests
           where version_id = '92000000-0000-4000-8000-000000000002'), 'E-19',
  'the manifest lists the facts the copy relies on');
select is((select valid_until from public.publish_manifests where version_id = '92000000-0000-4000-8000-000000000002'),
  (select valid_until from public.facts where code = 'E-19'),
  'the manifest records the earliest fact expiry');

-- An edit that doesn't change meaning (embedding refresh) does nothing --------------------------
update public.facts set embedding = null where code = 'E-19';
select is((select state::text from public.contents where id = '91000000-0000-4000-8000-000000000002'),
  'publish_ready', 'an embedding-only update leaves dependants alone');

-- Editing a cited fact: A moves at once; D (draft) and C (other fact) are untouched -------------
update public.facts set value = value || '{"exit_load_pct": 0.5}'::jsonb where code = 'F-048';
select is((select state::text from public.contents where id = '91000000-0000-4000-8000-000000000001'),
  'needs_revision', 'editing F-048 moves approved A back to needs_revision at once');
select is((select state::text from public.contents where id = '91000000-0000-4000-8000-000000000004'),
  'draft', 'D (a draft depending on F-048) is untouched');
select is((select state::text from public.contents where id = '91000000-0000-4000-8000-000000000003'),
  'approved', 'C (depends on another fact) is untouched');
select ok(exists (select 1 from public.audit_events
                  where event->>'type' = 'transition' and event->>'content_id' = '91000000-0000-4000-8000-000000000001'
                    and event->>'to' = 'needs_revision' and (event->>'system')::boolean
                    and event->>'reason' like 'Fact F-048 changed%'),
  'the move went through apply_transition: audited, system, with a reason');
select is((select count(*)::int from public.audit_events
           where event->>'type' = 'fact_kill_switch' and event->>'fact_code' = 'F-048'), 1,
  'one kill-switch audit event for F-048');

-- Expiry with no UPDATE (the date simply passes): the sweep catches it ------------------------
alter table public.facts disable trigger facts_kill_switch_update;
update public.facts set valid_until = now() - interval '1 minute' where code = 'E-19';
alter table public.facts enable trigger facts_kill_switch_update;
select is((select state::text from public.contents where id = '91000000-0000-4000-8000-000000000002'),
  'publish_ready', 'before the sweep, B is still publish_ready');
set local role service_role;
select is(public.sweep_expired_fact_dependencies(), 1, 'one sweep moves the one affected item');
reset role;
select is((select state::text from public.contents where id = '91000000-0000-4000-8000-000000000002'),
  'needs_revision', 'B is back in revision after the sweep');
select ok((select revoked_at is not null and revoked_reason like 'Fact E-19 expired%'
           from public.publish_manifests where version_id = '92000000-0000-4000-8000-000000000002'),
  'B''s manifest is revoked with the reason');
set local role service_role;
select is(public.sweep_expired_fact_dependencies(), 0, 'the sweep is idempotent');
reset role;

-- Deleting a cited fact moves C ---------------------------------------------------------------
delete from public.facts where code = 'F-112';
select is((select state::text from public.contents where id = '91000000-0000-4000-8000-000000000003'),
  'needs_revision', 'deleting F-112 moves C back to revision');

select * from finish();
rollback;
