-- Retrieval scoping: approved only, campaign or org-wide facts, unexpired, never_send excluded.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- Same embedding everywhere so every in-scope row ties on similarity.
update public.rule_cards set embedding = array_fill(0.1::real, array[384])::extensions.vector;
update public.facts set embedding = array_fill(0.1::real, array[384])::extensions.vector;
update public.rule_cards set never_send = true where code = 'VS-02';
update public.rule_cards set status = 'draft' where code = 'A-01';

select set_eq(
  $$ select code from public.match_vault('00000000-0000-4000-8000-0000000000a1',
       '20000000-0000-4000-8000-000000000001', array_fill(0.1::real, array[384])::extensions.vector, 50) $$,
  array['TV-02', 'TV-04', 'CL-03', 'G-07', 'F-048', 'F-112', 'E-19'],
  'Diwali retrieval: approved, sendable rules + org-wide and Diwali facts; no Navratri bleed'
);
select set_eq(
  $$ select code from public.match_vault('00000000-0000-4000-8000-0000000000a1',
       '20000000-0000-4000-8000-000000000001', array_fill(0.1::real, array[384])::extensions.vector, 50,
       array['claims', 'facts']::public.dimension[]) $$,
  array['CL-03', 'F-048', 'F-112', 'E-19'],
  'dimension filter limits rules; facts count as the facts dimension'
);
select is(
  (select count(*)::int from public.match_vault('00000000-0000-4000-8000-0000000000a1',
     '20000000-0000-4000-8000-000000000001', array_fill(0.1::real, array[384])::extensions.vector, 3)),
  3, 'p_k caps the result'
);
select is(
  (select round(similarity::numeric, 4) from public.match_vault('00000000-0000-4000-8000-0000000000a1',
     null, array_fill(0.1::real, array[384])::extensions.vector, 1)),
  1.0000, 'similarity is cosine similarity'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select * from public.match_vault('00000000-0000-4000-8000-0000000000a1', null,
       array_fill(0.1::real, array[384])::extensions.vector, 5) $$,
  '42501', null, 'match_vault is service-role only'
);
reset role;

select * from finish();
rollback;
