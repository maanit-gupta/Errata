# BrandLens — DESIGN.md

> The visual and interaction system for every BrandLens screen. It adapts the "Terminal Noir" design prompt to BrandLens: the product, the Round 1 plan (storyboard F01–F06 on p.10, finding mock-up on p.12, insights on p.19), `docs/SPEC.md` and the invariants in `CLAUDE.md`.

## 0. Precedence

| Topic | Who wins |
|---|---|
| Look and feel (colour, type, shape, motion, layout, components) | **This file.** It replaces the "UI and UX conventions" section of `CLAUDE.md`, including the old serif and off-white palette. |
| What a screen must do (data, permissions, states, guards) | `docs/SPEC.md` and `docs/PHASES.md` |
| The 10 invariants in `CLAUDE.md` | Always. If a design idea conflicts with an invariant, the invariant wins and the design changes. |
| A PHASES.md task that prescribes visuals (e.g. P02 "tokens", P15 "loading skeletons") | This file. Spinners, not skeletons (§11). Log the override in PROGRESS → Decisions. |

**Kept from Round 1:**
- Mono `ID · SEVERITY` labels, e.g. `CL-03 · BLOCKER`.
- Vermilion for blockers.
- The dark window-header mock-up style.
- The PayWise demo IDs.

**Dropped:** the serif display face and the off-white default page.

---

## 1. The feel

BrandLens should feel like **a compiler for brand content**: dark, engineered and quiet. It should be precise enough that a legal reviewer trusts it, and fast enough that a creator doesn't resent it.

- **Mostly near-black.** Large thin type, 1px hairlines, a faint blueprint grid on public pages.
- **Mono is the second voice.** It carries labels, IDs, run logs and attributions.
- **The signature element is the citation chip.** Every finding wears its rule or fact ID like a compiler error code (`CL-03`, `E-19`, `WCAG 1.4.3`). IDs are the product's proof, so they're always visible, mono, and clickable.
- **Three colours carry meaning, and nothing else may borrow them:**
  - **Violet** means *you can act here*: primary actions, the active nav item, selection, focus.
  - **Vermilion** means *blocker*. This is Round 1 continuity.
  - **Green** means *verified or passed*: cited, intent-verified, publish-ready, run done.
- **Pixel-block art** (violet, lilac, white) glitches at section edges on public pages only, as punctuation. It never appears inside the review workflow.
- **Motion is terminal-like**: typing, scrambling, status flips, log lines streaming. Nothing floats or bounces.

---

## 2. Design tokens

Define these in `apps/web/app/globals.css` under Tailwind v4 `@theme` / `:root`, with dark as the default theme. The light theme is set by `[data-theme="light"]` (toggle) or `prefers-color-scheme: light` when the user hasn't chosen.

### 2.1 Colour: dark (default)

```css
--bg:             #0D0D0F;  /* page */
--bg-elevated:    #141416;  /* cards, sidebar, menus, panels */
--bg-hover:       #1B1B1F;
--bg-code:        #0A0A0B;  /* code/log panels, draft preview */
--border:         #232327;  /* decorative hairlines only */
--border-strong:  #34343A;  /* dividers needing more weight */
--border-control: #6B6B73;  /* input, checkbox, select outlines (3.7:1, WCAG 1.4.11) */
--grid-line:      rgba(255,255,255,0.04);

--text:           #F5F5F7;  /* 17.8:1 */
--text-muted:     #A1A1AA;  /*  7.6:1 */
--text-faint:     #8B8B94;  /*  5.8:1. CHANGED from #6B6B73, which failed AA (3.7:1) */

--accent:         #8A2BFF;  /* violet: fills and borders only. NEVER as text on dark (3.6:1) */
--accent-hover:   #7A1FF0;
--accent-fg:      #FFFFFF;  /* text on accent: 5.4:1 */
--accent-soft:    #B9A2FF;  /* lilac: link text, ID chips text (9.0:1) */
--accent-deep:    #1C0533;  /* announcement bar, hero glow, selected-row tint */
--accent-pixel:   #E6D9FF;
--mint:           #7CF5C8;  /* gradient end, NEW tags, marketing highlights only */

--blocker:        #FF6A4D;  /* vermilion (Round 1 lineage), text 6.9:1; fill uses --blocker-fg */
--blocker-fg:     #0D0D0F;  /* text on blocker fill: 6.9:1 */
--blocker-bg:     rgba(255,106,77,0.12);
--warning:        #F5B544;  /* 10.7:1 */
--warning-bg:     rgba(245,181,68,0.10);
--suggestion:     #A1A1AA;  /* deliberately neutral */
--success:        #22E07A;  /* verified / cited / publish-ready / done. 11.1:1 */
--success-bg:     rgba(34,224,122,0.10);
--danger:         #FF5A5F;  /* destructive actions and system errors (NOT findings) */
--focus:          #B9A2FF;  /* 2px focus ring + 2px offset */

--gradient-word:  linear-gradient(90deg, #8A2BFF 0%, #B9A2FF 55%, #7CF5C8 100%);
--hero-glow:      radial-gradient(60% 50% at 0% 0%, rgba(138,43,255,0.22), transparent 70%);
--shadow-pop:     0 8px 30px rgba(0,0,0,.5);  /* product popovers only */
```

### 2.2 Colour: light

```css
--bg:#FAFAFA; --bg-elevated:#FFFFFF; --bg-hover:#F0F0F2; --bg-code:#F4F4F6;
--border:#E4E4E7; --border-strong:#D4D4D8; --border-control:#8E8E96; --grid-line:rgba(0,0,0,0.04);
--text:#0D0D0F; --text-muted:#52525B; --text-faint:#6B6B73;
--accent:#7A1FF0; --accent-hover:#6A14DB; --accent-fg:#FFFFFF; --accent-soft:#6A2BD9;
--accent-deep:#F1E9FF; --mint:#0E8A62;
--blocker:#C2301B; --blocker-fg:#FFFFFF; --blocker-bg:rgba(194,48,27,0.08);
--warning:#8A5A00; --warning-bg:rgba(245,181,68,0.16);
--suggestion:#52525B; --success:#0F7A43; --success-bg:rgba(15,122,67,0.08);
--danger:#B4232A; --focus:#7A1FF0;
--gradient-word: linear-gradient(90deg,#7A1FF0 0%,#6A2BD9 55%,#0E8A62 100%);  /* large text only */
```

### 2.3 Verified contrast

These ratios were computed with the WCAG 2.x relative-luminance formula. AA requires 4.5:1 for normal text, and 3:1 for large text and UI boundaries.

**Dark theme**

