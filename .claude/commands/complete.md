---
description: Autonomously execute and chain phases continuously without pausing for /next or /clear until acceptance criteria are met
---

# BrandLens Autonomous Completion Protocol (/complete)

You are in autonomous continuous execution mode. Do **not** stop after completing a single phase, do **not** tell the user to run `/clear` or `/next`, and do **not** wait for manual confirmation between phases unless a critical blocking error occurs or an open user decision is strictly required.

Target milestone / final phase: "$ARGUMENTS" (if empty, continue until all phases in `PROGRESS.md` are marked `done`).

---

## Autonomous Execution Loop

Continuously execute the following loop until all target phases are completed:

### 1. Identify Next Phase
1. Read `PROGRESS.md` to find the earliest phase that is `todo`, `partial`, or `in-progress` whose dependencies are marked `done`.
2. If all phases (or the phase specified in "$ARGUMENTS") are `done`, jump to **Termination**.
3. Set that phase to `in-progress` in `PROGRESS.md` with your initial.

### 2. Phase Context Loading
1. Read **only** the target phase's entry in `docs/PHASES.md`.
2. Read **only** the sections of `docs/SPEC.md` listed under "Read first" for that phase.
3. Check the latest handoff notes in `PROGRESS.md`.
4. Do not crawl the entire repo; open files on demand.

### 3. Implementation & Invariant Enforcement
Build the required functionality while strictly maintaining all invariants from `CLAUDE.md`:
- Zero uncited findings displayed (citation gate enforced).
- Deterministic checks run before any LLM calls.
- LLM output treated as untrusted (schema-bound, local quote matching, local offsets).
- All content workflow state mutations go through `transition_content()` or `transition_content_system()`.
- Row Level Security (RLS) enabled on every table containing `org_id`.
- Never leak or hardcode environment secrets.

### 4. Verification
1. Run `make check` (linting, type checks, unit tests).
2. Run any phase-specific acceptance checks listed in `docs/PHASES.md`.
3. If errors occur, diagnose and fix them immediately. Do not proceed until `make check` is fully green.

### 5. Record Progress & Commit
1. Update `PROGRESS.md`:
   - Set the completed phase status to `done`.
   - Rewrite the **Handoff** section with current state, stubbed items, verification steps, and the exact next step.
   - Append any new decisions or dependencies (with licences) to the **Decisions log**.
2. Stage all changed files and create a conventional commit:
   `git commit -m "feat(<scope>): <phase-id> <short-description>"`

### 6. Context Management & Immediate Continuation
1. If context usage is becoming high, run a context compaction or prune working files.
2. Output a 2-line status update:
   - `Completed <phase-id>: <short description>`
   - `Proceeding directly to <next-phase-id>...`
3. **Loop back to Step 1 immediately** without waiting for user input.

---

## Stop Conditions (Only Pause If:)
Pause autonomous execution and alert the user **only** if:
1. **Critical External Blocker:** A required third-party service credential or cloud environment variable is missing and cannot be stubbed.
2. **Explicit User Decision:** A genuine fork in scope or financial expenditure listed under "Open questions" in `PROGRESS.md` is reached.
3. **Unresolvable Test Failure:** A test repeatedly fails after 3 distinct debugging attempts.

---

## Termination
When all target phases are marked `done` and verified:
1. Run a final repository verification (`make check`).
2. Output an executive summary table listing completed phases, key files created, and remaining roadmap items.
