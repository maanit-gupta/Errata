# Errata (formerly BrandLens) UI/UX redesign: study notes

> Read-only study for the redesign on branch `UI/UX_jagpreet` (2026-10-28). Nothing in `apps/web` has changed yet. This file lists what exists, what a redesign must not break, and a proposed phase plan. Sources are cited inline as file paths.

---

## 1. Project summary

Errata (then called BrandLens) checks marketing drafts against an organisation's approved brand rules **before** they are published. A brand admin turns a PDF brand guide into **rule cards** (`TV-04`, `CL-03`, `G-07`…) and keeps a **Fact Vault** of campaign facts (`F-112`, `E-19`), a glossary, campaigns and assets (logos, palette). A creator writes or uploads a draft (text, DOCX, image or PDF), states its **intent** (goal, audience, CTA, channel, campaign) and submits it. A worker runs a six-stage pipeline: ingest, protect (redaction), deterministic filters, retrieval, one LLM call, and a **citation gate**. Every finding the user sees cites the rule, fact or WCAG criterion it was checked against. People decide: Errata never publishes.

**Roles** (SPEC §2): brand admin (owns the vault, sees everything), creator, agency creator (sees rule *summaries* only, own content only), manager (approves or requests changes, team insights), and specialists (Legal, Accessibility) who sign off content routed to them.

**Core loop** (storyboard F01–F06, `docs/DEMO.md`):
1. **F01** Admin uploads the guide, reviews drafted rule cards and approves them.
2. **F02–F03** Creator creates a draft, fills intent, submits. Findings stream in with highlights, citations, confidence and suggested rewrites. They accept, edit, dismiss (with a reason) or route each one, then resubmit.
3. **F04** The draft is routed by risk: open claims go straight to Legal, accessibility to A11y, clean drafts to the manager.
4. **F05** The reviewer reads the diff, citations and comments, then approves (with a reason per open warning), signs off, or requests changes. The owner or manager marks it publish-ready. Every transition is audited.
5. **F06** Insights show a Guideline Clarity Score per rule. An UNCLEAR rule gets generated do/don't examples that an admin approves, which creates the next version of the card.

---

## 2. Current UI inventory

Stack: Next.js 16.4.3 App Router, React 19.3, Tailwind v4, shadcn `base-nova` on `@base-ui/react` 1.9, `motion` 14, `cmdk`, `sonner`, TipTap 3, Recharts 3.2, Geist fonts, lucide-react. ~10.1k lines in `apps/web/components`.

### 2.1 Routes

| Route | File | Who | Main components |
|---|---|---|---|
| `/` | `app/(marketing)/page.tsx` + `layout.tsx` | public | AnnouncementBar, MarketingNav (mega-menu), HeroStage (HeroHeadline typewriter + PipelineLoop), PixelSprites, "Built on" row, Section ×5, DimensionSentence, BleedCard, FeatureCells, GuaranteesBand, EvidenceBand, HeardCarousel, TrustGrid, final CTA + PixelComposition, MarketingFooter, SkipToast, fixed ThemeToggle |
| `/ai-use` | `app/(marketing)/ai-use/page.tsx` | public | ServiceCells, HowAiWorks, QualityTable (`components/ai-use/disclosure.tsx`) |
| `/login` | `app/(auth)/login/page.tsx`, `login-form.tsx` | public | 7/5 split with blueprint grid + PixelGlyph + sample CL-03 chip; LoginForm; demo role cards (6) |
| `/no-access` | `app/(auth)/no-access/page.tsx` | signed in, no org | EmptyState |
| (app shell) | `app/(app)/layout.tsx` → `components/shell/app-shell.tsx` | signed in | DemoStrip, AppSidebar (AccountMenu, nav groups, bottom tip/watchlist card, WorkerStatus, GitHub, collapse), TopBar (breadcrumb, run indicator, Search ⌘K, New draft, `?`, avatar AccountMenu), CommandPalette, Shortcuts sheet, FlashToast; `loading.tsx` (Spinner), `error.tsx` (ErrorPanel) |
| `/drafts` | `app/(app)/drafts/page.tsx` | creator, agency, manager, admin | PageHeader, Onboarding (inline), DraftsTable (SegmentedTabs + search + DataTable) |
| `/drafts/new` | `drafts/new/page.tsx` | same | PageHeader, NewDraftForm |
| `/drafts/[id]` | `drafts/[id]/page.tsx` | owner (+ others read-only) | DraftWorkspace: header (StateBadge, VersionSwitcher, Submit), intent panel, editor window (TipTap / ImageFindings / PdfFindings, WordCounter, file input), findings column (DegradedBanner, RunPanel, ErrorPanel, FindingCard list, EmptyState, resubmit bar) |
| `/review` | `review/page.tsx` | manager, specialist, admin | PageHeader, ReviewQueue (SegmentedTabs + DataTable + RiskMeter) |
| `/review/[contentId]` | `review/[contentId]/page.tsx` | reviewers, owner | header (StateBadge, RiskMeter, route chip, VersionSwitcher, routing reason), read-only window (HighlightedText / Pdf / Image), ReviewTabs (ReviewFindings, VersionDiff, Comments, inline audit list `#audit`), sticky Decision panel (DecisionBar + Modal ×5 + overflow Menu) |
| `/vault?tab=` | `vault/page.tsx` | brand admin | PageHeader, StatusTabs (URL tabs) → RuleCardsTab (RuleCardList, RuleCardPanel drawer, bulk bar), FactsTab (FactsTable + drawer, CsvImport), GlossaryTab (+CsvImport), CampaignsTab (CampaignsView + CampaignForm drawer), AssetsTab (AssetForms, PaletteSection), GuidesTab (GuideUpload + table) |
| `/insights` | `insights/page.tsx` | admin, manager (limited) | PageHeader + IllustrativeDataPill, KpiTile ×4, IssuesView (IssuesChart + table toggle), Watchlist (table + native `<dialog>` drawer) |
| `/audit` | `audit/page.tsx` | manager, specialist, admin | PageHeader, AuditLog (filters + DataTable + CSV export) |
| `/settings` | `settings/page.tsx` | all | PageHeader, local `Cell` sections, ThemeRadioCards, Landing/Shortcuts toggles, DiscordTestButton, members list, disabled Demo reset, anchor nav |
| `/settings/ai-use` | `settings/ai-use/page.tsx` | all | same disclosure components + "Models in use" table |
| `/dev/kitchen-sink` | `app/dev/kitchen-sink/*` | dev only (404 in prod) | every brand component, both themes |

