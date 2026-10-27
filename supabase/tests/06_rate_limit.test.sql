-- P15: enqueue_review() allows 10 submissions per minute per user (private.hit_rate_limit).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}';

select lives_ok(
  $$ select private.hit_rate_limit('t', 10, interval '1 minute') from generate_series(1, 10) $$,
  'ten hits inside the window pass'
);
select throws_ok(
  $$ select private.hit_rate_limit('t', 10, interval '1 minute') $$,
  'BL429', null, 'the eleventh hit raises BL429'
);
select is(
  (select n from private.rate_counters
   where user_id = '10000000-0000-4000-8000-000000000004' and bucket = 't'),
  10, 'a refused hit is not counted'
);

update private.rate_counters set window_start = now() - interval '61 seconds'
where user_id = '10000000-0000-4000-8000-000000000004' and bucket = 't';
select lives_ok(
  $$ select private.hit_rate_limit('t', 10, interval '1 minute') $$,
  'the window resets after a minute'
);

-- enqueue_review counts against the 'submit' bucket before anything else.
insert into private.rate_counters (user_id, bucket, window_start, n)
values ('10000000-0000-4000-8000-000000000002', 'submit', now(), 10);
set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.enqueue_review(gen_random_uuid()) $$,
  'BL429', null, 'enqueue_review refuses the eleventh submission in a minute'
);
select throws_ok(
  $$ select private.hit_rate_limit('submit', 1000, interval '1 minute') $$,
  '42501', null, 'clients cannot call the rate-limit helper directly'
);

select * from finish();
rollback;
