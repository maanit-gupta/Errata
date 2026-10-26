-- Live UI updates (RLS applies to Realtime too).
alter publication supabase_realtime add table public.review_runs, public.findings, public.contents, public.comments;