### 2.2 Shared vs one-off

**Shared across routes**
- Primitives (`components/ui`): `Button` (8 variants), `Input` + `fieldClass` (native select/textarea), `Label`, `Hint` (Base UI Tooltip), `DropdownMenu` (Base UI Menu, used only by DecisionBar).
- Brand (`components/brand`): `PageHeader` (all product pages), `EmptyState`, `Spinner`, `ErrorPanel`, `Forbidden` (via `components/no-access.tsx`), `SegmentedTabs` (drafts, review queue, review tabs, vault), `DataTable` (drafts, queue, audit, facts, campaigns), `Drawer` (rule card, fact, campaign), `StateBadge`, `SeverityBadge`, `IdBadge`/`IdCode`, `DimensionLabel`, `RiskMeter`, `VersionSwitcher`, `ThemeToggle`, `Wordmark`, `PixelGlyph`.
- Feature: `FindingCard` + `ImageFindings` + `PdfFindings` (draft workspace and review page), `RealtimeRefresh` (lives in `components/vault/` but used by drafts, review, insights), `disclosure.tsx` (both AI-use pages).

**One-off**: everything in `components/marketing`, `LoginForm`, `NewDraftForm`, `DraftsTable`, `DraftWorkspace`, `RunPanel`, `DegradedBanner`, `WordCounter`, `ConfidenceChip`, `SourceTag`, `IntentCheckTag`, `ColourSwatches` (all inside FindingCard/workspace), `ReviewQueue`, `DecisionBar`, `Modal` (DecisionBar only), `Comments`, `VersionDiff`, `HighlightedText`, `AuditLog`, all of `components/vault`, all of `components/insights`, `KpiTile`, `IllustrativeDataPill`, `settings/client.tsx`.

**Unused**: `components/ui/card.tsx`, `components/ui/separator.tsx`.

**Inconsistencies worth fixing in the redesign**
- **Four dialog implementations:** `brand/modal.tsx` (DecisionBar), an inline Base UI Dialog in `finding-card.tsx` (dismiss), separate Dialogs in `shell/shortcuts.tsx` and `shell/top-bar.tsx` (mobile sheet), a native `<dialog>` in `insights/watchlist.tsx`, plus `brand/drawer.tsx`.
- **Hand-rolled tables** outside `DataTable`: watchlist, AI-use models, guides list, CSV preview, issues table.
- **Two audit renderers:** `components/review/audit-log.tsx` (`/audit`) and an inline `<ol id="audit">` in `review/[contentId]/page.tsx`.
- **Native `<select>`/`<textarea>`** styled with `fieldClass` sit next to Base UI inputs; no Select, Checkbox, Switch or RadioGroup primitives exist (radio cards and checkboxes are hand-built in four places).
- **Inline link-buttons:** "New draft" is hand-styled in `top-bar.tsx` and again in `drafts/page.tsx`; `Cta` exists only for marketing.
- `RealtimeRefresh` lives in `components/vault/` though it's app-wide.

---

## 3. What reads as Render-like or generic

The look follows a prompt modelled on render.com (DESIGN.md §1, §4.1, §8). The specific borrowings:

| Element | Where | Why it reads as Render |
|---|---|---|
| Announcement bar, `--accent-deep` strip with "Try the live demo →" | `components/marketing/announcement-bar.tsx`, DESIGN §8.1 | Render's top promo strip |
| Typewriter + glyph-scramble H1 with gradient word and a blinking `▮` block cursor | `marketing/hero.tsx` `HeroHeadline`, `motion/use-typewriter.ts`, `--gradient-word` | Render's rotating hero word |
| "Deploy loop" style pipeline card (tiles flipping `⟳ checking` → `✓ 12ms`, sparklines, `$ brandlens check` chip, violet connector lines) | `hero.tsx` `PipelineLoop` | Render's animated deploy diagram |
| Pixel sprites and footer pixel composition; pixel glyph icons and wordmark | `marketing/pixel-sprites.tsx`, `brand/pixel-glyphs.tsx`, `brand/wordmark.tsx`; also login, empty states, ⌘K empty state | Render's signature pixel art |
| Violet block buttons: white fill → violet left-to-right wipe + chevron nudge, square corners; nav "Open app ›" full-height block with a 3px violet underbar | `marketing/cta.tsx`, `marketing/nav.tsx`, `marketing/skip-toast.tsx` | Render's CTA treatment |
| Nav links that flash a solid violet block behind the label on hover; Product mega-menu with `NEW` tags | `marketing/nav.tsx` | Render's nav |
| Blueprint grid background + top-left violet glow | `@utility blueprint-grid`, `--hero-glow` in `globals.css`; landing hero, `/login`, `/no-access` | Render's grid-lined hero |
| Hairline "cell" grids (`bg-line gap-px border`) with giant light numbers | `marketing/sections.tsx` (FeatureCells, GuaranteesBand, EvidenceBand, TrustGrid) | Render's bordered feature cells |
| "Built on open, auditable parts" mono wordmark row at 60% | `app/(marketing)/page.tsx` | Render's customer-logo row |
| Testimonial carousel (tabs, crossfade, auto-rotate, pause) | `marketing/heard-carousel.tsx` | Render's testimonial component, renamed |
| Multicolour sentence of dimensions | `sections.tsx` `DimensionSentence`, `--dim-*` tokens | Render's coloured product list |
| Mono uppercase eyebrow above every section and most panels | `Section`, `PageHeader eyebrow`, `mono-label` utility used ~150 times | Render's eyebrow labels |
| Fixed square theme toggle bottom-right | `(marketing)/layout.tsx` | Render |

