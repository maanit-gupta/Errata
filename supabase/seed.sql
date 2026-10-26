-- PayWise demo data (SPEC §16). LOCAL ONLY: `make db-reset` loads it. For a cloud project use
-- `make seed-demo`, which loads the same data from scripts/demo_data.py via the admin API.
-- All fictional. Demo password for every user: PayWise-demo-2026 (README "Demo accounts").
-- Keep IDs and codes in sync with scripts/demo_data.py (a worker test checks this).

-- Users ----------------------------------------------------------------------------------------
with demo_users (id, email, display_name) as (
  values
    ('10000000-0000-4000-8000-000000000001'::uuid, 'admin@paywise.demo',   'Asha (Brand admin)'),
    ('10000000-0000-4000-8000-000000000002'::uuid, 'creator@paywise.demo', 'Rohan (Creator)'),
    ('10000000-0000-4000-8000-000000000003'::uuid, 'agency@paywise.demo',  'Kiran (Agency)'),
    ('10000000-0000-4000-8000-000000000004'::uuid, 'manager@paywise.demo', 'Meera (Manager)'),
    ('10000000-0000-4000-8000-000000000005'::uuid, 'legal@paywise.demo',   'Dev (Legal)'),
    ('10000000-0000-4000-8000-000000000006'::uuid, 'a11y@paywise.demo',    'Noor (Accessibility)')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('PayWise-demo-2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', u.display_name),
  now(), now(), '', '', '', '', '', '', '', ''
from demo_users u
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now(), now()
from auth.users u
where u.email like '%@paywise.demo'
on conflict (provider_id, provider) do nothing;

-- Org, campaigns, memberships ------------------------------------------------------------------
insert into public.organisations (id, name, settings)
values ('00000000-0000-4000-8000-0000000000a1', 'PayWise', '{"locale":"en-IN","tz":"Asia/Kolkata"}')
on conflict (id) do nothing;

insert into public.campaigns (id, org_id, name, starts_on, ends_on, status)
values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1',
   'Diwali SIP 2026', '2026-10-10', '2026-11-15', 'active'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000a1',
   'Navratri Savings 2026', '2026-09-22', '2026-10-19', 'ended')
on conflict (id) do nothing;

insert into public.memberships (org_id, user_id, role, specialist_kind)
values
  ('00000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000001', 'brand_admin', null),
  ('00000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000002', 'creator', null),
  ('00000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000003', 'agency_creator', null),
  ('00000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000004', 'manager', null),
  ('00000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000005', 'specialist', 'legal'),
  ('00000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000006', 'specialist', 'a11y')
on conflict (org_id, user_id) do nothing;

-- Glossary -------------------------------------------------------------------------------------
insert into public.glossary_terms (org_id, code, preferred, variants, banned, case_sensitive, note)
values
  ('00000000-0000-4000-8000-0000000000a1', 'G-07', 'PayWise',
   array['Paywise', 'paywise', 'PAYWISE', 'Pay Wise', 'Paywise app', 'PayWise app'],
   false, true, 'Always camel-cased "PayWise". Never "Paywise app": PayWise is the brand, not just an app.')
on conflict (org_id, code) do nothing;

-- Facts (no embeddings yet; P04 fills them) ---------------------------------------------------
insert into public.facts (org_id, campaign_id, code, kind, statement, value, required_disclaimer, valid_until)
values
  ('00000000-0000-4000-8000-0000000000a1', null, 'F-048', 'fee',
   '1% exit load on redemptions within 365 days',
   '{"exit_load_pct": 1, "window_days": 365}', null, null),
  ('00000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-000000000001', 'F-112', 'rate',
   'Flexi-Cap 3-yr historical CAGR is 14.2% as of Q3 2026',
   '{"scheme": "Flexi-Cap", "cagr_3y_pct": 14.2, "as_of": "Q3 2026", "historical": true}',
   'Mutual Fund investments are subject to market risks, read all scheme related documents carefully.',
   '2026-12-31T23:59:59+05:30'),
  ('00000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-000000000001', 'E-19', 'event',
   'Diwali Wealth Webinar: online only, Oct 28, 7:00 PM IST',
   '{"name": "Diwali Wealth Webinar", "date": "2026-10-28", "time": "19:00", "tz": "Asia/Kolkata", "venue": "online"}',
   null, '2026-11-15T23:59:59+05:30'),
  ('00000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-000000000002', 'E-11', 'event',
   'Navratri Investor Meet: Oct 18, Hall B, Chandigarh',
   '{"name": "Navratri Investor Meet", "date": "2026-10-18", "venue": "Hall B, Chandigarh"}',
   null, '2026-10-19T00:00:00+05:30')
