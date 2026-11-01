-- R3 extra, Hero 3 (visual auto-heal): a palette-only contrast fix suggested by the worker on a
-- WCAG 1.4.3 finding (vision/autoheal.py). It's a suggestion: the worker writes it, users can't
-- (the findings column grants stay status/dismiss_reason/dismiss_note), and accepting it only sets
-- the finding's status through the existing grant and audit trigger. Nothing touches the image.
alter table public.findings
  add column visual_fix jsonb
  check (visual_fix is null or jsonb_typeof(visual_fix) = 'object');

comment on column public.findings.visual_fix is
  'Hero 3: {original_*, healed_text_hex, healed_bg_hex, healed_ratio, required_ratio, strategy, source:"palette", applied:false}';