**Generic or noisy in the product (not Render, but not polished either)**
- Mono uppercase is everywhere: column headers, eyebrows, state chips, severity, dimension labels, run log, meta lines, role pill, demo strip. With so much mono uppercase, the citation IDs (the real signature) stop standing out.
- Violet solid fills on the active nav item, every SegmentedTab, primary buttons, the demo strip, palette selection. Too much saturated accent on one screen (see `docs/screens/U2/review-detail-light.png`: active nav, Findings tab and New draft are all solid violet).
- The fake window header (three tiny squares, first vermilion) on the editor, the review render and the bleed card.
- Page headers stack an eyebrow, a 32px title and a description on every page; detail pages add a mono meta line.
- Duplicate actions: "New draft" in the top bar **and** the `/drafts` page header; "Try the demo" five times on the landing.
- The sidebar tip card overlaps the footer, and the dev "N" badge overlaps it in every screenshot (dev only, but it shows how crowded the bottom of the sidebar is).
- Severity counts as `3B 6W 0S` in mono colour codes: compact but cryptic.

---

## 4. Hard constraints

### 4.1 The 10 invariants (CLAUDE.md), as they show up in UI

| # | Invariant | What the UI must keep | Where today |
|---|---|---|---|
| 1 | No uncited finding is shown | Every finding shows its `rule_id`/`fact_id`/`wcag_ref` code, always visible (not hover-only). Cards with no citation are not rendered. | `FindingCard` returns `null` when `citations.length === 0`; pages filter (`review/[contentId]/page.tsx` `.filter((f) => f.citations.length)`); `IdBadge` |
| 2 | LLM is untrusted | Quote shown verbatim; offsets only through `lib/editor/offsets.ts`; never compute positions in components | `FindingCard` quote line, `findings-extension.ts` |
| 3 | Deterministic first | `DETERMINISTIC` vs `AI-ASSISTED` source tag on every finding | `SourceTag` |
| 4 | One LLM call per draft | Run summary shows LLM calls (and degraded state) | `RunPanel`, `DegradedBanner` |
| 5 | Minimal context to LLMs | "Never send to AI" lock on rule cards and facts; AI-use page lists what each provider receives; Gemini free-tier caveat | `rule-card-panel.tsx`, `IdBadge` popover, `ai-use/disclosure.tsx` |
| 6 | Humans decide | No Publish button anywhere; Accept disabled **with a visible reason** for blockers without a fix and confidence < 0.6; `NEEDS HUMAN` chip; dismiss requires a reason; approving with open warnings requires a reason per warning | `FindingCard` (`acceptWhy`, `aria-describedby`), `ConfidenceChip`, dismiss dialog, `DecisionBar` override modal |
| 7 | Transitions via `transition_content()` | DecisionBar shows only actions allowed for the role and state; reasons in dialogs; audit trail visible | `DecisionBar`, `lib/review/actions.ts`, audit tab, `/audit` |
| 8 | RLS; secret key server-only | Never import `lib/supabase/admin.ts` into client components; agency sees `SUMMARY VIEW` | `drafts/[id]/page.tsx` (`rule_cards_public`), `scripts/check-client-bundle.mjs` |
| 9 | `model_version`, `prompt_version`, `source` on findings | Finding footer meta (`llm · model · review@2`) and source tag stay visible somewhere on the card | `FindingCard` `meta` line |
| 10 | Precision gate | `CAPPED` dimensions noted in the AI-use Quality table | `disclosure.tsx` `QualityTable` |

Also from DESIGN §2.4/§7.5 (WCAG 1.4.1): severity, state, diff and risk always carry **text or a symbol**, never colour alone. Dimensions use label + icon, never colour.

### 4.2 Accessibility and test gates

- **axe gate, `e2e/ui.spec.ts`:** 19 routes × dark and light, zero serious/critical violations (WCAG 2.2 AA tags), with reduced motion emulated. Theme comes from the `bl_theme` cookie. `SCREENS=<phase>` writes `docs/screens/<phase>/`.
- **axe sweep, `e2e/a11y.spec.ts`:** theme comes from `colorScheme` emulation (no cookie), so the `@media (prefers-color-scheme: light)` token block must stay correct, not just `[data-theme="light"]`. It also fails on any CSP console error.
- **Token contrast test, `tests/tokens.contrast.test.ts`:** parses the `/* tokens:dark:start */…end` and `tokens:light` blocks in `globals.css`, accepting **only `#rrggbb` hex**, and checks they equal `lib/design/tokens.ts` `TOKENS`. It then asserts the DESIGN §2.3 pairs (≥ 4.5:1 text, ≥ 3:1 UI). If new tokens use `oklch()` the parser and the mirror must be rewritten in the same commit. The light tokens exist **three times** in `globals.css` (`[data-theme="light"]`, the media query, and the dark default); keep them in sync.
- **Keyboard, `e2e/keyboard.spec.ts`:**
  - The skip link "Skip to content" is the first Tab stop and moves focus to `#main`.
  - After a Brand admin signs in, **25 consecutive Tab stops must each have a computed `outline`** (`outlineStyle !== "none"` and width ≠ 0). **A box-shadow `ring` does not pass.** Most 21st.dev/shadcn components use `outline-none focus-visible:ring-*`; every one must be converted to outline. Tailwind v4 `outline-none` also overrides a later `outline-2` (PROGRESS decision 2026-10-27, use `outline-solid`).
  - ⌘K focuses an input with placeholder exactly `Search drafts, rule codes, facts, campaigns…`; typing `CL-03` shows an `option` named /CL-03/; Esc removes it.
  - `?` opens a dialog named `Keyboard shortcuts`; `g d` goes to `/drafts`. Shortcuts pause while any `[role=dialog]` is in the DOM.
  - Reduced motion on `/dev/kitchen-sink`: elements with `.spin`, `.cursor-blink`, `.pixel-shimmer` must exist (≥ 1) and all have `animationName: none`. Removing the pixel/cursor classes is fine as long as `.spin` remains, or the test is updated.
- **Reduced motion:** global CSS kill switch in `globals.css` plus our own `components/motion/use-reduced-motion.ts` (`useSyncExternalStore`, server snapshot `false`). Don't swap in motion's `useReducedMotion`: it caused a hydration mismatch (PROGRESS U1).
- **WCAG details already solved, don't regress:** skip link on every layout; `scroll-padding` for sticky bars (2.4.11); 24px minimum targets; disabled actions use Base UI `focusableWhenDisabled` + `aria-describedby` reason; demo role switch uses submit buttons, not change-on-select (3.2.2); carousel needs a pause button if it auto-rotates (2.2.2); in-text links are underlined (1.4.1); toast focus ring; chart has a table that stays in the accessibility tree; PDF page buttons take their name from sr-only text.

