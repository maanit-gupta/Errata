-- RLS: members read their org, non-members read nothing, agencies see summaries and own content.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Fixtures (as postgres): an outsider in another org, plus one content per creator.
insert into auth.users (instance_id, id, aud, role, email)
values ('00000000-0000-0000-0000-000000000000', '90000000-0000-4000-8000-000000000001',
        'authenticated', 'authenticated', 'outsider@other.test');
insert into public.organisations (id, name) values ('90000000-0000-4000-8000-0000000000a2', 'Other Org');
insert into public.memberships (org_id, user_id, role)
values ('90000000-0000-4000-8000-0000000000a2', '90000000-0000-4000-8000-000000000001', 'brand_admin');
insert into public.rule_cards (org_id, code, dimension, title, summary, body, severity, status)
values ('90000000-0000-4000-8000-0000000000a2', 'TV-01', 'tone', 'Other', 'Other', 'Other body', 'warning', 'approved');

insert into public.contents (id, org_id, campaign_id, owner_id, title, channel)
values
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1',
   '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'Creator post', 'instagram_caption'),
  ('30000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000a1',
   '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Agency post', 'instagram_caption');

-- Creator (member, staff)
set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';

select is((select count(*)::int from public.rule_cards), 9, 'creator reads the 9 PayWise rule cards');
select is((select count(*)::int from public.rule_cards where org_id = '90000000-0000-4000-8000-0000000000a2'), 0,
          'creator reads no other-org rule cards');
select is((select count(*)::int from public.contents), 2, 'creator sees all org content');
select is((select count(*)::int from public.facts), 4, 'creator reads the 4 facts');
select is((select count(*)::int from public.assets), 3, 'creator reads the palette and 2 logo assets');
select throws_ok(
  $$ insert into public.rule_cards (org_id, code, dimension, title, summary, body, severity)
     values ('00000000-0000-4000-8000-0000000000a1', 'X-1', 'tone', 't', 's', 'b', 'warning') $$,
  '42501', null, 'creator cannot write rule cards'
);

-- Outsider (non-member)
set local request.jwt.claims to '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.rule_cards where org_id = '00000000-0000-4000-8000-0000000000a1'), 0,
          'non-member reads no PayWise rule cards');
select is((select count(*)::int from public.facts where org_id = '00000000-0000-4000-8000-0000000000a1'), 0,
          'non-member reads no PayWise facts');
select is((select count(*)::int from public.contents), 0, 'non-member reads no PayWise content');
select is((select count(*)::int from public.assets where org_id = '00000000-0000-4000-8000-0000000000a1'), 0,
          'non-member reads no PayWise assets');
select is((select array_agg(name) from public.organisations), array['Other Org'], 'non-member sees only their own org');
select is((select count(*)::int from public.rule_cards_public where org_id = '00000000-0000-4000-8000-0000000000a1'), 0,
          'non-member reads nothing through rule_cards_public');

-- Agency
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.rule_cards), 0, 'agency cannot read rule_cards (bodies)');
select is((select count(*)::int from public.rule_cards_public), 9, 'agency reads 9 rule summaries via rule_cards_public');
select is((select summary from public.rule_cards_public where code = 'CL-03'),
          'Never promise, guarantee or "assure" returns on mutual funds or other market-linked products.',
          'agency sees the CL-03 summary');
select is((select array_agg(title) from public.contents), array['Agency post'], 'agency sees only content it owns');
select is((select count(*)::int from public.brand_guides), 0, 'agency cannot read brand guides');

-- anon has no table access at all
reset role;
set local role anon;
select throws_ok($$ select * from public.rule_cards $$, '42501', null, 'anon cannot read rule_cards');
select throws_ok($$ select * from public.contents $$, '42501', null, 'anon cannot read contents');

reset role;
select * from finish();
rollback;
