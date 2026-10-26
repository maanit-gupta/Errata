---
description: Start the next BrandLens UI phase (U0, U1, J-owned UI phases, U2), or a specific one, e.g. /next-ui U1
argument-hint: "[phase-id]"
---

Run a phase-scoped **UI** session. Follow every step of `.claude/commands/next.md` (orient → claim and branch → plan → build → verify → hand off), with these additions:

**First run only.** If `CLAUDE.md` still has the old "UI and UX conventions" section (serif, off-white, `#F8F7F4`):
1. Replace that section with one line: "All visual and interaction rules live in `docs/DESIGN.md`. It wins on look and feel; the invariants still win over it."
2. Add `docs/DESIGN.md` to the Source-of-truth table.
3. Add rows U0, U1 and U2 (from DESIGN.md §12) to the PROGRESS phase table, and note in P02 that tasks 1–2 move to U0.
4. Log the decision ("Terminal Noir design system adopted; supersedes Round 1 light palette and serif") and commit as `docs: adopt DESIGN.md`.

**Pick the phase.** Use `$ARGUMENTS` if given. Otherwise, in this order, pick the first whose dependencies are done: U0 → U1 → the next J-owned phase (P02, P05, P08, P09, P12 UI part, P13 UI part) → U2.

**Read.** Read `docs/DESIGN.md` §0–2 and §7 every time. Then read only the DESIGN sections the phase touches (§12 maps them), plus the phase's PHASES.md section and the SPEC sections it lists.

**Build rules**
- Use tokens only; no raw hex in `.tsx`.
- Reuse the `components/brand` components and add any new one to `/dev/kitchen-sink`.
- Every view implements the §11 states.
- Respect the §9 traceability table: if your screen surfaces a decision, show it the way §9 says.

**Verify** (on top of `make check`)
- axe has zero serious or critical issues on the touched routes, in dark and light.
- Keyboard-only walkthrough works.
- Reduced motion is respected.
- Screenshots (dark and light) are saved to `docs/screens/<ID>/`.
- Any DESIGN.md deviation is logged in PROGRESS → Decisions.

Finish with: **"<ID> done. Run `/clear`, then `/next-ui` (or `/next` for backend phases)."**