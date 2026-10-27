# BrandLens security review (P15)

Checklist from `docs/PHASES.md` P15, with the evidence for each item. Run on 2026-10-27 against `main`. Re-run the commands below after any change to auth, storage, the pipeline prompts or the Next config.

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | RLS on every table | ✅ | pgTAP `supabase/tests/00_schema.test.sql`: "every public table with org_id has RLS enabled" and "every public table has RLS enabled". `01_rls_access.test.sql`: member can / non-member can't, per table. Agencies read rule cards only through `rule_cards_public` (no `body`), asserted in `00_schema`. |
| 2 | Secret key never in client bundles | ✅ | See [Client bundle scan](#client-bundle-scan). `SUPABASE_SECRET_KEY` is read only in `apps/web/lib/supabase/admin.ts` (`import "server-only"`), imported only by `lib/notify/email.ts` (server). The worker reads it from its own env. |
| 3 | Signed URL TTLs | ✅ | One constant, `SIGNED_URL_TTL_S = 900` (15 min) in `apps/web/lib/limits.ts`, used for drafts, renders, assets and guides. URLs are minted per server render (Realtime refreshes re-mint them) for a single object the RLS-checked session can already read. |
| 4 | Storage policies | ✅ | All four buckets are private (`20261026100013_storage.sql`). Path segment 1 is the org id and segment 2 the content id; policies check `is_org_member` / `is_org_staff` / `storage_content_in_org`. Vault buckets are writable by brand admins only. `20261027100021_storage_limits.sql` adds server-side size limits (5 MB for drafts, guides and assets; 10 MB for renders) and a MIME allow-list on drafts and renders. |
| 5 | Prompt injection | ✅ | See [Prompt injection](#prompt-injection). |
| 6 | Rate limiting on submit | ✅ | `enqueue_review()` calls `private.hit_rate_limit('submit', 10, '1 minute')` (migration `20261027100020`): a fixed one-minute window per user in `private.rate_counters`, raising SQLSTATE `BL429`. Enforced in SQL, so a direct RPC call can't skip it. The server action maps `BL429` to "Saved, but you've submitted 10 checks in the last minute…". pgTAP `06_rate_limit.test.sql` (6 tests: 10 pass, the 11th fails, refused hits aren't counted, the window resets, `enqueue_review` is covered, clients can't call the helper). |
| 7 | Input size limits | ✅ | Uploads: 4 MB (`MAX_UPLOAD_BYTES`), checked in the browser and in each server action; `serverActions.bodySizeLimit` is 4.5 MB (Vercel's request cap). Draft body ≤ 40,000 chars and title ≤ 140 (zod). Worker: `MAX_WORDS` 2000, `PDF_MAX_PAGES` 40, `PDF_MAX_WORDS` 12,000 (`config.py`). Storage bucket limits behind all of these (item 4). |
| 8 | CSP and security headers | ✅ | `apps/web/next.config.ts`, verified with `curl -sI` on a production build: `Content-Security-Policy` (default-src 'self'; connect/img limited to the Supabase project; `frame-ancestors 'none'`; `object-src 'none'`; `base-uri`/`form-action` 'self'), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS, no `X-Powered-By`. `e2e/a11y.spec.ts` fails on any CSP violation in the console; it passed on every main page against a production build with cloud data. |

## Client bundle scan

After `pnpm build` in `apps/web`, scan `.next/static` (client JS only) for secret shapes and names:

```bash
grep -rhoE 'sb_secret_[A-Za-z0-9_-]{16,}' .next/static | wc -l            # 0
grep -rhoE 'discord(app)?\.com/api/webhooks/[0-9]+' .next/static | wc -l  # 0
for p in gsk_ AIza service_role GROQ_API_KEY LANGFUSE_SECRET; do grep -rlF "$p" .next/static | wc -l; done  # 0 each
```

The names `SUPABASE_SECRET_KEY` and `DISCORD_WEBHOOK_URL` and the string `sb_secret_` do appear in one chunk: they're the **names** in the zod env schema (`lib/env-schema.ts`, shared with the client for public vars) and supabase-js's own `startsWith("sb_secret_")` key-type check. No values. The server schema is only parsed on the server.

## Git history scan

`gitleaks` isn't installed here, so the history was grepped (`git log --all -p`) for Supabase secret keys (`sb_secret_…`), Groq (`gsk_…`), Google (`AIza…`), Langfuse (`sk-lf-`/`pk-lf-`), Resend (`re_…`), Postgres URIs with passwords, JWTs and Discord webhook URLs. Nothing real was found: the one webhook match is the fixture `https://discord.com/api/webhooks/1/x` in `apps/web/lib/__tests__/env.test.ts`. No `.env` file (other than `.env.example`) was ever committed. Run `gitleaks detect` before making the repo public for a second opinion.

## Prompt injection

| Vector | Defence | Test |
|---|---|---|
| Draft text tells the model to ignore its rules | The system prompt (`prompts/review_v2.md`) treats `<draft>` as data; deterministic stages run first and their findings never depend on the LLM; the citation gate only keeps findings citing a rule or fact retrieved for this run, with a quote found locally in the draft | `tests/test_security.py::test_obedient_llm_cannot_hide_a_deterministic_blocker` (a model that obeys and returns no findings still leaves the CL-03 blocker); `scripts/review_bench.py --only injection` |
| Draft text closes `</draft>` and opens a fake `<rules>` block | `llm_pass.fence()` swaps `<` for a lookalike bracket on our section tag names in all untrusted text (draft, alt text, intent, quotes) | `test_draft_cannot_close_its_delimiter_or_open_a_rules_block`, `test_intent_and_alt_text_are_fenced`, `test_fence_neutralises_section_tags_only` |
| Model cites a rule that only exists in the draft, a real rule that wasn't retrieved, or invents a quote | Citation gate: `unknown_codes`, `no_valid_citation`, `quote_not_found` drops | `test_injected_citations_and_invented_quotes_are_dropped`; `tests/test_gate.py` |
| PDF hidden text (white-on-white, tiny, transparent, off-page) | Detected in ingest, redacted before the LLM (`⟦REDACTED:hidden_text⟧`), and flagged to the reviewer as a claims blocker | `tests/test_pdf.py` (fixture deck page with "Ignore previous instructions…") |
| Text inside an image | OCR text is part of the redacted, fenced draft, and redacted spans are blacked out in the image sent to the vision model. The vision model still sees the pixels, so text it reads there can't be fenced: the schema and the citation gate are the defence (a finding must cite a retrieved rule, and image findings cite rules checked against deterministic signals) | `tests/test_vision.py`, `eval/vision_eval.py` |
| Model output itself | Schema-bound (Pydantic), retried once with the validation error, then fallback; offsets computed locally | `tests/test_llm_router.py`, `tests/test_gate.py` |

## Degraded mode and restarts

- **LLM down.** Running the in-process pipeline with invalid keys (`GROQ_API_KEY=invalid-key GEMINI_API_KEY=invalid-key uv run python eval/run_eval.py --only hero-01 claims-01 tone-01 --cache-dir <empty>`): Groq 401 and Gemini 400 go straight to the fallback and then to `DegradedError`. All three rows still return their deterministic findings: blocker recall 1.00, 0 uncited. In the worker the run is stored with `review_runs.degraded = true`, and the draft page shows a banner ("The AI check was unavailable, so only deterministic checks ran…") (`components/drafts/draft-workspace.tsx`).
- **Rate limits.** After a provider stays 429 through its retries, the shared router skips it for `LLM_RATE_LIMIT_COOLDOWN_S` (60 s, or its Retry-After if longer), so later jobs don't each wait through the same backoff (`tests/test_llm_router.py`).
- **Worker dies mid-job.** `scripts/redelivery_test.py` submits a draft, claims its pgmq message with a 15 s visibility timeout, marks the run `running` and abandons it. Result on the local stack: nobody could see the message before the VT expired; the live worker then read it again and finished the run (`done`, 2 findings, message deleted) 74.8 s after the "crash". A run that is already `done` is skipped on redelivery, persisting replaces the run's own findings, and a message read more than `MAX_READS` times is archived and the run marked `failed`.

## Known limits

- `script-src` keeps `'unsafe-inline'`: App Router emits inline bootstrap scripts, and nonces would need a per-request proxy rewrite on every (dynamic) page. Everything else is locked down, and there's no user-generated HTML (TipTap renders text and marks only).
- The rate limit is per user. A burst across many accounts is bounded by the worker's consumers and the LLM free-tier quotas, which then trigger degraded mode rather than errors.
- The demo role switcher (`NEXT_PUBLIC_DEMO_MODE=true`) signs anyone in as a fictional PayWise user. It's for judging only; turn it off for any real data.
