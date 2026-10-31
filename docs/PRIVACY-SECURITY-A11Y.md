# Privacy, security and accessibility

Errata is a student hackathon prototype. The demo uses only the fictional PayWise brand; no real
personal data is seeded. This note says what a real deployment would store and how it lines up
with India's Digital Personal Data Protection Act 2023 (DPDP). It describes alignment, not a legal
compliance review.

## 1. Privacy and DPDP alignment

### What Errata stores

| Data | Where | Personal data? | Kept until |
|---|---|---|---|
| Account email and password hash | Supabase Auth | Yes | The account is deleted |
| Display name, organisation membership and role | `profiles`, `memberships` | Yes | The account or membership is deleted |
| Drafts (text) and uploaded files (DOCX, images, PDFs), every version | `versions`, private Storage buckets `drafts/`, `renders/` | Can contain it (whatever a creator writes or uploads) | The content is deleted; no automatic expiry yet |
| Findings, decisions, comments | `findings`, `decisions`, `comments` | Quotes from drafts; reviewer ids and reasons | With the content |
| Audit trail | `audit_events` (append-only) | Actor ids, reasons | Kept. The append-only trigger also blocks deleting a user who appears in it (see rights below) |
| Review runs | `review_runs` | No (ids, timings, model versions) | With the content |
| MCP keys | `mcp_api_keys` | Owner id; the key itself is stored only as a SHA-256 hash | Revocation or expiry (≤ 365 days), then kept as a record |
| Brand vault (rules, facts, glossary, assets) | vault tables, `guides/`, `assets/` buckets | No (brand material) | Until edited or archived |

### What leaves Errata

| Recipient | What it receives | Safeguard |
|---|---|---|
| Groq, Google AI Studio (LLM review) | One redacted draft chunk plus the retrieved rule and fact snippets | Stage 2 redacts emails, phone numbers, PAN, Aadhaar-shaped numbers, card numbers (Luhn-checked), IFSC codes, account numbers and API keys/secrets before any LLM call; never-send vault items are never sent (invariant 5). The Gemini free tier may use prompts, which is why the demo data is fictional |
| MCP clients (Cursor, Claude, …) | Live campaign facts, glossary and approved rule text for the key's organisation; pre-check findings on text the client itself sent | Read-only; never-send, expired and other-campaign facts excluded in SQL; agency keys get rule summaries only |
| Langfuse Cloud (tracing) | Ids, counts, model and prompt versions | No prompts or draft text (P03 decision) |
| Discord (notifications) | Content title and a link | No draft text |
| Worker logs | Ids, counts, timings | Draft text, claims, MCP keys and secrets are never logged (tested in `test_mcp.py`) |

Hosting: Supabase (Postgres, Auth, Storage) and the Render worker in Singapore; Vercel for the web
app. DPDP permits transfers outside India except to countries the government restricts; none of
these are restricted today.

### DPDP principles

| Principle | Status |
|---|---|
| Notice and consent | The app has no sign-up page, and access to an organisation's data needs a membership row added by the team (RLS). Supabase Auth's email sign-up setting is still on in `supabase/config.toml`; turning it off for a real deployment, and a privacy notice at sign-in, are **roadmap**. The usability study uses a separate consent note ([`docs/usability/consent.md`](usability/consent.md)) and records no names |
| Purpose limitation and minimisation | Data is used only to check and approve marketing content. LLMs get the minimum (redacted chunk plus top-k snippets), never the whole vault |
| Accuracy | Owners edit their drafts; brand admins edit the vault; every rule change is versioned |
| Storage limitation | Signed file URLs last 15 minutes. **Roadmap:** per-organisation retention (e.g. delete archived content after N months) and a scheduled purge |
| Security safeguards | Section 2 |
| Rights to access, correction and erasure | **Roadmap:** self-service data export (JSON plus files) and account erasure. Today the operator deletes content in the database. Deleting a user who appears in the append-only audit trail is **blocked** by its trigger (checked 2026-10-31), so erasure needs a designed path: pseudonymise the actor in the audit trail through one audited function, then delete the account |
| Breach notification | **Roadmap:** an incident runbook (notify the Data Protection Board and affected people). Supabase and Render provide the infrastructure logs |
| Children's data | Not applicable: a business tool, no consumer accounts |