on conflict (org_id, code) do nothing;

-- Rule cards (approved) ------------------------------------------------------------------------
insert into public.rule_cards (org_id, code, dimension, title, summary, body, examples, severity, status, source_page)
values
  ('00000000-0000-4000-8000-0000000000a1', 'TV-02', 'tone',
   'Warm, plain-spoken, confident; no hype',
   'Sound like a knowledgeable friend: warm and clear, never breathless or salesy.',
   'PayWise copy is warm, plain-spoken and confident. Use everyday words and short sentences. '
   'Avoid hype: no superlatives like "best ever", "unbeatable" or "skyrocket", no stacked '
   'exclamation marks, and no urgency we cannot back up. Confidence comes from facts, not volume.',
   '[{"kind":"do","text":"Start a SIP in two minutes and see exactly what you pay.","source":"guide"},
     {"kind":"dont","text":"The BEST investment app EVER!!! Your money will skyrocket!","source":"guide"}]',
   'warning', 'approved', 4),
  ('00000000-0000-4000-8000-0000000000a1', 'TV-04', 'tone',
   'Playful, not flippant',
   'A light touch is welcome, but never joke about money, losses or risk.',
   'Festive and playful language is welcome where it fits the moment. Do not be flippant about '
   'money: no jokes about losing savings, gambling metaphors, or treating investing as a game.',
   '[]',
   'suggestion', 'approved', 5),
  ('00000000-0000-4000-8000-0000000000a1', 'CL-03', 'claims',
   'No guaranteed or assured returns on market-linked products',
   'Never promise, guarantee or "assure" returns on mutual funds or other market-linked products.',
   'Mutual funds and other market-linked products carry market risk. Copy must never use '
   '"guaranteed", "assured", "fixed", "risk-free" or "lock in" language about their returns. '
   'Past performance may be quoted only as historical, with its as-of date and the standard '
   'mutual-fund risk disclaimer.',
   '[{"kind":"do","text":"Flexi-Cap delivered 14.2% CAGR over 3 years (as of Q3 2026). Past performance may not be sustained.","source":"guide"},
     {"kind":"dont","text":"Lock in 14.2% assured annual returns!","source":"guide"}]',
   'blocker', 'approved', 9),
  ('00000000-0000-4000-8000-0000000000a1', 'G-07', 'terms',
   'Write "PayWise", camel-cased; never "Paywise app"',
   'The brand name is always "PayWise" with a capital W, and never "Paywise app".',
   'Our name is PayWise: one word, capital P and capital W. Do not write "Paywise", "Pay Wise" '
   'or "PayWise app". PayWise is the company and the product, not only an app.',
   '[{"kind":"do","text":"Start a SIP on PayWise.","source":"guide"},
     {"kind":"dont","text":"Start a SIP on Paywise app.","source":"guide"}]',
   'warning', 'approved', 7),
  ('00000000-0000-4000-8000-0000000000a1', 'VS-02', 'visual',
   'Warm-neutral image palette; no cold blue casts',
   'Imagery uses warm-neutral tones; avoid cold, blue-tinted photography.',
   'Photography and illustration sit in a warm-neutral palette (off-white, sand, terracotta, '
   'vermilion accents). Avoid cold blue casts and desaturated corporate stock imagery.',
   '[]',
   'warning', 'approved', 12),
  ('00000000-0000-4000-8000-0000000000a1', 'A-01', 'access',
   'Reading grade 9 or below for retail audiences',
   'Retail-facing copy should read at grade 9 or below.',
   'Copy for retail investors must score at or below grade 9 on standard readability measures. '
   'Prefer short sentences, common words and one idea per sentence. Explain any financial term '
   'the first time it appears.',
   '[]',
   'suggestion', 'approved', 14)
on conflict (org_id, code, version) do nothing;