### 4.3 Code and dependency rules

- **ESLint hex ban** (`eslint.config.mjs`): `no-restricted-syntax` errors on `#rgb…#rrggbbaa` inside string literals and template strings in `.tsx`, which also catches `bg-[#fff]` classes. It does **not** catch Tailwind palette classes (`bg-zinc-900`, `text-white`, `from-purple-500`), `rgb()`/`hsl()`/`oklch()` literals, or hex in `.ts`/`.css`. 21st.dev components lean on exactly those, so the redesign should widen the rule (proposed in R1). One allowed exception exists: the PayWise palette default in `vault/asset-forms.tsx` (data).
- **shadcn `base-nova` on Base UI** (`components.json`, `@base-ui/react`): not Radix. Composition uses `render={<X/>}`, not `asChild`; state attributes are `data-open`, `data-popup-open`, `data-active`, `data-highlighted`, `data-starting-style`/`data-ending-style`, not `data-[state=open]`. `cn` is imported from the `cn` package in `components/ui` and from `@/lib/utils` elsewhere.
- **Animation:** the `motion` package (`motion/react`), not `framer-motion`. All motion goes through `components/motion/*` and honours reduced motion.
- **New dependencies** must be logged in PROGRESS.md → Dependencies and licences (with licence), which also feeds the README licence table. Any 21st.dev component that pulls a new npm package (e.g. `@radix-ui/*`, `framer-motion`, `@tabler/icons-react`, `react-icons`, `embla-carousel`) counts.
- **CSP** (`next.config.ts`): `font-src 'self' data:`, `img-src 'self' data: blob: <supabase>`, `connect-src` self + Supabase. Components that load Google Fonts, Unsplash or other remote images, remote SVG/Lottie, or video embeds will be blocked and fail `a11y.spec`'s CSP check. Fonts must be self-hosted via `next/font` or the `geist` package.
- **Next.js 16** (`apps/web/AGENTS.md`): read `node_modules/next/dist/docs/` before relying on memory. `proxy.ts` (not middleware), async `cookies()`/`params`/`searchParams`, global `PageProps`/`LayoutProps` types. Server components by default; `"use client"` only where needed.
- **Theme plumbing:** `bl_theme` cookie → `<html data-theme>` in `app/layout.tsx`; `@custom-variant dark` in `globals.css`; `lib/ui-prefs.ts` `applyTheme`; sonner `theme` prop. Dark is currently the default.
- **Out of bounds for this redesign:** `apps/worker`, `supabase/`, `types/database.ts` (generated), `.env*`. Server data loading in pages can be reorganised, but queries, RLS assumptions and server actions stay as they are.
- **Git (this task):** work on `UI/UX_jagpreet`, conventional commits, never commit to `main`, don't push. Note that production deploys from `main` (Vercel + Render), so nothing reaches users until the owner merges.

### 4.4 DESIGN.md rules that clash with typical 21st.dev components

These are current rules. The **a11y-derived** ones must survive any rewrite; the **aesthetic** ones are yours to change in R1.

| Rule (DESIGN.md) | Typical 21st.dev pattern | Keep? |
|---|---|---|
| Spinners, no skeleton shimmer (§5, §11) | Skeleton loaders everywhere | Aesthetic. Skeletons are allowed by WCAG if they respect reduced motion and have a `role=status` label. Your call. |
| No emoji in the app UI (§7.3) | Emoji in badges, empty states, testimonials | Keep (copy rule; also screen-reader noise). |
| Radius: 0 marketing, 6px product containers, 4px chips (§2.6) | `rounded-xl`/`rounded-2xl`/`rounded-full` cards and pills | Aesthetic. Pick one scale in R1. |
| No shadows except popovers (§2.6) | Layered shadows, glows, glassmorphism | Aesthetic. |
| No parallax, bouncing springs, confetti; nothing loops forever except an active spinner (§4.2) | Springy hovers, marquee logo rows, infinite gradient/beam animations, spotlight cursors | "Nothing loops forever" is effectively WCAG 2.2.2 (pause/stop/hide); flashing ≤ 3/s is 2.3.1. Keep both. Springs are aesthetic. |
| Three reserved colours: violet = action, vermilion = blocker, green = verified (§1) | Accent gradients, coloured icons per feature | Keep the principle (meaning never borrowed). Hues are aesthetic. |
| Headlines never bold (§2.5) | Bold display type | Aesthetic. |
| Lucide icons only, 16px/1.5 stroke (§2.7) | Tabler, Heroicons, react-icons, inline SVG sets | Keep Lucide (no new dep, consistent strokes). |
| Disabled actions must state why (§5, §7.1) | Silent disabled buttons, tooltip-only reasons | Keep (invariant 6 + keyboard users). |
| Severity/state never colour-only (§2.4) | Colour dots as status | Keep (WCAG 1.4.1). |
| Visible 2px `--focus` **outline** (§7.5) | `ring` box-shadows, `outline-none` | Keep (keyboard.spec). |
| Hover-only information not allowed | Hover cards, reveal-on-hover actions | Keep (keyboard and touch). |
| Tokens only, no hex in `.tsx` (§10) | Hardcoded `zinc`/`neutral`/hex/`white/10` | Keep and tighten. |
| Kitchen sink at `/dev/kitchen-sink` is the component QA page (§10) | n/a | Keep; every ported component goes there. |

---

## 5. 21st.dev integration plan

### 5.1 How components get in

21st.dev components are published as **shadcn registry items**, so each has a registry JSON URL (`https://21st.dev/r/<author>/<component>`) that the shadcn CLI can install. Our CLI is `shadcn@4` with `style: base-nova`. Installing straight into `components/` is risky: the item will declare Radix or framer-motion dependencies and may overwrite our restyled `components/ui/*` files.

