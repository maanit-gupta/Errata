-- R3 MCP keys: per-user, hash-only, revocation that sticks, expiry, the CURRENT membership role,
-- worker-only resolution, and the fact filter the MCP server relies on (no expired, never-send or
-- other-campaign facts). Seed: ...0001 brand admin, ...0002 creator, ...0003 agency creator.
-- Campaign ...0001 = Diwali (active), ...0002 = Navratri (ended; its fact E-11 expired 2026-10-19).
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

insert into public.facts (org_id, campaign_id, code, kind, statement, never_send)
values ('00000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-000000000001',
        'PGTAP-NS', 'other', 'internal only', true);
insert into public.facts (org_id, campaign_id, code, kind, statement, valid_until)
values ('00000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-000000000001',
        'PGTAP-OLD', 'other', 'expired fact', now() - interval '1 day'),
       ('00000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-000000000001',
        'PGTAP-LIVE', 'other', 'live fact', now() + interval '1 day');

create temp table k (who text, id uuid, raw text, hash text);
grant all on k to authenticated, service_role;

-- Creator creates a key ------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
insert into k (who, id, raw)
  select 'creator', c.id, c.raw_key
  from public.create_mcp_key('00000000-0000-4000-8000-0000000000a1', '  Cursor  ', 30) c;

select matches((select raw from k where who = 'creator'), '^bl_mcp_[0-9a-f]{48}$',
  'key is bl_mcp_ + 48 hex characters');
select is((select key_prefix from public.mcp_api_keys where id = (select id from k where who = 'creator')),
  left((select raw from k where who = 'creator'), 11), 'the stored prefix is the key''s first 11 characters');
select is((select name from public.mcp_api_keys where id = (select id from k where who = 'creator')),
  'Cursor', 'the owner sees their key, name trimmed');
select ok((select expires_at between now() + interval '29 days' and now() + interval '31 days'
           from public.mcp_api_keys where id = (select id from k where who = 'creator')),
  'expiry is set from the requested days');
select throws_ok($$ select key_hash from public.mcp_api_keys $$, '42501', null,
  'key_hash is not readable by app users');
select throws_ok(
  $$ select * from public.create_mcp_key('00000000-0000-4000-8000-0000000000a1', 'x', 400) $$,
  '22023', null, 'expiry over 365 days is refused');
select throws_ok(
  $$ select * from public.create_mcp_key('00000000-0000-4000-8000-0000000000a1', '   ', 30) $$,
  '22023', null, 'a blank name is refused');
select throws_ok(
  $$ select * from public.create_mcp_key(gen_random_uuid(), 'x', 30) $$,
  '42501', null, 'a key for an org you are not in is refused');
select throws_ok($$ update public.mcp_api_keys set revoked_at = null $$, '42501', null,
  'app users cannot update key rows directly');
select throws_ok($$ insert into public.mcp_api_keys (org_id, user_id, key_prefix, key_hash, expires_at)
                    values ('00000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000002',
                            'bl_mcp_abcd', repeat('a', 64), now() + interval '1 day') $$,
  '42501', null, 'app users cannot insert key rows directly');
select throws_ok($$ select * from public.resolve_mcp_key('x') $$, '42501', null,
  'authenticated users cannot call resolve_mcp_key');
select throws_ok(
  $$ select * from public.mcp_campaign_facts('00000000-0000-4000-8000-0000000000a1',
       '20000000-0000-4000-8000-000000000001') $$, '42501', null,
  'authenticated users cannot call mcp_campaign_facts');

-- Agency creator: own key, can't see or revoke the creator's ---------------------------------
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';
insert into k (who, id, raw)
  select 'agency', c.id, c.raw_key
  from public.create_mcp_key('00000000-0000-4000-8000-0000000000a1', 'Agency laptop', 90) c;
select is((select count(*)::int from public.mcp_api_keys), 1, 'an agency creator sees only their own key');
select throws_ok(format('select public.revoke_mcp_key(%L)', (select id from k where who = 'creator')),
  '42501', null, 'another member cannot revoke your key');

-- Brand admin sees every key in the org -----------------------------------------------------
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.mcp_api_keys), 2, 'a brand admin sees every key in the org');

-- Worker (service role) -----------------------------------------------------------------------
reset role;
update k set hash = encode(extensions.digest(raw, 'sha256'), 'hex');
select is((select count(*)::int from public.mcp_api_keys where key_hash = (select hash from k where who = 'creator')),
  1, 'only the SHA-256 hash is stored');

set local role service_role;
select is((select role::text from public.resolve_mcp_key((select hash from k where who = 'creator'))),
  'creator', 'a live key resolves to its user''s role');
select is((select role::text from public.resolve_mcp_key((select hash from k where who = 'agency'))),
  'agency_creator', 'an agency key resolves as agency_creator');
select is((select count(*)::int from public.resolve_mcp_key(repeat('0', 64))), 0,
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

-- A demoted or removed member's key follows the membership -----------------------------------
reset role;
update public.memberships set role = 'agency_creator'
where user_id = '10000000-0000-4000-8000-000000000002' and org_id = '00000000-0000-4000-8000-0000000000a1';
set local role service_role;
select is((select role::text from public.resolve_mcp_key((select hash from k where who = 'creator'))),
  'agency_creator', 'the role comes from the current membership, not the key');

-- Expiry ------------------------------------------------------------------------------------------
reset role;
update public.mcp_api_keys set expires_at = now() - interval '1 second' where id = (select id from k where who = 'agency');
set local role service_role;
select is((select count(*)::int from public.resolve_mcp_key((select hash from k where who = 'agency'))), 0,
  'an expired key resolves to nothing');

-- Revoke: the owner revokes; it sticks --------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
select ok(public.revoke_mcp_key((select id from k where who = 'creator')), 'the owner revokes their key');
select ok(not public.revoke_mcp_key((select id from k where who = 'creator')), 'revoking twice is a no-op');
reset role;
set local role service_role;
select is((select count(*)::int from public.resolve_mcp_key((select hash from k where who = 'creator'))), 0,
  'a revoked key resolves to nothing');

reset role;
select is((select count(*)::int from public.audit_events where event->>'type' = 'mcp_key'), 3,
  'two creates and one revoke are audited');
select ok(not exists (select 1 from public.audit_events
                      where event::text like '%' || (select raw from k where who = 'creator') || '%'),
  'the plaintext key never reaches the audit log');

select * from finish();
rollback;
