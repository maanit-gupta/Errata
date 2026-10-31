-- Round 3: MCP tokens. Brand admin only, hash-only storage, revocation that sticks, worker-only
-- resolution, and the fact filter the MCP server relies on (no expired, never-send or other-campaign
-- facts). Seed: ...0001 = brand admin, ...0002 = creator; campaign ...0001 = Diwali (active),
-- ...0002 = Navratri (ended; its fact E-11 expired on 2026-10-19).
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- A never-send fact and an expired fact on the Diwali campaign, so the filter has something to drop.
insert into public.facts (org_id, campaign_id, code, kind, statement, never_send)
values ('00000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-000000000001',
        'PGTAP-NS', 'other', 'internal only', true);
insert into public.facts (org_id, campaign_id, code, kind, statement, valid_until)
values ('00000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-000000000001',
        'PGTAP-OLD', 'other', 'expired fact', now() - interval '1 day');
insert into public.facts (org_id, campaign_id, code, kind, statement, valid_until)
values ('00000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-000000000001',
        'PGTAP-LIVE', 'other', 'live fact', now() + interval '1 day');

create temp table t (tok text, hash text, id uuid);
grant all on t to authenticated, service_role;

-- Brand admin ------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';

insert into t (tok) select public.create_mcp_token('00000000-0000-4000-8000-0000000000a1',
  '20000000-0000-4000-8000-000000000001', '  pgtap  ');

update t set id = (select id from public.mcp_tokens where label = 'pgtap');
select matches((select tok from t), '^ek_[0-9a-f]{48}$', 'token is ek_ + 48 hex characters');
select is((select label from public.mcp_tokens where label = 'pgtap'), 'pgtap',
  'admin sees the token row, label trimmed');
select throws_ok($$ select token_hash from public.mcp_tokens $$, '42501', null,
  'token_hash is not readable by app users');
select throws_ok(
  $$ select public.create_mcp_token('00000000-0000-4000-8000-0000000000a1', gen_random_uuid(), 'x') $$,
  '22023', null, 'a campaign outside the org is refused');
select throws_ok(
  $$ select public.create_mcp_token('00000000-0000-4000-8000-0000000000a1',
       '20000000-0000-4000-8000-000000000001', '   ') $$,
  '22023', null, 'a blank label is refused');
select throws_ok(
  $$ update public.mcp_tokens set revoked_at = null $$, '42501', null,
  'app users cannot update token rows directly');
select throws_ok($$ select * from public.resolve_mcp_token('x') $$, '42501', null,
  'authenticated users cannot call resolve_mcp_token');
select throws_ok(
  $$ select * from public.mcp_campaign_facts('00000000-0000-4000-8000-0000000000a1',
       '20000000-0000-4000-8000-000000000001') $$, '42501', null,
  'authenticated users cannot call mcp_campaign_facts');

-- Creator ----------------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.create_mcp_token('00000000-0000-4000-8000-0000000000a1',
       '20000000-0000-4000-8000-000000000001', 'nope') $$,
  '42501', null, 'a creator cannot create a token');
select is((select count(*)::int from public.mcp_tokens), 0, 'a creator cannot list tokens');
select throws_ok(
  format('select public.revoke_mcp_token(%L)', (select id from t)),
  '42501', null, 'a creator cannot revoke a token');

-- Worker (service role) --------------------------------------------------------------------------
reset role;
update t set hash = encode(extensions.digest(tok, 'sha256'), 'hex');
select is((select count(*)::int from public.mcp_tokens where token_hash = (select tok from t)), 0,
  'the plaintext token is not stored');
select is((select count(*)::int from public.mcp_tokens where token_hash = (select hash from t)), 1,
  'the SHA-256 hash is stored');

set local role service_role;
select is((select token_id from public.resolve_mcp_token((select hash from t))), (select id from t),
  'resolve returns the token id (for logs)');
select is(
  (select campaign_id from public.resolve_mcp_token((select hash from t))),
  '20000000-0000-4000-8000-000000000001'::uuid,
  'service role resolves a live token to its campaign');
select is((select count(*)::int from public.resolve_mcp_token(repeat('0', 64))), 0,
  'an unknown hash resolves to nothing');

create temp table diwali as select code from public.mcp_campaign_facts(
  '00000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-000000000001');
create temp table navratri as select code from public.mcp_campaign_facts(
  '00000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-000000000002');
select ok(exists (select 1 from diwali where code = 'PGTAP-LIVE')
          and exists (select 1 from diwali where code = 'F-048'),
  'campaign facts include live campaign facts and org-wide facts');
select ok(not exists (select 1 from diwali where code in ('PGTAP-OLD', 'PGTAP-NS')),
  'expired and never-send facts are excluded');
select ok(not exists (select 1 from navratri where code in ('PGTAP-LIVE', 'E-19', 'F-112', 'E-11')),
  'another campaign''s facts, and expired E-11, are excluded');
select ok(exists (select 1 from navratri where code = 'F-048'), 'org-wide facts reach every campaign');

-- Revoke (brand admin), then the worker can't resolve it ------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select ok(public.revoke_mcp_token((select id from public.mcp_tokens where label = 'pgtap')),
  'brand admin revokes the token');
select ok(not public.revoke_mcp_token((select id from public.mcp_tokens where label = 'pgtap')),
  'revoking twice is a no-op');

reset role;
set local role service_role;
select is((select count(*)::int from public.resolve_mcp_token((select hash from t))), 0,
  'a revoked token resolves to nothing');

reset role;
select is(
  (select count(*)::int from public.audit_events where event->>'type' = 'mcp_token'), 2,
  'create and revoke are audited');

select * from finish();
rollback;
