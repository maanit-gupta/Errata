---
description: Autonomously execute and complete all BrandLens UI phases end-to-end (U0 → U1 → feature UI phases → U2) in a single continuous session
---

Execute an autonomous, full-pipeline **UI completion** session across all pending BrandLens UI phases. Follow the execution loop below until all UI phases are built, verified, and logged.

---

### Step 0: Pre-Flight & Migration (First Run Check)

If `CLAUDE.md` still contains the old "UI and UX conventions" section (serif, off-white, `#F8F7F4`):
1. Replace that section with:  
   `All visual and interaction rules live in docs/DESIGN.md. It wins on look and feel; the invariants still win over it.`
2. Add `docs/DESIGN.md` to the **Source-of-truth** table.
3. Add rows `U0`, `U1`, and `U2` (from `docs/DESIGN.md` §12) to the `PROGRESS.md` phase table, and note in `P02` that tasks 1–2 move to `U0`.
4. Log the decision in `PROGRESS.md`:  
   `"Terminal Noir design system adopted; supersedes Round 1 light palette and serif"`
5. Stage and commit: `docs: adopt DESIGN.md`.

---

### Step 1: Execution Pipeline Order

Iterate through the following sequence in strict order, skipping any phase already marked completed in `PROGRESS.md`:

1. **U0** — Token foundations, design system primitives, `/dev/kitchen-sink`
2. **U1** — App shell, navigation hierarchy, theme toggles, core layouts
3. **P02 (UI)** — Workspace & brand setup interfaces
4. **P05 (UI)** — Data ingestion & source management views
5. **P08 (UI)** — Analysis run triggers & processing status displays
6. **P09 (UI)** — Report viewer, diff explorer, and decision cards
7. **P12 (UI part)** — Settings, export dialogs, and integration panels
8. **P13 (UI part)** — Feedback capture & audit review interface
9. **U2** — System-wide polish, edge states (§11), micro-interactions, responsive refinements

---

### Step 2: The Phase Loop (Repeat for Each Target Phase)

For each active phase `<ID>`:

#### 1. Orient & Scope
- Check dependencies in `PHASES.md` / `PROGRESS.md` to ensure prerequisites are satisfied.
- Read `docs/DESIGN.md` §0–2 and §7.
- Read the specific `docs/DESIGN.md` sections mapped to `<ID>` in §12.
- Read the phase's corresponding section in `PHASES.md` and the relevant `SPEC.md` chapters.

#### 2. Plan & Branch
- Work on `main` in the main checkout. No `ui/<ID>` branches or worktrees.
- Identify the explicit routes, components, and state boundaries to construct.

#### 3. Build Rules
- **Tokens Only:** Strictly no raw hex/hardcoded colors in `.tsx`. Use CSS variables / Tailwind tokens defined in the design system.
- **Component Registry:** Reuse existing primitives in `components/brand/`. Any newly created component **must** be rendered with its variants inside `/dev/kitchen-sink`.
- **States (§11):** Every view and container must implement:
  - `empty` (zero state)
  - `loading` / `skeleton`
  - `partial` / `streaming`
  - `error` (inline recovery action)
  - `populated` (nominal state)
- **Traceability (§9):** Any interface element exposing an AI or algorithmic decision must conform to the §9 Decision Traceability display contract.

#### 4. Gate Verification (Must Pass Before Proceeding)
Run the following verification checks for `<ID>`. Fix all regressions immediately:
- **Build & Quality:** Run `make check` (linting, type checking, unit tests). Must be 100% green.
- **Accessibility:** Run automated axe audits on all touched routes. **0 serious or critical violations** in both dark and light themes.
- **Keyboard Walkthrough:** Verify focus rings, visible tab order, and non-trapped focus states.
- **Motion:** Verify animations conditionally respect `@media (prefers-reduced-motion: reduce)`.
- **Visual Evidence:** Save high-resolution screenshots for both light and dark modes to `docs/screens/<ID>/` (e.g., `docs/screens/<ID>/desktop-dark.png`, `docs/screens/<ID>/desktop-light.png`).
- **Decisions Log:** Record any unavoidable deviations from `DESIGN.md` in `PROGRESS.md → Decisions`.

#### 5. Commit & Progress Update
- Mark `<ID>` as complete in `PROGRESS.md`.
- Commit changes:  
  `feat(ui): complete <ID> - [short description of phase]`
- Immediately transition to the next phase in the pipeline without stopping or waiting for user confirmation.

---

### Step 3: Final Acceptance Pass (Post-U2)

Once `U2` completes:
1. Run a full project validation suite: `make check`.
2. Verify route tree completeness: ensure all routes defined in `SPEC.md` render without 404s or uncaught boundaries.
3. Check `/dev/kitchen-sink` to confirm all component variants, states, and tokens are showcased.
4. Update `PROGRESS.md` to reflect that the UI implementation is complete.
5. Commit: `chore(ui): finalize full UI implementation (U0 through U2)`.

---

### Output Summary

Conclude the run with a structured markdown table:

| Phase | Description | Routes Touched | Kitchen Sink Added | Axe Violations | Screenshot Path |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **U0** | ... | ... | Yes / No | 0 | `docs/screens/U0/` |
| **...** | ... | ... | ... | 0 | `docs/screens/.../` |

Finish with:  
**"BrandLens UI pipeline completed from U0 to U2. Run `make check` to verify full workspace integrity, or `/next` to resume remaining backend phases."**