Proposed intake routine (one component at a time):
1. **Inspect** the registry JSON first (files, `dependencies`, `registryDependencies`, CSS vars). Reject anything that needs a remote asset, a paid licence, or a heavy dependency we can't justify.
2. **Install into quarantine:** run the CLI with a path override, or copy-paste the source, into `apps/web/components/_intake/<name>/`, which isn't imported anywhere. Never let the CLI run `pnpm add` or overwrite `components/ui`: use `--dry-run`/`--view` if the installed CLI version has them (check `pnpm dlx shadcn@4 add --help`), otherwise copy-paste.
3. **Port** using the checklist below, move it into its real folder (`ui/`, `brand/`, `marketing/`, `shell/`), delete the intake copy.
4. **Add it to `/dev/kitchen-sink`** in both themes, then run lint, the contrast test and axe on the kitchen sink.
5. **Log** any new npm dependency in PROGRESS.md with its licence, and record the 21st.dev source URL and author in a comment at the top of the file (attribution and the README "Templates and assets" line).

Alternative: the 21st.dev "Magic" MCP server. It isn't configured in this repo (no `.mcp.json`) and needs an account key. See open questions.

### 5.2 Porting checklist

| From (typical 21st.dev) | To (our stack) |
|---|---|
| `@radix-ui/react-dialog`, `-popover`, `-tooltip`, `-tabs`, `-dropdown-menu`, `-select`, `-checkbox`, `-switch`, `-radio-group`, `-accordion`/`-collapsible`, `-scroll-area`, `-slider`, `-avatar` | `@base-ui/react/dialog`, `popover`, `tooltip`, `tabs`, `menu`, `select`, `checkbox`, `switch`, `radio-group`, `accordion`/`collapsible`, `scroll-area`, `slider`, `avatar` (all in Base UI 1.x) |
| `asChild` | `render={<Link href=… />}` (see `segmented-tabs.tsx`, `version-switcher.tsx`) |
| `data-[state=open]:…`, `data-[state=active]:…`, `data-[state=checked]` | `data-open`/`data-popup-open`, `data-active`, `data-checked`; enter/exit via `data-starting-style`/`data-ending-style` or `tw-animate-css` `data-open:animate-in` (as `ui/dropdown-menu.tsx` does) |
| `import { motion, AnimatePresence } from "framer-motion"` | `from "motion/react"`; gate with our `useReducedMotion`; no springs with bounce, no infinite loops |
| `bg-zinc-950`, `text-neutral-400`, `border-white/10`, `from-purple-500`, hex, `rgb()` | Semantic token classes (`bg-canvas`, `bg-elevated`, `text-fg-muted`, `border-line`, `bg-accent`…) from the R1 token set |
| `focus-visible:ring-2 ring-offset-2 outline-none` | `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid` (or rely on the global `:focus-visible` rule) |
| `font-[Inter]`, Google Fonts `<link>` | `font-sans` / `font-mono` (self-hosted) |
| Unsplash/remote images, Lottie, video | Local `public/` assets or none |
| `@tabler/icons-react`, Heroicons, `react-icons`, inline icon SVGs | `lucide-react` |
| Skeletons, marquees, spotlight/beam/particle effects | Per the R1 DESIGN.md decision; always static under reduced motion |
| `"use client"` on whole sections | Server component shell with a small client island |
| `<div onClick>` cards, icon buttons without names | Real `<button>`/`<a>`, `aria-label` on icon-only controls, 24px minimum targets |

### 5.3 What each 21st.dev category would replace

| 21st.dev category | Replaces | Notes |
|---|---|---|
| Buttons, inputs, textarea, select, checkbox, switch, radio group, badge, tooltip, popover, dialog, sheet/drawer, dropdown menu, tabs/segmented control, avatar, kbd | `components/ui/*`, `fieldClass` natives, `brand/modal.tsx`, `brand/drawer.tsx`, `brand/segmented-tabs.tsx`, the hand-built radio cards and checkboxes | Biggest consistency win. Restyle once; every screen inherits it. |
| Sidebar / app shell block | `shell/app-sidebar.tsx`, `shell/top-bar.tsx`, `shell/account-menu.tsx`, `shell/demo-strip.tsx` | Nav text and order are test-pinned (§6). |
| Command menu | `shell/command-palette.tsx` (keep `cmdk`), `shell/shortcuts.tsx` | Placeholder text is test-pinned. |
| Data table | `brand/data-table.tsx` and the five hand-rolled tables | Keep `aria-sort`, `rowheader`, captions. |
| Stat / KPI card | `brand/kpi-tile.tsx` | |
| Empty state | `brand/empty-state.tsx`, `brand/forbidden.tsx` | Replaces pixel glyphs with Lucide or a new mark. |
| Timeline / activity feed | Inline audit `<ol id="audit">` on the review page, `review/audit-log.tsx`, `review/comments.tsx` | Keep `#audit` and the raw `from → to` text (test-pinned). |
| File upload / dropzone | `vault/guide-upload.tsx`, the workspace file input, CSV import step 1 | Labels are test-pinned. |
| Toast | Keep `sonner`; restyle only | |
| Chart card | `insights/issues-chart.tsx` (Recharts stays) | Table fallback must stay. |
| Landing: navbar, hero, feature grid/bento, stats, logo cloud, testimonial, CTA, footer | Everything in `components/marketing/*` | Biggest visual change; no e2e text dependencies. |
| Sign-in block | `app/(auth)/login/*` | Region name, role button names, error id are test-pinned. |
| Settings page / form sections | `settings/page.tsx` `Cell`, `settings/client.tsx`, `ThemeRadioCards` | |

**Keep custom (no 21st.dev equivalent; restyle only):** `FindingCard`, `IdBadge` + source popover, `SeverityBadge`, `StateBadge`, `ConfidenceChip`, `SourceTag`, `RunPanel`, `DegradedBanner`, `RiskMeter`, `WordCounter`, `ImageFindings`/`PdfFindings` overlays, `VersionDiff`, `DecisionBar` logic, the TipTap editor and `.finding-hl` decorations.

---

## 6. Text-trim candidates

**E2E** marks strings or names a spec depends on. Changing those means updating the spec in the same commit without weakening what it checks. Unmarked items are free to cut.

