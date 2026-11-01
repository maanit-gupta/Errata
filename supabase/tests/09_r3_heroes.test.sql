-- R3 extras (Heroes 2-5). Hero 3: findings.visual_fix is written by the worker only; users can
-- accept a finding (status) but can't write or change the suggested colours.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select has_column('public', 'findings', 'visual_fix', 'findings.visual_fix exists (Hero 3)');
select col_has_check('public', 'findings', 'visual_fix', 'visual_fix must be a JSON object');

set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$ update public.findings set visual_fix = '{}'::jsonb $$, '42501', null,
  'app users cannot write visual_fix');

select * from finish();
rollback;
