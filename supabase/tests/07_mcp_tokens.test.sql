-- MCP tokens: brand admin only, hash-only storage, revocation, worker-only resolution.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- brand admin of PayWise (see seed): 10000000-...-0001 is admin; ...-0002 is the creator.
set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';

create temp table t as
  select public.create_mcp_token('00000000-0000-4000-8000-0000000000a1',
    '20000000-0000-4000-8000-000000000001', 'pgtap') as tok;
grant all on t to authenticated;

select like((select tok from t), 'ek\_%', 'token has the ek_ prefix');
select is((select count(*)::int from public.mcp_tokens where label = 'pgtap'), 1, 'admin sees the token row');
select is(
  (select count(*)::int from public.mcp_tokens where token_hash = (select tok from t)), 0,
  'the plaintext token is not stored');

select throws_ok(
  $$ select * from public.resolve_mcp_token('x') $$, '42501', null,
  'authenticated users cannot call resolve_mcp_token');

set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.create_mcp_token('00000000-0000-4000-8000-0000000000a1',
       '20000000-0000-4000-8000-000000000001', 'nope') $$,
  '42501', null, 'a creator cannot create a token');
select is((select count(*)::int from public.mcp_tokens), 0, 'a creator cannot list tokens');

reset role;
select is(
  (select count(*)::int from public.resolve_mcp_token(
     encode(extensions.digest((select tok from t), 'sha256'), 'hex'))), 1,
  'service role resolves a live token to its scope');

select * from finish();
rollback;