### `/` landing
- Announcement bar ("Round 2 build · Inkloom AI… · Try the live demo →"): cut.
- Hero eyebrow "Pre-publication brand governance": cut.
- Hero subhead (36 words): cut to about 15, e.g. "Checks every draft against your approved rules and facts. Every flag cites its source. People approve."
- "Built on open, auditable parts" row: cut, or move to the footer.
- Section eyebrows ("Six dimensions · deterministic first", "Guarantees", "Why manual review fails", "From our four discovery interviews, October 2026", "Responsible design"): cut.
- Feature cell bodies (~30 words each): ≤ 15 words. Four "Docs →" links: one.
- Guarantees labels ("unapproved auto-publishes. BrandLens has no publish button"): shorten.
- Evidence band labels: shorten; keep the numbered sources (every stat must stay footnoted, DESIGN §8).
- "What we heard" carousel: cut, or one static quote (attribution by role and city only; consent is still open in PROGRESS).
- Trust grid: 6 items → 3–4, one line each.
- "Try the demo" appears 5 times: keep hero, final CTA and nav.
- Nav: Product mega-menu and "Read the plan": cut. Footer TEAM column and the trademark line: shorten.
- Skip toast "Skip this page next time?" / "Always open app": fine, maybe "Open the app by default?".

### `/ai-use` (public) and `/settings/ai-use`
- Eyebrows "Transparency" / "Workspace · Transparency": cut. Intro sentences: one line.
- Service cells: purpose/receives/stance as short phrases.
- **Keep** the Gemini free-tier caveat and "PayWise data is fictional" (CLAUDE.md deviation table, SPEC §18). Don't state it twice on `/settings/ai-use` (it's in a cell and in a footer box today).
- "The models and prompt versions used by recent reviews will be listed here once reviews have run." → "No reviews yet."

### `/login`
- Left panel: the eyebrow, paragraph and sample CL-03 chip are three ways of saying the same thing; keep one line.
- Demo role blurbs (`lib/auth/demo-roles.ts`, also used by the role switcher): ≤ 5 words each ("Owns the vault", "Writes and submits").
- Keep "Demo data is fictional (PayWise)."
- **E2E:** heading "Sign in" (exact); region named "Try a demo role" (comes from the heading text); role buttons named exactly Brand admin / Creator / Agency / Manager / Legal / Accessibility; labels "Email", "Password"; button "Sign in"; `#login-error` with `role=alert` containing "Email or password is incorrect".

### App shell
- Demo strip "DEMO · PayWise (fictional) · signed in as Creator": shorten to "Demo · Creator". **E2E:** button "Switch role"; inside, a dialog with role buttons whose names start with the role label.
- Sidebar group eyebrows (Work / Brand vault / Governance / Workspace): optional.
- "Pre-check tips" card: cut. Watchlist card: replace with a count badge on Insights.
- Footer "worker ok" and GitHub: move into the account menu or settings.
- Shortcuts sheet footnote "Every shortcut has a clickable equivalent.": cut. Toggle label "Single-key shortcuts (j, k, a, e, x, g …)": shorten.
- **E2E:** nav links in `navigation` "Main", with **exact text and order per role**: Admin = Drafts, Review queue, Rule cards, Facts, Glossary, Campaigns, Assets, Guides, Insights, Audit log, Settings, Services & AI use (Review queue may end in "N waiting"). Also pinned in `lib/workflow/__tests__/permissions.test.ts`. `data-testid="role-pill"` with text = role label. Workspace trigger name starts with "Workspace". "Sign out". "Skip to content". ⌘K placeholder `Search drafts, rule codes, facts, campaigns…`. Dialog "Keyboard shortcuts".

### `/drafts`
- Remove the duplicate page-header "New draft" (the top bar has one).
- Onboarding: title + one line + button; drop the "How citations work →" link to the landing page and the mock finding card (or keep the mock as the only illustration).
- Search placeholder "Search title or campaign" → "Search".
- `RISK —` for unscored rows → "—".
- **E2E:** links named by draft title.

### `/drafts/new`
- Eyebrow "Drafts" and the description ("Name it and pick its campaign. Next you'll…"): cut.
- **E2E:** label "Title", button "Create draft".

