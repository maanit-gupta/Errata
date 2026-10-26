-- P12: PDF page manifest per review run. The worker renders each page to
-- renders/{org}/{content}/{version}/page-{n}.png; finding boxes are in those images' pixel space.
-- [{n, width, height, path, words}]
alter table public.review_runs add column pages jsonb not null default '[]';
