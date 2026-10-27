---
description: Start or resume the next development phase per PROGRESS.md and docs/PHASES.md
---

# BrandLens /next Protocol

Follow the session protocol strictly. Execute only **one phase** in this session.

Target phase argument: "$ARGUMENTS"

## 1. Phase Identification
1. Read `PROGRESS.md` to determine the current state and latest handoff.
2. If "$ARGUMENTS" specifies a phase (e.g. `P00`, `P01`), target that phase.
3. If no phase argument is passed:
   - Look for any phase marked `in-progress` or `partial`.
   - Otherwise, select the first phase marked `todo` whose dependencies are fully `done`.
4. Make sure you are on `main` (no phase branches; `git pull --ff-only` first). In `PROGRESS.md`, update the phase row with your owner initial and status `in-progress`.

## 2. Context Loading (Do Not Crawl Repo)
1. Read **only** the target phase's section in `docs/PHASES.md`.
2. Inspect the "Read first" references for that phase and read **only** those specific sections in `docs/SPEC.md`.
3. Read the latest **Handoff** section in `PROGRESS.md`.
4. Open existing code files only as strictly needed.

## 3. Plan & Build
1. Output a brief 3-5 item task list before modifying code.
2. Build the phase incrementally, strictly adhering to the non-negotiable invariants in `CLAUDE.md`:
   - Never show an uncited finding.
   - Treat the LLM as untrusted (schema-bound, local quote matching, local offsets).
   - Deterministic checks first.
   - Minimal context to external LLMs; no secrets or raw PII.
   - All state transitions must go through `transition_content()` or `transition_content_system()`.
   - Ensure RLS coverage on any table with `org_id`.
3. Check off the phase acceptance criteria from `docs/PHASES.md` as you proceed.

## 4. Verify
1. Run `make check` (linting, type checking, unit tests). Everything must be green.
2. Run any phase-specific acceptance checks or scripts specified in `docs/PHASES.md`.

## 5. Record Handoff
Update `PROGRESS.md`:
1. Mark the target phase status as `done`.
2. Overwrite the **Handoff** section using this structure:
   - **Phase / status:** [e.g. P01 / done]
   - **What exists now:** [list key files, tables, functions, or endpoints built]
   - **Stubbed or deferred:** [anything left for downstream phases]
   - **How to run / verify:** [exact test or make commands]
   - **Gotchas discovered:** [specific edge cases or quirks]
   - **Exact next step:** [name the next phase and immediate action]
3. Append any architectural decisions or newly installed dependencies (with licences) to the **Decisions log**.

## 6. Commit & Stop
1. Stage your changes and commit with a conventional commit message:
   `git commit -m "feat(<scope>): <phase-id> <short-description>"`
2. **Stop immediately.** Do not start the next phase.
3. Conclude your response with:
   `"<phase-id> done. Run /clear then /next."`