### `/drafts/[id]` (workspace and FindingCard)
- Panel header "Intent · required" → "Intent". Mark optional fields instead of required ones.
- Field helpers: "What should this content achieve?" (cut), "Who is this for? e.g. first-time investors" (duplicates the placeholder; cut), "Rewrites must keep it." (keep, short), campaign help (keep only the ended-campaign warning), alt-text help (shorten to "Required for images (WCAG 1.1.1)").
- Always-visible submit helper ("Saves a new version and checks it. Nothing is ever published automatically."): show only when Submit is disabled (the reason must stay, invariant 6/§7.1).
- Window header meta ("PDF · VERSION 1 · INSTAGRAM CAPTION · DIWALI SIP 2026 · LLM-assisted"): shorten. **E2E:** the editor heading must still match `/Image · version 1/` and `/PDF · version 1/`.
- File help paragraphs for PDF and image (25–30 words each): one line or a popover.
- DegradedBanner (33 words): "AI checks unavailable. Showing rule-based findings only." + Re-run.
- Empty states "Not checked yet" / "No findings" bodies: one short line.
- Read-only footnote "This draft is with reviewers and can't be edited right now. Review status": shorten.
- FindingCard: "Cites" label (cut, the chips speak for themselves); `acceptWhy` strings (~25 words) → ≤ 10 words but must stay visible; "Fix it in the design file, then upload…" → shorter; dismiss dialog description and per-reason help (keep the "doesn't apply" line, it's a DESIGN requirement); footer meta can be quieter but must stay (invariant 9).
- **E2E:** textbox "Draft text"; labels "Goal", "Audience", "Call to action", "Alt text", /Or upload a file/ (image and PDF specs) and /Upload the corrected image/ (image spec, v2); buttons "Submit for check", "Resubmit for check", "Start revising", "Accept fix", "Route to Legal", "Mark fixed in the image", "Show on page N" (button and link), "Show all pages"; card texts "Fix accepted", "Edited fix applied", "Routed to legal"; `li[data-finding]` with an `h3 button[aria-expanded]` whose name contains the code; `.finding-hl` highlight class; findings region named /^Findings/; "No findings on page 1."; "Page 3 of 4"; nav "Pages" with buttons "Page 1: no findings"; overlay buttons /^Finding \d+, blocker, CL-03/; `data-testid="swatches"`; spinner "Checking against your brand vault…" (asserted *absent*, so rewording it makes the test pass vacuously; update both).

### `/review` (queue)
- Description "Content waiting for a decision, highest risk first.": cut.
- Routing reason under every title: keep (DESIGN decision; always visible beats hover) but shorter.
- Empty state body: one line.

### `/review/[contentId]`
- Read-only window header "Draft · version 2 · read-only" → "v2 · read-only".
- "Decision" label: optional. Helper "N open warnings need an override reason to approve." → "N warnings need a reason".
- Modal descriptions (one sentence each): trim, keep the "audited" note once.
- Publish-ready: "Approved and ready. BrandLens never publishes: post it in your own channel." → "Post it in your own channel." (keep that phrase, DESIGN §6.5).
- **E2E:** text "Routed CL-03 · F-112 claim → Legal" (routing line, exact); tabs "Findings", /^Diff/, "Comments", "Audit"; heading "What changed" (sr-only); "Findings these changes resolved"; `ins` elements in the diff; buttons "Approve", "Sign off", "Confirm sign-off", "Request changes", "Send request", "Mark publish-ready"; labels "Reason (required)", "What needs to change (required)"; `role=alert` matching /valid next step|can't do that/; `#audit` containing **raw** transitions ("draft → ai_check", "specialist_review → approved"…), "Dev (Legal)" and the reason text. StateBadge DOM text exactly "In review", "Approved", "Publish-ready", "Legal review", "Brand review", "Changes requested", "Needs revision" (CSS may uppercase it).

### `/vault`
- Page header eyebrow "Brand vault" + title "Rules, facts and assets" + description → title "Vault" only.
- Campaigns explainer paragraph, Guides intro paragraph, palette empty text, rule-card helper texts ("Shown to agencies, who never see the full body.", "Checked locally only…"): shorten to ≤ 8 words.
- Keep the CSV column lists (they're the format spec), but in a collapsible.
- **E2E:** "Import facts CSV", "Import glossary CSV", label "CSV file", alert containing "can't be imported" and "row 2", "Preview: 4 valid rows", "Import 4 rows", rowheader "E-11", "Expired", link "Edit TV-04", heading "Edit rule card", label "Summary" (exact), button "Save", `v\d+` in the dialog, label "Upload a PDF or DOCX", button "Add guide", rowheader "guide", /DRAFTED \d+ card/i, link /\d+ drafts?/, buttons /^Approve [A-Z]+-\d+$/ and /^Approve \d+ rule cards?$/, text /draft rules? need review/.

### `/insights`
- Eyebrow "Insights · last 30 days" → a period label beside the title; description: cut.
- KPI help lines: keep short ("last 7 days"), move the brand-fit formula into a tooltip/popover.
- GCS formula paragraph (50 words): move into a "How it's scored" disclosure.
- Manager note and "N more approved rules have no findings yet": shorten.
- **E2E:** "Illustrative data" (DOM text), "blockers caught this week", table named /Guideline watchlist/ with rowheaders starting `CODE `, "UNCLEAR", "watch", "clear", "insufficient data", table text "Findings per cited rule", button /Review 3 examples/, dialog /Suggested examples/ with checkboxes, "Approve 2 examples", "Added 2 examples to TV-04 as version 2", "v1: GCS 60 (UNCLEAR)", "added 2 generated examples".

### `/audit`
- Description "Every state change and finding decision, with who did it and why. Times are IST." → "Times in IST."
- Empty-state body: cut.

### `/settings`
- Page description and each section description: cut or ≤ 6 words. "Messages carry titles and links, never draft text." is a trust statement; keep it short.
- "Inviting people isn't in this build.": cut.
- Disabled "Reset demo data" button + script hint: remove (dead UI) unless you want it for judges.
- Trailing paragraph linking to Services & AI use (already in the nav): cut.

### Other
- `error.tsx`, `no-access`, Forbidden: already short. Forbidden heading **E2E:** "You don't have access to this."

---

## 7. Proposed phase plan

Each phase: one session, on `UI/UX_jagpreet`, small conventional commits. **Gates for every phase:** `make check` green (lint incl. hex rule, `tsc`, Vitest incl. token contrast, pytest, pgTAP); `e2e/ui.spec.ts` axe on the touched routes in both themes; `keyboard.spec.ts` when the shell or primitives change; the touched flow's functional specs; screenshots to `docs/screens/R<n>/`. Specs whose pinned text changes are updated in the same commit, and their assertions stay as strong.

| Phase | Scope | Routes | Extra gates | Commit(s) |
|---|---|---|---|---|
| **R0** | This study | none | — | `docs(ui): add redesign study notes` |
| **R1** Direction, DESIGN.md and tokens | **Done 2026-10-28** (direction changed mid-phase to the flat, outlined reference style). New `docs/DESIGN.md`; one `light-dark()` token block in `globals.css` (light default) + `tokens.ts` + contrast test (55 rows × 2 themes); DM Sans + DM Mono via `next/font`; ESLint bans palette classes and yellow-as-text; `bg-black/50` scrims → `bg-overlay`. "Before" screenshots of the public routes in `docs/screens/before-redesign/`. | kitchen sink + public routes | token test; axe on the four DB-free routes | `docs(ui): capture before-redesign screenshots…`, `feat(web): R1 tokens and fonts…`, `chore(lint): …`, `docs(design): …` |
| **R2** Primitives | Port/restyle from 21st.dev to DESIGN.md §7: Button (primary ink, secondary yellow, outline, ghost, danger, link), Input, Textarea, Select, Checkbox, Switch, RadioGroup, Badge/chips, Tooltip, Popover, Dialog (one Modal), Drawer, Menu, Tabs, Kbd, Table, Card, Featured card, Icon tile, Window card, Skeleton. Replace `fieldClass` natives where the a11y story holds. All in the kitchen sink. | kitchen sink | keyboard focus ring (outline, not ring); reduced motion; axe | `feat(web): R2 base primitives` (per group) |
| **R3** Illustrations and wordmark | Original inline-SVG set in `components/illustrations/` per DESIGN.md §6 (document, lens, checkmark badge, shield, rule card, chart bars, speech bubble, window, leaves, blocks, stamp, calendar), the landing hero scene and three step scenes, the new wordmark and favicon. Delete pixel glyphs/sprites once nothing imports them. | kitchen sink | axe (decorative SVGs hidden); dark-mode check | `feat(web): R3 illustration set and wordmark` |
| **R4** App shell | Sidebar (yellow active item), top bar, demo strip, account menu, ⌘K, shortcuts sheet, toasts, `loading`/`error`. Remove the tip/watchlist cards and the sidebar GitHub link; move worker status into the account menu. | all app routes (shell) | `auth.spec`, `keyboard.spec`, `a11y.spec`, all `ui.spec` app routes | `feat(web): R4 app shell` |
| **R5** Marketing | Landing per DESIGN.md §9 (hero, 3 illustrated steps, context-bleed example, trust band, featured demo card, yellow footer) and `/ai-use`. Remove pixel sprites, typewriter, announcement bar, carousel, stats bands. Measure LCP. | `/`, `/ai-use` | `ui.spec` landing + ai-use-public; reduced motion; LCP < 2.5 s on a Vercel preview | `feat(web): R5 landing and public AI-use page` |
| **R6** Auth and system states | `/login` (keep the demo role cards), `/no-access`, EmptyState with spot illustrations, ErrorPanel, Forbidden, Spinner, skeletons. | `/login`, `/no-access` | `auth.spec` | `feat(web): R6 sign-in and system states` |
| **R7** Drafts | `/drafts`, `/drafts/new`, DraftWorkspace (intent, editor window card, upload, findings column), FindingCard, RunPanel, DegradedBanner, Image/PDF viewers. Copy trims from §6. | drafts routes | `drafts.spec`, `core-loop.spec` (F02–F03 half), `image-check`, `pdf-check` (need local Storage) | `feat(web): R7 drafts list and workspace`, `feat(web): R7 finding card` |
| **R8** Review | Queue, review page (render, tabs, diff, comments, one shared audit timeline), DecisionBar and its dialogs. | `/review`, `/review/[id]` | `review.spec`, full `core-loop.spec` | `feat(web): R8 review queue and decision flow` |
| **R9** Vault | Six tabs, rule-card/fact/campaign drawers, CSV import, guides, assets/palette. | `/vault?tab=*` | `vault.spec`, `vault-import.spec` | `feat(web): R9 vault` |
| **R10** Insights, audit, settings | KPI tiles, chart + table toggle, watchlist + examples drawer, `/audit`, `/settings` (remove the disabled "Reset demo data" button), `/settings/ai-use`. | four routes | `insights.spec` | `feat(web): R10 insights, audit and settings` |
| **R11** Polish and audit | Copy pass against §6 and DESIGN.md, motion pass, both-theme visual QA, full e2e, final screenshots, update `docs/DEMO.md` click paths and README screenshots; at merge time update the CLAUDE.md deviation row and README "Changes since Round 1". | all | everything; production-build run of `ui.spec` + `keyboard.spec` | `docs(ui): R11 screenshots, demo script and handoff` |

R2 must land before R4–R10, and R3 before R5 and R6 (they use the illustrations). R7 → R8 share FindingCard, so do them in order.

**Status 2026-10-28:** R1 done; R2–R6 done as a first pass (shared components restyled in place, illustrations, wordmark, shell, landing, `/ai-use`, `/login`); R7–R10 have a first pass through the shared components only. Signed-in routes are unverified on this machine (no local stack); see PROGRESS.md → Handoff.

---

## 8. Open questions

> Answered by the owner on 2026-10-28 (R1). The direction changed once mid-phase: the final answers are in PROGRESS.md → Decisions and in `docs/DESIGN.md`. Still open: the judging date.

1. **Direction.** What should it feel like instead of Render? Name two or three sites or products you like (e.g. Linear, Vercel dashboard, Stripe docs, Raycast). Dark-first, light-first, or equal?
2. **Accent and brand mark.** Keep violet as the action colour and the pixel-lens wordmark, or start fresh (new accent, new logo)?
3. **Mono voice.** OK to restrict monospace to IDs, numbers and code (citation chips, run log), and use sentence-case sans for every label, eyebrow, chip and table header?
4. **21st.dev access.** Do you have specific components in mind (links), or should I propose a shortlist per phase for your approval? Free components only? Do you want the 21st.dev Magic MCP set up (it needs your account key), or should I work from public registry URLs and copy-paste?
5. **Landing sections.** Which survive: evidence stats, guarantees band, "What we heard" (interviewee consent is still an open item in PROGRESS), responsible-design grid, the context-bleed example?
6. **Fonts.** Keep Geist Sans/Mono, or pick a new pair (must self-host via `next/font`, OFL or similar)?
7. **Skeletons.** DESIGN.md bans them. Allow skeletons for list/table loading in the new system, or keep spinners?
8. **Test-pinned structure.** OK to change test-pinned copy and structure where it improves the UI, updating the specs in the same commit? Specifically: (a) collapsing the six vault nav links into one "Vault" item with in-page tabs (changes `auth.spec`, `keyboard`/`a11y` nav walk, `permissions.test`); (b) showing friendly state names in the audit timeline instead of raw `in_review → approved` (changes `core-loop.spec`); (c) the ⌘K placeholder.
9. **Dead or demo-only UI.** Remove the disabled "Reset demo data" button, the sidebar tip/watchlist cards, and the GitHub link in the app sidebar?
10. **Timing.** When is Round 2 judging? `docs/DEMO.md`, README screenshots and the live demo all show the current UI. Should production stay on Terminal Noir until the whole redesign is merged, and do you want Vercel preview deploys from this branch?
11. **Uncommitted README change.** `README.md` on your working tree has the Quick start block replaced by a stray `Y` (it came with the branch, uncommitted). Intentional, or should it be reverted? I haven't touched it.
12. **Screenshots.** `docs/screens/U2/` is older than some §13 follow-ups (e.g. the review page shows an inline Archive `<details>`, insights shows chart and table side by side). Regenerate a "before" set at the start of R1?
