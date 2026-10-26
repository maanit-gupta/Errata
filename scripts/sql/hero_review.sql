-- Dev: create the SPEC §16 hero draft as the demo creator and submit it for review.
--   docker exec -i supabase_db_brandlens psql -U postgres < scripts/sql/hero_review.sql
-- (Separate statements: a CTE's inserted row isn't visible to RLS helpers in the same statement.)
begin;
select set_config('hero.content', gen_random_uuid()::text, true);
set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';

insert into public.contents (id, org_id, campaign_id, owner_id, title, channel)
values (current_setting('hero.content')::uuid, '00000000-0000-4000-8000-0000000000a1',
        '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
        'Diwali SIP launch (hero)', 'instagram_caption');

insert into public.versions (content_id, body, format, intent)
values (
  current_setting('hero.content')::uuid,
  'This Diwali, start a festive SIP on Paywise app with 0% exit load and lock in 14.2% assured annual returns — webinar registration closes Oct 18 at Hall B, Chandigarh!',
  'text',
  '{"goal":"webinar sign-ups","audience":"first-time investors","cta":"Register now","channel":"instagram_caption","campaign_id":"20000000-0000-4000-8000-000000000001"}'
);

select public.enqueue_review(
  (select current_version_id from public.contents where id = current_setting('hero.content')::uuid)
) as run_id;
commit;