| Pair | Ratio | Result | Use |
|---|---|---|---|
| text / bg | 17.8 | ✅ | body, headings |
| text-muted / bg | 7.6 | ✅ | secondary copy |
| text-faint (new) / bg | 5.8 | ✅ | meta, timestamps, footer links |
| text-faint (prompt's #6B6B73) / bg | 3.7 | ❌ | **fixed**; now used only as `--border-control` |
| accent #8A2BFF / bg | 3.6 | ❌ for text | fills, borders and focus only |
| white / accent | 5.4 | ✅ | primary buttons, active nav |
| accent-soft / bg | 9.0 | ✅ | links, ID chip text |
| blocker / bg | 6.9 | ✅ | blocker text |
| ink / blocker fill | 6.9 | ✅ | blocker badge |
| warning / bg | 10.7 | ✅ | warning text |
| success / bg | 11.1 | ✅ | verified ticks |
| border-control / bg | 3.7 | ✅ (1.4.11) | form controls |

**Light theme**

| Pair | Ratio | Result | Use |
|---|---|---|---|
| text-faint / bg | 5.1 | ✅ | |
| accent / bg | 6.1 | ✅ | |
| blocker / bg | 5.4 | ✅ | |
| white / blocker | 5.6 | ✅ | |
| success / bg | 5.2 | ✅ | |
| warning / bg | 5.7 | ✅ | |
| border-control / bg | 3.1 | ✅ | |
| mint #0E8A62 / bg | 4.2 | ⚠️ | large text (≥24px) only, i.e. inside the gradient word |

`apps/web/tests/tokens.contrast.test.ts` must assert every row above, so a token change can't silently break AA. It does this by parsing `globals.css` or importing a tokens TS mirror.

### 2.4 Semantic mapping

**Severity** (`SeverityBadge`). Always shown as a text label as well as colour (WCAG 1.4.1).

| Severity | Style | Label | Icon |
|---|---|---|---|
| blocker | `--blocker` fill, `--blocker-fg` text | `BLOCKER` | `OctagonX` |
| warning | 1px `--warning` outline, `--warning` text, `--warning-bg` | `WARNING` | `TriangleAlert` |
| suggestion | 1px `--border-strong` outline, `--suggestion` text | `SUGGESTION` | `Lightbulb` |

**Dimensions** (SPEC §1). They use mono labels and Lucide icons, **never colour**, so they can't be mistaken for severity:

| Label | Icon |
|---|---|
| `TONE` | `AudioLines` |
| `TERMS` | `SpellCheck` |
| `FACTS` | `CalendarCheck` |
| `CLAIMS` | `Scale` |
| `VISUAL` | `Palette` |
| `ACCESS` | `Accessibility` |

The one exception is the multicolour sentence on the marketing page (§8).

**Content states** (`StateBadge`, SPEC §4). These are mono uppercase chips, 4px radius.

| State | Style |
|---|---|
| draft | outline `--border-strong`, `--text-muted` |
| ai_check | violet outline + spinner glyph `⟳`, label `CHECKING` |
| needs_revision | `--blocker-bg` + `--blocker` text, label `NEEDS REVISION` |
| in_review | `--warning-bg` + `--warning` text |
| changes_requested | `--warning-bg` + `--warning` text, `↩` prefix |
| specialist_review | `--accent-deep` + `--accent-soft` text, label `LEGAL REVIEW` / `A11Y REVIEW` / `BRAND REVIEW` from `route_to` |
| approved | `--success-bg` + `--success` text |
| publish_ready | **solid `--success` fill, ink text**, label `✓ PUBLISH-READY`. The only solid-green element in the app. |
| archived | `--text-faint`, strikethrough-free, `ARCHIVED` |

**GCS status** (SPEC §11):

| Status | Style |
|---|---|
| `UNCLEAR` (<65) | `--blocker` fill |
| `watch` (65–75) | `--warning` outline |
| `clear` (>75) | `--success` text |
| `insufficient data` (N<10) | `--text-faint` italic |

### 2.5 Typography

Fonts:
- **Sans:** `Geist` (npm package `geist`, via `next/font`), weights 300 / 400 / 500.
- **Mono:** `Geist Mono` 400 / 500.
- Fallbacks: `Inter Tight` and `JetBrains Mono`.

Headlines are never bold. Confidence comes from size, not weight.

| Role | Size / line-height / tracking | Weight | Where |
|---|---|---|---|
| Hero H1 | `clamp(44px, 6vw, 88px)` / 1.02 / -0.03em | 300 | landing only |
| Section H2 | `clamp(32px, 4vw, 52px)` / 1.08 / -0.02em | 300 | landing |
| Page title | 32px / 1.15 / -0.015em | 400 | product pages |
| Card H3 | 20–24px / 1.25 | 400 | panels, finding titles on review page |
| Body L | 18px / 1.5, max 60ch, `--text-muted` | 400 | landing subheads |
| Body | 14–15px / 1.55 | 400 | product default |
| Draft text (editor) | 16px / 1.7, max 72ch | 400 | TipTap content: readability over density |
| Mono label | 11–12px uppercase / tracking 0.08em | 500 | eyebrows, column headers, badges |
| Mono ID | 12–13px, tracking 0.02em, not uppercased beyond the code itself | 500 | `CL-03`, `F-112`, `WCAG 1.4.3`, `review@1` |
| Mono log | 12.5px / 1.6 | 400 | run log, code panels |

All sizes are in rem. The UI must survive 200% zoom and text spacing overrides (WCAG 1.4.4, 1.4.12).

### 2.6 Shape, space, depth

- **Radius:**
  - 0 on the marketing site.
  - **6px** on product containers (cards, panels, dialogs, inputs).
  - **4px** on product chips and badges.
  - Buttons are 6px in the product and 0 on marketing.
- **Borders:** 1px everywhere. Separate sections and panels with hairlines, not background shifts. The one exception is `--bg-elevated` for sidebar and cards.
- **Shadows:** none on marketing. Product popovers, menus, dialogs and the ⌘K palette use `--shadow-pop`.
- **Spacing:** 4/8px base.
  - Marketing sections: 128px vertical padding on desktop, 80px on tablet, 64px on mobile.
  - Product page padding: 32px desktop, 16px mobile.
- **Layout:**
  - **Marketing:** 12 columns, max-width 1280px. Visible vertical grid lines every second column at `--grid-line`, running the full page height. Some sections sit in bordered "cells".
  - **Product:** fluid, max content width 1440px. The editor page is full-bleed.
- **Breakpoints:** `sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536`. The product is designed for ≥1024. Below `lg`, the sidebar becomes a sheet, and the editor and findings stack with a sticky "Findings (4)" toggle bar.
- **Minimum target size:** 24×24 CSS px for every interactive element (WCAG 2.2, 2.5.8). Prefer 32px in tables and 40–44px for primary buttons.

### 2.7 Iconography

- **UI icons:** Lucide, 16px, 1.5px stroke, `currentColor`. Use 20px in empty states.
- **Pixel glyphs** (marketing and empty states only): 16×16-cell SVGs rendered at 32px or 48px, in violet, lilac and white, with `shape-rendering: crispEdges`. Keep them in `components/brand/pixel-glyphs.tsx`. You need:
  - `lens` (the BrandLens mark)
  - `shield-check` (citation gate)
  - `calendar-x` (fact drift)
  - `scale` (claims)
  - `id-badge` (rule card)
  - `lock` (never-send / RLS)
  - `chart-bars` (GCS)
  - `eye` (accessibility)
  - `stamp` (human sign-off)

---

## 3. Brand marks

- **BrandLens wordmark:** Geist 400, `Brand` in `--text` and `Lens` in `--text-muted`, preceded by the pixel `lens` glyph (an 8×8-cell magnifier whose lens interior is a 2×2 violet block).
- **Favicon:** the pixel lens on `#0D0D0F`.
- **The PayWise demo brand** gets its own simple geometric wordmark (P04 fixtures). It must never be styled like BrandLens. In the product, PayWise appears only as the org name in the workspace switcher and inside drafts and vault data.

---

## 4. Motion

All motion goes through `components/motion/*` and respects `prefers-reduced-motion`. Use Framer Motion (the `motion` package) for reveals and CSS for everything else.

### 4.1 Signature motions

| Motion | Spec | Reduced-motion fallback |
|---|---|---|
| **Typewriter + glyph scramble** (landing hero) | Hero sentence: "Every draft, checked against your **{word}**". Word list: `claims policy`, `Fact Vault`, `tone of voice`, `glossary`, `brand palette`, `WCAG 2.2 AA`, `campaign facts`. Each char shows a random glyph from `[]{}<>/\|_` for 1–2 frames before it settles. Timing: 55ms per char, hold 1.8s, backspace at 30ms per char. Blinking block cursor `▮` at 15% `--text` (1s). The word is filled with `--gradient-word`. | Words swap instantly every 3s; no cursor blink |
| **Pipeline loop** (landing hero, right side). Replaces the prompt's "deploy loop". | Synced to each word change. Terminal chip `$ brandlens check --intent "webinar sign-ups"` flashes grey → `--success` for 600ms. A violet pulse runs down connector lines into a **6-tile pipeline card**: `01 INGEST · 02 PROTECT · 03 FILTERS · 04 RETRIEVE · 05 LLM PASS · 06 CITATION GATE`. Each tile flips `⟳ checking` (muted) → `✓ 31ms` (`--success`), in sequence at 120ms stagger. Then a finding chip slides out under the gate: `CL-03 · BLOCKER` (vermilion), followed by `✓ cited`. Tile sparklines are 1px violet polylines labelled `LATENCY` / `FINDINGS`, drawn with a stroke-dashoffset animation over 800ms. | Static final frame |
| **Pixel glitch sprites** | 8–12px square clusters at grid intersections. They toggle in `steps(4)` over ~400ms and then vanish. Random and sparse; **never over text, never in product screens**. In the footer they form a large static composition with a slow shimmer per cell. | Static, no shimmer |
| **Hover highlight** | Nav and menu links get an instant `--accent` block behind the label (80ms) with white text. Marketing buttons get a left-to-right violet wipe (200ms, `cubic-bezier(.2,.8,.2,1)`), and the chevron nudges 2px. Product buttons: background change over 120ms, no wipe. | Colour change only |
| **Scroll reveal** (landing) | Headings and cells fade up 12px, 60ms stagger, once. | None |
| **Run log streaming** (product) | While a run is `queued` or `running`, the run panel streams mono lines from Realtime updates on `review_runs`, one line per stage: `[03 filters] 4 findings · 18ms`. A blinking `▮` sits at the end of the last line. On `done`, the final line is `✓ done · 6 findings · 2 dropped by gate · 3.4s` in `--success`. | Lines appear without the cursor |
| **Status flip** (product) | When a finding's status changes, its badge cross-fades over 150ms. An accepted rewrite flashes `--success-bg` on the changed span in the editor for 600ms. | Instant |
| **Overlay draw** (image/PDF) | Bounding boxes draw their outlines over 300ms when the page loads. | Instant |

### 4.2 Rules

- Durations: 80ms (hover), 120–200ms (UI), up to 800ms (hero only). Nothing loops forever in the product except the cursor and spinner while work is actually in progress.
- No parallax, no bouncing springs, no confetti.
- Nothing flashes more than 3 times per second (WCAG 2.3.1).

---

## 5. Shared components

Put these in `apps/web/components/`. `ui/` holds shadcn primitives restyled to the tokens; `brand/` holds BrandLens-specific components.

| Component | Spec |
|---|---|
| **Button** | Variants: `primary` (white bg + ink text in dark mode, `--accent` fill on hover; in the product, primary = `--accent` fill + white), `secondary` (1px `--border-control`, transparent), `ghost`, `danger` (destructive only, e.g. archive), `link` (`--accent-soft` + `→`). Height 36px in the product and 44px on marketing. Loading state: inline spinner plus a verb ("Submitting…"). Disabled buttons that block a user action **must** carry a tooltip saying why (e.g. "Blockers need a fix or a person — confidence 0.54"). |
| **IdBadge** ⭐ | Mono 12–13px `--accent-soft` text, 1px `--border-strong` outline, 4px radius, 2px/6px padding, optional dimension icon. It's a `<button>` that opens a **SourcePopover**: the rule card or fact (code, title, summary, or body unless the viewer is an agency, version, source page link) or the WCAG criterion. Props: `code`, `kind: 'rule'\|'fact'\|'wcag'`, `id`. Format: `CL-03`, `F-112`, `WCAG 1.4.3`. |
| **SeverityBadge** | Per §2.4. In combined form it's `CL-03 · BLOCKER`: the IdBadge joined to the severity chip, which is the Round 1 signature. |
| **ConfidenceChip** | Mono `conf 0.96`. If < 0.6, shows `NEEDS HUMAN · 0.54` in `--warning`. The tooltip explains the source: "deterministic match = 1.00", or "retrieval 0.91 × agreement 1.0 (2 samples)" for blocker LLM findings. |
| **SourceTag** | `DETERMINISTIC` (muted mono) or `AI-ASSISTED` (lilac mono plus a sparkle-free `Bot` icon). Required on every finding (invariant 9, plan p.18). |
| **IntentCheckTag** | On rewrites. Pass: `✓ intent verified · 0.91` (`--success`). When a rewrite was dropped, the finding shows "No safe fix. The suggested rewrite changed your CTA" (reason from the worker). |
| **StateBadge** | Per §2.4. |
| **RiskMeter** | A 5-segment bar plus a mono number, e.g. `RISK 14`. Segments fill in `--warning`; any routed blocker uses `--blocker`. The label is always shown. |
| **RunPanel** | `--bg-code` panel with a mono header: `RUN 7f3c · groq · llama-3.3-70b · review@1`. Body: the streaming log (§4.1). Footer chips: `PII redacted 2`, `gate drops 2`, `LLM calls 1`, `3.4s`. If `degraded`, it shows the **DegradedBanner**. |
| **DegradedBanner** | Full-width `--warning-bg` bar with a `TriangleAlert` icon: "AI checks unavailable (rate limit). Showing deterministic findings only: facts, terms, claims lexicon, accessibility. Re-run when ready." Plus a `Re-run` button. |
| **FindingCard** ⭐ | §6.3 |
| **DiffView** | Side-by-side `− v2 / + v3` (≥lg) or unified (<lg). Removed text is struck through on `--blocker-bg`; added text is underlined on `--success-bg`. Colour is never the only cue: the `−` / `+` gutter markers are always shown. Each hunk lists the findings it resolved (`resolves CL-03, E-19`). |
| **CommentThread** | Anchored to a span, finding or region. Shows the author's display name and role chip, a relative time, and the body (markdown-lite). `@mention` renders as a lilac chip. Replies are indented with a 1px rail. |
| **DecisionBar** | A sticky bottom bar on the review page. It shows **only the actions `transition_content` allows** for this role and state (fetched, not guessed). Each action that needs a reason opens a dialog with a required textarea. Primary action is on the right. |
| **DataTable** | Mono uppercase headers with sort arrows (`aria-sort`). Row height 44px. The row hover is `--bg-hover`. The row's main link is underlined on hover and focus. Overflow menu `⋯` sits on the right. A sticky header. Pagination or infinite scroll with a "Load more" button (never scroll-jacking). |
| **SegmentedTabs** | 32px tall. Active tab is a `--accent` fill with white text. Shows counts: `Needs revision (2)`. Built on Radix Tabs, so arrow keys work. |
| **KpiTile** | Mono eyebrow, a 40px light number, a delta line, and an optional sparkline. |
| **EmptyState** | A pixel glyph (48px), an H3, one line of muted copy, and one primary action. |
| **Spinner** | A 14px rotating `⟳` line icon plus muted 13px text such as "Loading drafts…". **No skeleton shimmer.** |
| **Toast** (sonner) | `--bg-elevated`, 1px border, 6px radius, mono eyebrow (`SAVED`, `ERROR`). Errors persist until dismissed; success toasts last 4s. Announced via `aria-live`. |
| **IllustrativeDataPill** | Mono `ILLUSTRATIVE DATA` in a `--warning` outline. Shown on any insight computed from `simulated=true` events (P13). |
| **DemoRoleSwitcher** | §7.2. Only renders when `NEXT_PUBLIC_DEMO_MODE=true`. |
| **OverlayCanvas** | Image or PDF page with absolutely positioned bbox rectangles: 2px outline in the severity colour, plus a corner tab `CL-03 · BLOCKER`. Hover or focus on a box highlights its FindingCard, and vice versa. Each box is a focusable button with an `aria-label` like "Blocker CL-03 at page 2". |
| **WordCounter** | Mono `1,240 / 2,000 words`. Turns `--warning` at 90%. At 100% it turns `--blocker`, and submit is disabled with the reason (SPEC `MAX_WORDS`). |
| **CommandPalette** | `cmdk`. §7.4. |

---

## 6. Product screens

Every screen maps to a phase and, where one exists, a storyboard frame. `M/J` ownership follows `docs/PHASES.md`.

### 6.0 App shell (P02 / U0)

**Sidebar** (240px, `--bg-elevated`, hairline right border; collapsible to 56px icons, state remembered in a cookie)

1. The BrandLens wordmark.
2. **Workspace switcher.** Shows the org initial avatar, the org name (`PayWise`) and `⌃⌄`. The popover shows the role chip (`CREATOR`), the specialist kind if any, the theme toggle and "Sign out". In demo mode it also shows "Switch demo role" (§7.2). There's no billing or plans, because billing is a WON'T item (plan p.13).
3. Nav groups under mono eyebrows. Items are filtered by `can(role, action)`; hide items the user can't use rather than disabling them.
   - `WORK`
     - Drafts (`FileText`)
     - Review queue (`Inbox`, with a count badge)
   - `BRAND VAULT` (admin; read-only for manager and specialists where SPEC §2 allows)
     - Rule cards
     - Facts
     - Glossary
     - Campaigns
     - Assets
     - Guides
   - `GOVERNANCE`
     - Insights (admin, plus manager with limited access)
     - Audit log (manager, specialist, admin)
   - `WORKSPACE`
     - Settings
     - Services & AI use
4. **Active item:** a solid `--accent` fill, white text, 6px radius. **Hover:** `--bg-hover`.
5. **Bottom card** (dismissible per user). It depends on role:
   - **Admin:** "Guideline watchlist: 1 rule UNCLEAR", listing `TV-04 · GCS 60`, with a "Review examples →" link. It includes a tiny animated checklist whose bars fill in `--success`, showing the 3 pending examples.
   - **Creator or agency:** "Pre-check tips": intent fields, how citations work, "Learn more →" linking to the landing's "How it works".
6. **Footer links:**
   - `Status` (shows worker `/healthz` as `● worker ok` or `● worker down`, polled every 60s)
   - `GitHub`
   - `Collapse`

**Top bar** (56px, hairline bottom)
- **Left:** a breadcrumb with icons, e.g. `Drafts / Diwali SIP caption / v3`.
- **Right:**
  - `Search ⌘K`
  - `+ New draft`, hidden for specialist roles
  - a **run indicator**, shown only while any of the user's runs is active: `⟳ 1 check running`, which links to it
  - `?`, which opens a shortcuts and help sheet
  - the avatar menu

There's no Upgrade button.

**Theme toggle:** a 40px square in the account popover and at the bottom-right of marketing pages.

### 6.1 `/login` (P02)

- Split layout:
  - **Left (7/12):** `--bg` with the blueprint grid, the pixel lens and a hero line: "Sign in to check your next draft."
  - **Right (5/12):** a bordered form cell.
- **Form:**
  - Email and password fields with visible labels (not placeholders).
  - A primary "Sign in" button.
  - Errors are inline and announced. Wrong credentials show "Email or password is incorrect" (no hint about which).
- **Demo panel** (only when `DEMO_MODE`):
  - Mono eyebrow `TRY A DEMO ROLE`.
  - A 2×3 grid of role cards (Brand admin, Creator, Agency, Manager, Legal, Accessibility). Each has a pixel glyph, the role name and one line on what it can do (from SPEC §2), e.g. "Agency: submits drafts, sees rule summaries only."
  - One click signs in.
  - Footnote: "Demo data is fictional (PayWise)."

### 6.2 `/drafts`: overview (P08)

- **Page title** "Drafts", with a right-aligned ghost link "Invite your team" that shows a "not in this build" toast. Better: hide it unless implemented.
- **Onboarding card** (when the user has no content):
  - pixel `shield-check` glyph
  - title "Check your first draft"
  - copy: "Paste a caption, upload a DOCX, image or PDF, say who it's for, and get findings that cite your brand rules."
  - primary "+ New draft" and link "How citations work"
  - on the right, a muted mock of a FindingCard
- **SegmentedTabs:** `All (n)` · `Drafts` · `Needs revision` · `In review` · `Approved` · `Publish-ready`.
- **Search input** filtering by title or campaign.
- **DataTable columns:**
  - `TITLE` (format icon + underlined link)
  - `CAMPAIGN`
  - `CHANNEL` (grey block chip: `Instagram caption`)
  - `STATE` (StateBadge)
  - `OPEN` (mono counts `2B 1W 0S`, coloured, with an `aria-label` "2 blockers, 1 warning")
  - `RISK` (RiskMeter, small)
  - `UPDATED` (relative)
  - `⋯`
- Agencies only see their own rows (RLS); the UI doesn't need to filter.

### 6.3 `/drafts/new` and `/drafts/[id]`: editor and pre-check (P08, storyboard F02 → F03, mock-up p.12)

The layout is **three zones at ≥xl**; at `lg` the intent zone becomes a collapsible top bar.

```
┌ top bar ───────────────────────────────────────────────────────────────────────┐
│ Drafts / Diwali SIP caption / v2      [StateBadge]   [version ▾]  [Submit for check] │
├──────────────┬──────────────────────────────────────┬───────────────────────────┤
│ INTENT (280) │ EDITOR (flex)                        │ FINDINGS (400)            │
│ campaign     │ window header (mono, dark):          │ RunPanel (collapsible)    │
│ goal         │ ■■■ Instagram caption · Diwali SIP · │ filter: severity · dim    │
│ audience     │ v2 · LLM-assisted                    │ FindingCard × n           │
│ CTA          │ TipTap with highlight marks          │ (blockers → warnings →    │
│ channel      │ WordCounter                          │  suggestions)             │
│ notes        │                                      │ Resubmit bar (sticky)     │
│ alt text*    │                                      │                           │
└──────────────┴──────────────────────────────────────┴───────────────────────────┘
```

**Intent panel** (SPEC §5)
- Five required fields, each with a visible label and helper text, e.g. Audience: "Who is this for? e.g. first-time investors".
- `campaign` is a select showing the campaign status (`ACTIVE` / `ENDED`). Choosing an ended campaign shows a warning.
- `alt_text` appears only for image formats (P11).
- **Submit is disabled until intent is complete.** The tooltip lists the missing fields.
- This is Harshit's requirement, so the panel header reads `INTENT · REQUIRED`.

**Editor**
- TipTap. Highlights use the `finding` mark:
  - underline 2px in the severity colour plus a `--{severity}-bg` background
  - `cursor: pointer`
  - `aria-describedby` points to its FindingCard
- Focusing a FindingCard scrolls to its span and gives the span a `--focus` outline. Clicking a span focuses the card.
- Upload alternative: drop a DOCX, image or PDF onto the editor area, which switches to the OverlayCanvas viewer (P11/P12).
- The window header reproduces the p.12 mock-up: three tiny squares (the first vermilion), then mono metadata.

**FindingCard anatomy** (top to bottom, 1px border, 6px radius, `--bg-elevated`)
1. **Header row:**
   - `SeverityBadge` + title in 14px/500, e.g. "Unsupported regulatory claim"
   - on the right: `ConfidenceChip`, `SourceTag`
2. **Quote line:** mono-quoted `“14.2% assured annual returns”`, clickable to jump to the span.
3. **Explanation:** 14px `--text-muted`.
4. **Cites row:**
   - `Cites:` followed by IdBadges plus the title, e.g. `CL-03 No guaranteed/assured return language…` and `F-112 Flexi-Cap 3-yr historical CAGR…`
   - For agencies, the rule *summary* is shown, with a mono note `SUMMARY VIEW`.
   - Context bleed facts read: `Value belongs to campaign "Navratri Savings 2026" (E-11, ended)`.
5. **Fix block** (when there's a rewrite):
   - a `--bg-code` panel with a mono `FIX` eyebrow
   - an inline diff of the sentence
   - `IntentCheckTag`
6. **Actions row:**
   - `✓ Accept`, `✎ Edit`, `✕ Dismiss with reason`, `→ Route to Legal` (claims blockers only)
   - Accept is disabled, with a tooltip, when the finding is a blocker without a rewrite, or confidence < 0.6 ("Needs a person: confidence 0.54").
   - Dismiss opens a dialog: a radio card group with `Approved exception` / `Doesn't apply` / `AI is wrong`, an optional note, and a required choice. The copy under "Doesn't apply" says: "This tells your brand team the rule may be unclear."
7. **Resolved state:** collapsed to one line, e.g. `✓ fix accepted · G-07 · by you · 2m ago` in `--success`, or `✕ dismissed · doesn't apply`, or `→ routed to Legal`. It can be expanded.
8. **Footer meta** (mono 11px faint): `llm · llama-3.3-70b · review@1`, or `deterministic · filters/facts`.

**Defensive rule:** a finding with no `rule_id`, `fact_id` or `wcag_ref` is **not rendered** (invariant 1).

**Resubmit bar** (sticky at the bottom of the findings column)
- Shows `2 blockers left` plus the disabled "Resubmit".
- When all blockers are resolved or routed, it shows `✓ all blockers handled` and the "Resubmit" button is enabled.
- Resubmitting creates v n+1. Superseded findings show `SUPERSEDED` in faint text.

**Live states** (Realtime):
- `queued` → `running`: the RunPanel streams.
- `done`: findings animate in (60ms stagger, fade only).
- `degraded`: DegradedBanner.
- `failed`: an error panel with the `error_code`, "Try again", and the run ID for support.

### 6.4 `/review`: queue (P09, F04)

- **SegmentedTabs:** `For me (n)` · `Legal` · `Accessibility` · `Brand` · `All`. Visible tabs are filtered by role and `specialist_kind`.
- **DataTable columns:** `RISK` (RiskMeter; default sort descending, then age) · `TITLE` · `ROUTE` (`→ LEGAL`) · `OPEN` · `CREATOR` · `CAMPAIGN` · `WAITING` (relative age).
- **Each row expands** (or shows on hover) to the routing reason, mono: `rule: open CL-03 claim → Legal · brand + a11y: no open findings · approver queue skipped`. This is copied from storyboard F04.

### 6.5 `/review/[contentId]`: review (P09, F05)

- **Header:** title, StateBadge, RiskMeter, route chip, owner, version switcher (`v3 ▾`).
- **Body:**
  - **Left:** a read-only render with highlights, or the OverlayCanvas.
  - **Right tabs:** `Findings` · `Diff v2→v3` · `Comments (n)` · `Audit`.
    - Findings: the same FindingCards, read-only for reviewers except for the actions SPEC §2 allows.
    - Diff: DiffView, with "resolves …" annotations.
    - Comments: CommentThread. Select text to "Comment on selection".
    - Audit: a timeline of `audit_events` and `decisions`. Each entry has an actor, a role chip, a mono timestamp, `from → to`, and the reason.
- **DecisionBar** (sticky):
  - Approve. With open warnings, it opens an "Override with rationale" dialog that lists each open warning with a required reason field.
  - Request changes (reason).
  - Sign off (specialists; reason).
  - Mark publish-ready.
  - Archive (manager/admin, in the overflow menu, `danger` style, confirm dialog).
- **Publish-ready** shows the solid green `✓ PUBLISH-READY` badge plus "Audit trail ↗". BrandLens never publishes, so there's no "Publish" button anywhere, and the copy says: "Post it in your own channel."

### 6.6 `/vault`: brand vault (P05, F01)

Tabs (SegmentedTabs, URL-synced): `Rule cards` · `Facts` · `Glossary` · `Campaigns` · `Assets` · `Guides`.

**Guides**
- A drop zone (dashed `--border-control`, pixel `id-badge` glyph) for PDF/DOCX, plus a URL field.
- A list of guides with status chips: `UPLOADED` · `⟳ PARSING` · `✓ DRAFTED 9 cards` · `FAILED`, with the error shown.
- Live via Realtime.

**Rule cards**
- Grouped by dimension with mono section eyebrows, filtered by status (`Draft (9)` · `Approved` · `Archived`).
- **Card row:** IdBadge, title, severity, status, version `v2`, source `p.3`, and a lock icon if `never_send`.
- **Bulk bar** when drafts are selected: `Approve 3 rule cards` (the storyboard F01 copy).
- **Detail:** a right-side drawer, 560px, edited as a settings-style form:
  - code, dimension, severity (radio cards), title, summary (labelled "Shown to agencies"), body, do/don't examples as an editable list with `GUIDE` / `GENERATED` source tags, source page link, and a `Never send to AI` toggle with a lock icon and helper text
  - Approve / Save / Archive
  - Editing an approved card warns: "Saving creates v3 and re-embeds this rule."

**Facts**
- A DataTable with columns: `CODE` · `CAMPAIGN` (`ORG-WIDE` when null) · `KIND` · `STATEMENT` · `VALUE` (pretty mono JSON, collapsed to one line) · `DISCLAIMER` (icon if present) · `EXPIRES` (red `EXPIRED` chip if past) · `🔒` never-send.
- Inline edit opens the drawer.
- **CSV import:** a dialog with steps `Upload → Preview → Import`. The preview table marks invalid rows in red with row-level messages, e.g. "row 4: value_json is not valid JSON". Only valid rows import, and you can download an error report.

**Glossary:** a table with columns preferred (mono), variants as chips, banned (`BANNED` blocker chip), case-sensitive, note. Also has CSV import.

**Campaigns:** a table with name, dates, status chip (`ACTIVE` success, `PLANNED` muted, `ENDED` faint), and fact count. Create/edit in a drawer.

**Assets:**
- A grid of logo cards with checkerboard backgrounds, showing min width and clear-space ratio.
- A palette editor: swatches with name and hex (the hex input validates), and a max ΔE slider with its number.
- Reference images.

**Permissions:** non-admins see a read-only banner, "View only: brand admins edit the vault." Agencies never see `/vault`; it's absent from their nav and the route returns 404 for them.

### 6.7 `/insights`: governance (P13, F06, p.19)

- **KPI row** (4 KpiTiles): `AVG. BRAND-FIT SCORE` · `APPROVED ON FIRST REVIEW` · `MEDIAN TIME TO APPROVAL` · `BLOCKERS CAUGHT THIS WEEK`.
- **Two columns:**
  - **Top recurring issues · 30 days:** a horizontal bar chart (Recharts). Bars are `--accent-soft` with the value at the bar end, plus an IdBadge per row. There's a "View as table" toggle (accessible data fallback).
  - **Guideline watchlist:** a DataTable with columns `RULE` (IdBadge + title) · `N` · `GCS` (mono number + mini bar) · `STATUS`. Sorted by GCS ascending. Rows with N<10 read `insufficient data`.
- **UNCLEAR row → drawer** "Improve TV-04":
  - the GCS breakdown (three term bars: Dismissal 0.45, Override 0.35, LowConf 0.20)
  - recent dismissed quotes (redacted)
  - 3 generated do/don't examples, each with Approve or Reject
  - Approving shows the before and after: "TV-04 v1 → v2 · re-embedded ✓". This is Round 2 improvement #3.
- `IllustrativeDataPill` in the page header whenever simulated events contribute.
- **Managers** see the team KPIs only (the watchlist is hidden, per SPEC §2 footnote 5).

### 6.8 `/audit` (P09)

A global audit log table. Columns: `TIME` (mono) · `ACTOR` + role · `CONTENT` · `EVENT` (`in_review → approved`) · `REASON`. Filter by content, actor or event type. Export CSV.

### 6.9 `/settings` (P02, P09, P13)

A settings-page pattern: a content column of bordered section cards, each with a title, a description and a control on the right. A sticky anchor nav sits on the right at ≥lg.

**Sections**
- **Profile:** display name.
- **Appearance:** theme radio cards (`Dark` · `Light` · `System`), each with a violet border and dot when selected.
- **Notifications:**
  - Discord status: `● Connected` if `DISCORD_WEBHOOK_URL` is set, or `Not configured`. **Never show the URL.**
  - A "Send test message" button (admin).
  - Email status: `Disabled (no RESEND_API_KEY)` or `Enabled`.
- **Organisation** (admin): members table with role chips. Inviting is out of scope, so there's no invite button.
- **Demo** (only in demo mode): "Reset demo data" is shown as a disabled button with the instruction `scripts/reset_demo.sh` (it's run by the team, not from the UI).

### 6.10 `/settings/ai-use`: Services & AI use (P02 → P13, SPEC §18)

- A page of bordered cells, one per external service: **Groq**, **Gemini**, **Langfuse Cloud**, **Supabase**, **Vercel**, **Worker host**, **Discord**, **Resend**.
- Each cell shows: name, purpose, `RECEIVES` (e.g. "redacted draft chunk + top-k rule snippets"), `RETENTION / TRAINING` stance, and a link to the provider's policy.
- **Gemini cell:** a `--warning` note, "Free tier: prompts may be used to improve Google products. The demo uses fictional data only."
- **"Models in use":** read from the latest `review_runs`, e.g. `groq · llama-3.3-70b-versatile · review@1`.
- **"How BrandLens uses AI":**
  - the 6 stages with `LOCAL` / `EXTERNAL` chips
  - "LLM findings carry an AI-ASSISTED label"
  - "No uncited finding is ever shown"
  - "Nothing is published automatically"
- **"Quality"** (from P14): a per-dimension precision/recall table read from the committed `eval/report.json`, with the golden-set date and size. Any dimension clamped to suggestion shows `CAPPED · precision 0.82`.

### 6.11 Image and PDF review (P11, P12)

- **Image:** the OverlayCanvas fills the editor zone, with zoom controls (`−` `100%` `+`, fit) and an overlay toggle `Show boxes`.
  - Contrast findings show the measured ratio in the card: `2.9 : 1 (needs 4.5 : 1) · WCAG 1.4.3`, with two swatches (text and background) and their hex values.
  - ΔE findings show the nearest palette swatch next to the found colour, plus `ΔE 14.2 > 10`.
- **PDF:**
  - a thumbnail rail on the left (80px, with page numbers and a badge with counts per page)
  - the page canvas in the centre
  - findings on the right, filtered to the current page, with a toggle for "All pages"
  - Hidden-text findings get the explanation "Hidden or near-invisible text (3pt, white on white). It may conceal a claim or instructions."
- Uploading a PDF over 40 pages is rejected up front: "This PDF has 52 pages; the limit is 40."

### 6.12 ⌘K command palette

- Opens with ⌘K / Ctrl+K. The top bar becomes a full-width input: "Search drafts, rule codes, facts, campaigns…", with a `× Close · ESC` button.
- **Groups:** `DRAFTS` · `RULES` (search by code, e.g. typing `CL-03` jumps straight to the card) · `FACTS` · `CAMPAIGNS` · `ACTIONS` (New draft, Toggle theme, Switch demo role).
- **Empty state:** a central violet magnifier (pixel lens) with the six dimension icons drifting slowly around it at 20% opacity. Static under reduced motion.

---

## 7. Cross-cutting UI behaviours

### 7.1 Role-aware rendering

- The UI gates with `lib/workflow/permissions.ts` `can()`. RLS is the enforcement.
- Hidden beats disabled for whole features (nav items, tabs).
- Disabled-with-reason beats hidden for actions inside a workflow the user can see. The user should learn *why* (e.g. "Only Legal can sign off claims").

### 7.2 Demo mode (`NEXT_PUBLIC_DEMO_MODE=true`)

- A thin `--accent-deep` strip at the very top of the app: `DEMO · PayWise (fictional) · signed in as Creator · Switch role ▾`.
- The switcher lists the six demo roles with a one-line capability each. Switching signs out and back in via a server action, then shows a toast `Now viewing as Legal`.
- When demo mode is false, nothing demo-related renders anywhere.

### 7.3 Copy and microcopy

- Plain, short, active voice. Name the rule ID instead of saying "on-brand"; this is Shaurya's pain point.
- Error messages say what happened plus what to do, e.g. "Couldn't reach the AI provider. Showing deterministic findings. Re-run in a minute."
- **No emoji in the app UI** (Discord messages per SPEC §15 are external and exempt).
- Numbers and IDs in mono. Times are relative in tables and absolute (IST) in the audit log and tooltips.

### 7.4 Keyboard

| Key | Action |
|---|---|
| `⌘K` | Command palette |
| `?` | Shortcuts sheet |
| `g d` / `g r` / `g v` / `g i` | Go to Drafts / Review / Vault / Insights |
| `j` / `k` | Next / previous finding (editor, review) |
| `a` / `e` / `x` | Accept / edit / dismiss the focused finding, when allowed |
| `Esc` | Close the drawer, dialog or palette |

Every shortcut has a clickable equivalent. Single-key shortcuts don't fire inside text inputs, and can be turned off in settings (WCAG 2.1.4).

### 7.5 Accessibility (non-negotiable; usability is 10 points, and the product audits accessibility)

- **WCAG 2.2 AA** across the app and landing. Contrast is per §2.3, and the token contrast test is enforced in CI.
- **Focus:** a visible 2px `--focus` ring with 2px offset on every interactive element. The sticky top bar and DecisionBar must not hide the focused element (WCAG 2.4.11); add `scroll-padding`.
- Colour is never the only signal: severity, state, diff and risk all carry text or symbols.
- **Live regions:**
  - The run status and finding counts are announced politely: "Check finished: 3 blockers, 1 warning."
  - Errors are announced assertively.
- Dialogs and drawers trap focus and return it to the trigger. A skip link "Skip to content" is on every page.
- Every form input has a visible label. Errors are linked via `aria-describedby`.
- The chart has a table alternative. Overlay boxes are focusable buttons with labels.
- `prefers-reduced-motion` is honoured (§4).
- Target sizes are at least 24px.
- **Gate:** Playwright plus `@axe-core/playwright` on `/`, `/login`, `/drafts`, `/drafts/[id]`, `/review`, `/review/[id]`, `/vault`, `/insights` and `/settings/ai-use`, with **zero serious or critical** violations, in both themes.

---

## 8. Public landing page `/` (route group `app/(marketing)`) · phase U1

The landing page is for judges and anyone opening the deployed link. **Everything on it must be true.** There are no invented customers, logos or testimonials, and every stat has a footnoted source from the Round 1 references (plan p.27).

1. **Announcement bar** (36px, `--accent-deep`):
   - "Round 2 build · Inkloom AI brand-governance problem statement · **Try the live demo →**"
   - Dismissible (cookie).
2. **Sticky nav** (64px, bottom hairline):
   - Wordmark, then the links `Product ▾` · `How it works` · `Responsible AI` · `Insights` · `GitHub ↗`.
   - On the right: the ghost link "Read the plan" (`docs/plan.pdf`) and the flush-right full-height block button **"Open app ›"**. It's white with ink text and fills violet on hover, with a 3px violet bar underneath. It goes to `/drafts` when signed in and to `/login` otherwise.
   - **`Product ▾` mega-menu** (2 columns):
     - "Six check dimensions ›" with mono eyebrow `CHECKS`, listing Tone, Terms, Facts, Claims, Visual and Accessibility. Visual is tagged `NEW` (mint outline) once P11 ships.
     - "Workflow ›" with eyebrow `REVIEW`, listing Intent capture, Risk routing, Version diff, Audit trail, and the Guideline Clarity Score (tagged `NEW`).
   - Hover gets the violet block highlight.
3. **Hero** (7/5 split, blueprint grid, `--hero-glow` top-left):
   - **Left:**
     - mono eyebrow `PRE-PUBLICATION BRAND GOVERNANCE`
     - H1 "Every draft, checked against your **{typewriter word}**"
     - subhead: "BrandLens checks each post, page, image and deck against your approved rules, facts and assets, and every flag cites the rule or fact it was checked against. People approve. BrandLens never publishes."
     - CTAs: primary **"Try the demo ›"** (`/login`) and secondary **"How it works"** (anchor)
   - **Right:** the pipeline loop (§4.1), ending in the hero finding chip stack from the Round 1 cover: `CL-03 · Assured returns`, `E-19 · Venue mismatch`, `G-07 · Product casing`, `WCAG 1.4.3 · 2.9 : 1`, with a mono caption `DRAFT v2 · 4 FINDINGS`. Pixel sprites flicker at the card's lower-left.
   - **Bottom of the hero:** mono eyebrow `BUILT ON OPEN, AUDITABLE PARTS`, then a row of **text wordmarks in mono at 60% opacity**: Next.js · Supabase · pgvector · FastAPI · PyMuPDF · OpenCV · bge-small · Groq · Gemini. There are no customer logos (we have none).
4. **"Catch it before it ships"** H2, with the gradient on "before". Below it, a 2-column cell:
   - **Left:** the **multicolour dimension sentence**: "Checks **tone of voice** (lilac), **product terms** (mint), **dates, venues and fees** (soft yellow `#F5D76E`), **return claims** (soft orange `#FFA36B`), **logos and palette** (violet text-safe `#C7A8FF`), and **contrast and alt text** (sky `#8CC8FF`)". Lower lines fade.
   - **Right:** the **context-bleed card**. It reproduces plan p.5 "Real failure trace" as a mini UI: the draft line "…closes Oct 18 at Hall B, Chandigarh", the Fact Vault match, then `BLOCKER · E-19 · value belongs to Navratri Savings 2026`, with the caption "Caught at Stage 3, with no AI judgement needed."
5. **Feature cells**, 2 up, each with a `--bg-code` snippet panel and "Docs →" (README anchors):
   - **Citation gate:** shows a gate log with `✓ kept CL-03 (retrieved, dim=claims, quote found)` and `✕ dropped X-99 (not retrieved)`.
   - **Intent-verified rewrites:** shows the original vs the rewrite, plus `cosine 0.91 ≥ 0.82 · CTA "Register now" kept · re-check ✓ · 9ms`.
   - **Risk-routed review:** shows a mini queue with risk meters and the `→ LEGAL` route.
   - **Guideline Clarity Score:** shows the watchlist mini-table with the TV-04 UNCLEAR row.
6. **Guarantees band:** 4 big mono numbers on hairline cells:
   - `100%` rule-cited flags
   - `0` unapproved auto-publishes
   - `<15 s` P95 text analysis
   - `<15 ms` intent verification

   Until P14 measures them, the latter two carry a `TARGET` chip. After P14 they show measured values from `eval/report.json` with a `MEASURED · {date}` chip.
7. **"Why manual review fails"** evidence band: 4 stat cells, each with a mono source footnote:
   - **98%** of ads ASCI scrutinised in FY 2024–25 needed modification (ASCI)
   - **79.1%** of top home pages have low-contrast text (WebAIM Million 2025)
   - **49%** of marketers cite tone-of-voice issues with AI content (Kaltura 2023, n=500)
   - **72–96 h** typical turnaround per post (our 4 discovery interviews)
8. **"What we heard" carousel.** It replaces the testimonial component, keeping the mechanics: tabs, crossfade, auto-rotate every 6s, and pause on hover or focus.
   - **Tabs:** `AGENCY` · `STUDENT ORG` · `CULTURAL SOCIETY` · `SMB CREATOR`.
   - **Each slide:** a 22px light **paraphrase of the failure**, taken from plan p.6 and p.23, plus the requirement it produced. Attribution is a mono violet chip **by role and city only**, e.g. `AGENCY FOUNDER · MOHALI`.
   - Use interviewees' names or verbatim quotes only if the team confirms consent. Log this in PROGRESS → Open questions.
   - Label the band: "From our four discovery interviews, October 2026".
9. **Responsible design grid** (3×2, pixel glyphs):
   - **Minimal context to the AI:** redacted chunk + top-k snippets only
   - **Local embeddings:** vault text embedded inside our worker
   - **Never-send vault items**
   - **Row-level isolation per organisation**
   - **Human sign-off:** no auto-publish
   - **AI-use disclosure:** every provider named

   CTAs below: primary "Try the demo ›", secondary "Services & AI use" (public `/ai-use`, mirroring §6.10 without live model data).
10. **Final CTA band:** H2 "Stop line-editing. Start citing." plus buttons and a pixel composition.
11. **Footer:**
    - Mono column headers:
      - `PRODUCT` (Checks, Workflow, Insights)
      - `TRUST` (Responsible AI, Services & AI use, Security notes)
      - `BUILD` (GitHub, README, Eval report, Licence AGPL-3.0)
      - `TEAM` (Maanit Gupta · AI & backend, Jagpreet Singh · Product & UX, SRMIST)
    - Links are `--text-faint` and turn white on hover. A large pixel composition bleeds off the bottom-left.
    - Bottom row: "Demo brand PayWise and its data are fictional. Product names are trademarks of their owners." on the left and "© BrandLens 2026" on the right.

**Floating toast** (signed-in users only, top-right under the nav): "Skip this page next time?" with **"Always open app ›"** and ×. This sets a cookie `bl_skip_landing=1`, which makes `/` redirect to `/drafts`. It's undoable in Settings → Appearance.

**Theme toggle:** fixed bottom-right, 40px square, bordered, moon/sun icon.

**Performance:**
- Landing LCP < 2.5s on Vercel.
- Sprites and the typewriter are client components loaded after the hero text.
- The hero text is server-rendered, showing the first word without animation, so it's never blank.

---

## 9. Decision → UI traceability

Every development decision so far has a visible home in the UI. If you add a decision to PROGRESS, add a row here.

| Decision / invariant (source) | Where the user sees it |
|---|---|
| Citation gate: no uncited finding (Inv. 1, SPEC §8) | IdBadge on every FindingCard; UI refuses to render uncited findings; RunPanel `gate drops n`; landing citation-gate cell; guarantees band `100%` |
| LLM untrusted, quotes matched locally (Inv. 2) | Quote line jumps to the exact span; prompt-injection test draft in the demo shows the finding still caught |
| Deterministic first (Inv. 3) | `DETERMINISTIC` SourceTag + `conf 1.00`; context-bleed card "no AI judgement needed" |
| One LLM call per draft; 2nd sample only for blockers (Inv. 4, deviation) | RunPanel chip `LLM calls 1` (or 2 with a "blocker confirmation" tooltip); ConfidenceChip tooltip "agreement 1.0 (2 samples)" |
| Minimal context, PII redaction, never-send (Inv. 5, SPEC §6) | RunPanel `PII redacted n`; vault `Never send to AI` lock toggle; Services & AI use "Receives" column |
| Humans decide; confidence < 0.6; overrides need a reason (Inv. 6) | Disabled Accept with reason; `NEEDS HUMAN` chip; Override dialog with required reasons; no Publish button anywhere |
| All transitions via `transition_content` + audit (Inv. 7) | DecisionBar shows only allowed actions; Audit tab and `/audit`; reason dialogs |
| RLS; agencies see summaries (Inv. 8, SPEC §2) | `SUMMARY VIEW` note; agency nav lacks Vault, Insights, Audit; read-only vault banner |
| `model_version` / `prompt_version` / `source` on findings (Inv. 9) | FindingCard footer meta; RunPanel header; AI-use "Models in use" |
| Precision gate 85% (Inv. 10, SPEC §17) | `CAPPED · precision 0.82` note on clamped dimensions (FindingCard tooltip + AI-use Quality table); guarantees band `MEASURED` |
| Groq primary, Gemini fallback (deviation) | RunPanel provider label; AI-use cells; degraded banner when both fail |
| Free-tier rate limits, degraded mode (CLAUDE.md errors) | DegradedBanner + Re-run; run failure panel with `error_code` |
| Gemini free-tier training caveat (deviation) | AI-use Gemini warning note; login footnote "Demo data is fictional" |
| Langfuse Cloud (deviation) | AI-use cell (receives redacted traces); admin-only "Trace ↗" link in the RunPanel header when `ENV=development` |
| Email/password + demo role switcher, no OAuth (deviation) | `/login` form + demo panel; demo strip and switcher |
| Discord + optional Resend (deviation) | Settings → Notifications status + "Send test"; no URL shown |
| Next.js 16, Tailwind v4, shadcn, TipTap, Recharts | Implementation of everything above (§10) |
| Intent required (SPEC §5, Harshit) | `INTENT · REQUIRED` panel; Submit disabled with the list of missing fields |
| Intent-verified rewrites, cosine 0.82 (SPEC §9) | IntentCheckTag `✓ intent verified · 0.91`; "No safe fix…" when dropped |
| Campaign-scoped facts and context bleed (SPEC §6.1, Pallavi) | Campaign select with status; bleed explanation naming the other campaign; landing context-bleed card |
| Fact expiry | `EXPIRED` chip in Facts; warning finding |
| Required disclaimer (F-112) | Fix block shows the disclaimer inserted; facts table disclaimer icon |
| State machine (SPEC §4) | StateBadge everywhere; Drafts tabs; Resubmit gating bar |
| Risk score and routing (SPEC §10, Harshit) | RiskMeter; queue sorted by risk; routing reason line; `→ LEGAL` chip |
| Versions immutable, superseded findings | Version switcher; `SUPERSEDED` label; DiffView "resolves …" |
| Dismiss reasons feed GCS (SPEC §7, §11) | Dismiss dialog radio cards with "tells your brand team…" copy; GCS breakdown drawer |
| GCS, UNCLEAR, example generation (SPEC §11, Devansh) | `/insights` watchlist, Improve drawer, before→after version bump; sidebar watchlist card |
| Simulated activity data (P13) | `ILLUSTRATIVE DATA` pill |
| Rule extraction from guides (SPEC §12) | Guides tab live status; draft cards with source page; bulk approve |
| CSV import for facts and glossary | Import dialog with preview and row errors |
| MAX_WORDS 2,000 / PDF 40 pages (SPEC §14) | WordCounter; PDF upload rejection message |
| Hidden text in PDFs | Its own finding with explanation; OverlayCanvas box |
| WCAG contrast / ΔE / logo (P11) | Ratio + swatches in the card; ΔE swatch comparison; logo box overlay |
| Rate limit on submit (P15) | Toast "You've submitted 10 checks in a minute. Try again in 20s." |
| P95 < 15s target | RunPanel total time; guarantees band |
| AGPL-3.0, licences, AI disclosure (General Rules 6–7) | Footer licence link; README; AI-use page |
| Worker health | Sidebar `● worker ok` |
| Never auto-publish | Publish-ready badge + "Post it in your own channel"; no Publish control |

---

## 10. Implementation notes

**Packages to add** (log each in PROGRESS → Dependencies with its licence):
- `geist` (OFL)
- `motion` (MIT)
- `cmdk` (MIT)
- `@axe-core/playwright` (MPL-2.0)
- `@tiptap/*` (MIT)
- `recharts` (MIT)
- `sonner` (MIT)
- `lucide-react` (ISC)

**File layout**

```
app/(marketing)/page.tsx, ai-use/page.tsx, layout.tsx
app/(auth)/login/page.tsx
app/(app)/layout.tsx  drafts/  review/  vault/  insights/  audit/  settings/
components/ui/          shadcn primitives restyled (radius via --radius tokens: 6px product)
components/brand/       wordmark, pixel-glyphs, id-badge, severity-badge, state-badge, confidence-chip,
                        source-tag, intent-check-tag, risk-meter, run-panel, degraded-banner,
                        finding-card, diff-view, comment-thread, decision-bar, overlay-canvas,
                        word-counter, demo-role-switcher, illustrative-pill, kpi-tile
components/marketing/   announcement-bar, nav, mega-menu, hero-typewriter, pipeline-loop,
                        pixel-sprites, dimension-sentence, bleed-card, feature-cell,
                        guarantees-band, evidence-band, heard-carousel, trust-grid, footer, skip-toast
components/motion/      use-typewriter.ts, use-scramble.ts, reveal.tsx, use-reduced-motion.ts
lib/design/tokens.ts    TS mirror of CSS tokens (used by charts, overlays, contrast test)
```

**Rules**
- Use tokens only. A hex literal outside `globals.css` and `tokens.ts` is a lint error (add an ESLint `no-restricted-syntax` rule for `#[0-9a-f]{3,8}` in `.tsx`).
- Recharts gets its colours from `tokens.ts` and has `role="img"` plus the table fallback.
- Build the dev route `/dev/kitchen-sink` (only when `NODE_ENV !== 'production'`) rendering every component in §5 in both themes. It's the visual QA page and the axe target for components.

---

## 11. Loading, empty, error, permission states

Each data view must implement all five. Verify in the kitchen sink and e2e.

| State | Pattern |
|---|---|
| Loading | Spinner + "Loading {thing}…" centred in the region. No skeletons. If it takes over 10s, add "Still working…" |
| Empty | EmptyState with a pixel glyph and one action |
| Error | Bordered `--danger` outline panel: what failed, a "Try again" button, and the request or run ID in mono |
| Forbidden | "You don't have access to this. {role} can't {action}." plus a link back. Never a blank page |
| Degraded (runs) | DegradedBanner |

---

## 12. UI build phases

These sit **alongside** `docs/PHASES.md`. UI work inside the existing J-owned phases follows this file.

| ID | Phase | Owner | Depends on | Notes |
|---|---|---|---|---|
| **U0** | Design-system foundation: tokens (both themes) + contrast test, fonts, restyled shadcn primitives, all §5 brand components with mock data, motion hooks, pixel glyphs and sprites, app shell (sidebar, top bar, ⌘K skeleton, theme toggle, demo strip), `/dev/kitchen-sink`, axe on the kitchen sink | J | P00 | Takes over P02 task 1–2 ("tokens / restyle"). P02 then wires auth, data and permissions into this shell. |
| **U1** | Public landing `/` + public `/ai-use` + skip toast (§8) | J | U0 | No backend needed. The guarantees band reads `eval/report.json` if present, else shows `TARGET`. |
| P02 | Auth + demo switcher, using U0 components | J | P01, U0 | |
| P05 | Vault UI per §6.6 | J | P02, P04 | |
| P08 | Editor + findings per §6.2–6.3 | J | P05, P07 | |
| P09 | Review, diff, comments, audit, settings notifications per §6.4–6.5, §6.8–6.9 | J+M | P08 | |
| P11/P12 | OverlayCanvas, image and PDF views per §6.11 | M+J | — | |
| P13 | Insights per §6.7 | J+M | P09 | |
| **U2** | UI polish and audit: run axe on every route in both themes; keyboard walkthrough; reduced-motion pass; copy pass against §7.3; landing performance; fix everything. Feeds P15. | J | P13 | |

**Acceptance for every UI phase**
- [x] `make check` is green, including the token contrast test.
- [x] axe reports zero serious or critical issues on the touched routes, in dark and light.
- [x] Every new screen implements the §11 states.
- [x] Keyboard-only walkthrough of the touched flow works.
- [x] Reduced motion is respected.
- [x] Screenshots of touched screens, dark and light, saved to `docs/screens/<phase>/` (Playwright `page.screenshot`), for the README and the judges.

---

## 13. Implementation status (2026-10-27, on `main`)

Every screen in §6, the landing page in §8 and the shared components in §5 ship on `main`. U0–U2 were built on `ui/*` branches, briefly reverted, then restored on top of P15 hardening. The U2 follow-ups are closed:

| §     | Item | Status |
|---|---|---|
| 6.5   | Sticky DecisionBar with one dialog per action: "Override with rationale" (a required reason per open warning), Sign off, Request changes, Send to specialist, Archive in the overflow menu behind a confirm | Done (`components/review/decision-bar.tsx`, `components/brand/modal.tsx`) |
| 6.3, 6.5 | Version switcher `v3 ▾` in the draft and review headers. Older versions open read-only at `/review/[id]?v=N`; decisions apply only to the latest version | Done (`components/brand/version-switcher.tsx`) |
| 6.7   | "View as table" toggle on Top recurring issues. In chart view the table stays in the accessibility tree | Done (`components/insights/issues-view.tsx`) |
| 6.11  | Contrast and ΔE swatches on image and PDF findings, parsed from the worker's fixed explanation format; hex values and numbers are always written out | Done (`lib/drafts/swatches.ts`, `components/brand/colour-swatches.tsx`) |
| 6.6, 11 | Palette empty state ("No palette yet" + Add palette) instead of an editor pre-filled with a colour the org never chose | Done (`PaletteSection` in `components/vault/asset-forms.tsx`) |

**Gates on this state:** `make check` green; `e2e/ui.spec.ts` axe 38/38 (19 routes × 2 themes); `keyboard.spec.ts` and `a11y.spec.ts` green; core loop F02–F05, review and drafts e2e green locally.

**Remaining deliberate deviations** (logged in PROGRESS → Decisions):
- CSV import stays all-or-nothing. §6.6 says "only valid rows import", but the P04 decision wins on behaviour; invalid rows block the import and can be downloaded as a report.
- The `/dev/kitchen-sink` reduced-motion check runs in dev only, because the route returns 404 in production builds (§10).