## 2. Security review summary

The P15 checklist with evidence is in [`docs/SECURITY.md`](SECURITY.md). In short:

- **Row-level security on every table** with `org_id`, tested by pgTAP (member can, non-member can't). The full suite is 147 tests in 9 files, all passing on the real local Supabase stack (2026-10-31).
- **Secrets:** the Supabase secret key is used only by the worker and one server-only web module; a client-bundle scan and `gitleaks` over the git history were clean (2026-10-27).
- **Storage:** private buckets, org/content path checks, 15-minute signed URLs, 4–5 MB limits.
- **Workflow:** state changes only through `transition_content()`, with an append-only audit trail; a 10-per-minute submit limit enforced in SQL.
- **LLM:** prompt-injection fence, schema-bound output, a citation gate that drops anything uncited or unquoted, deterministic checks first.
- **Web:** CSP and security headers (`script-src` still allows inline scripts; see SECURITY.md).

### MCP key handling (Round 3)

| Control | Implementation | Test |
|---|---|---|
| Unguessable keys | `bl_mcp_` + 48 hex characters from `gen_random_bytes(24)` (192 bits) | pgTAP `07` |
| Hash-only storage, shown once | Only the SHA-256 hash is stored; app users can't read `key_hash`; the plaintext is returned once to the creating browser and never logged or audited | pgTAP `07`, `test_mcp.py` |
| No self-escalation | Keys carry no role. The worker reads the owner's **current** role from `memberships` on every call, so a demoted or removed member's key follows | pgTAP `07` |
| No direct writes | No insert or update grants; create and revoke only through security-definer functions. A revoked key can't be revived | pgTAP `07` |
| Expiry and limits | 1–365 days (UI offers 30/90/365); at most 5 live keys per user; 60 calls/min per key; 30 failed attempts/min per client address; 128 KB request cap | pgTAP `07`, `test_mcp.py` |
| Scope from the key only | Strict input schemas reject extra fields such as `org_id` or `role`; other organisations' campaigns return "not found" | `test_mcp.py`, `mcp_check.py` |
| Read-only | Three tools, one resource, one prompt; no tool writes brand data or workflow state | `test_mcp.py`, `mcp_check.py` |
| Audited | Key create and revoke, and every tool call (key id, tool, campaign, counts) go to `audit_events` | `test_mcp_server.py` |

Known MCP limits: the per-key rate limiter lives in the worker process (one Render instance), and a
key holder can read approved rule text, so keys should be treated like passwords and revoked when a
device or contractor leaves.

## 3. Accessibility

Target: WCAG 2.2 AA. The gate is zero serious or critical axe violations (`@axe-core/playwright`,
tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa) on every route in both themes, plus keyboard
tests.

| Check | Result | Where it ran |
|---|---|---|
| `ui.spec` axe, every product route × light and dark | 0 serious/critical | Local Supabase stack, 2026-10-28 (after the redesign) |
| `ui.spec` + `keyboard.spec` + `a11y.spec` on production | 49 passed, 1 skipped (the dev-only kitchen sink) | Live app, 2026-10-27 |
| Colour pairs | 55 pairs per theme meet WCAG AA contrast (unit test on the design tokens) | CI |
| Round 3 components (MCP dialog and key list, "AI check pending" banner) | 0 violations on the dev kitchen sink, both themes | Build sandbox, 2026-10-31 |
| Round 3 pages signed in (Settings with the MCP card, Insights with the real-data filter, a draft showing the pending banner) | **Not run yet** on the real stack | Command below |

Design rules that matter here: severity never relies on colour alone (icons and text labels),
visible 2 px focus outlines, rule and fact IDs in text, a status role on the pending and degraded
banners, reduced-motion respected, captions and a transcript for the demo video.

Re-run the full gate on the local stack (`make db-start && make db-reset && make dev-local`, then):

```bash
cd apps/web && pnpm exec playwright test e2e/ui.spec.ts e2e/keyboard.spec.ts e2e/a11y.spec.ts
```
