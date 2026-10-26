-- Structural invariants: RLS everywhere, queues exist, agencies can't see rule bodies.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select is(
  (select array_agg(c.relname::text order by c.relname)
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   join pg_attribute a on a.attrelid = c.oid and a.attname = 'org_id' and not a.attisdropped
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  null,
  'every public table with org_id has RLS enabled'
);

select is(
  (select array_agg(c.relname::text order by c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  null,
  'every public table has RLS enabled'
);

select cmp_ok(
  (select count(*)::int
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   join pg_attribute a on a.attrelid = c.oid and a.attname = 'org_id' and not a.attisdropped
   where n.nspname = 'public' and c.relkind = 'r'),
  '>=', 14,
  'org-scoped tables are all present'
);

select set_eq(
  $$ select queue_name::text from pgmq.list_queues() $$,
  array['review_jobs', 'vault_jobs'],
  'review_jobs and vault_jobs queues exist'
);

select hasnt_column('public', 'rule_cards_public', 'body', 'rule_cards_public exposes no body');
select hasnt_column('public', 'rule_cards_public', 'source_page', 'rule_cards_public exposes no source_page');

select * from finish();
rollback;
