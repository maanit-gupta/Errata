-- P16 demo reset for the PayWise org (scripts/reset_demo.sh). Runs in one transaction.
-- 1. Every content (demo drafts, test runs, simulated history) and, by cascade, its versions,
--    runs, findings, decisions and comments. Audit events are append-only and stay.
delete from public.contents where org_id = '00000000-0000-4000-8000-0000000000a1';

-- 2. Rule cards back to the seeded v1: drop later versions (created by edits or by approving
--    generated examples in F06) and re-approve v1.
delete from public.rule_cards
where org_id = '00000000-0000-4000-8000-0000000000a1' and version > 1
  and code in (select code from public.rule_cards
               where org_id = '00000000-0000-4000-8000-0000000000a1' and version = 1);
update public.rule_cards set status = 'approved'
where org_id = '00000000-0000-4000-8000-0000000000a1' and version = 1 and status = 'archived';

-- 3. Generated example suggestions wait for a decision again (no new LLM call needed for F06).
update public.example_suggestions
set status = 'pending', decided_by = null, decided_at = null
where org_id = '00000000-0000-4000-8000-0000000000a1' and status <> 'pending';
