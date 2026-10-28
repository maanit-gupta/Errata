# BrandLens — DESIGN.md

> The visual and interaction system for every BrandLens screen: flat, friendly and light-first, with thick ink outlines, a yellow highlight and original flat illustrations. Adopted 2026-10-28 on branch `UI/UX_jagpreet`; it replaces "Terminal Noir". The rebuild runs in phases R1–R11 (`docs/ui-redesign/STUDY.md` §7). Screens not yet rebuilt still use the old components, which this file's tokens restyle.

## 0. Precedence

| Topic | Who wins |
|---|---|
| Look and feel (colour, type, shape, motion, layout, components, illustrations) | **This file.** |
| What a screen must do (data, permissions, states, guards) | `docs/SPEC.md` and `docs/PHASES.md` |
| The 10 invariants in `CLAUDE.md` | Always. If a design idea conflicts with an invariant, the invariant wins and the design changes. |
| WCAG 2.2 AA and the test gates (§10.5) | Always. A style rule that fails contrast, focus or target size is wrong. |

**Kept from before:**
- Rule, fact and WCAG IDs are first-class and always visible (`CL-03`, `F-112`, `WCAG 1.4.3`).
- Red means blocker. Severity and state never rely on colour alone.
- The window frame around a draft (now a flat "window card", §7.6).
- The PayWise demo IDs.

**Dropped:** the dark-first "terminal" look, the violet accent, pixel art, glyphs, sprites and the pixel-lens logo, the typewriter hero, the announcement bar, block buttons with a wipe, the blueprint grid and glow, gradient text, the testimonial carousel, monospace labels everywhere.

---

## 1. The feel

**Flat, friendly, confident.** A white page, thick black outlines, a yellow highlight, and simple flat illustrations. It should feel like a well-made tool a marketing team enjoys opening, not a terminal and not a SaaS template.

- **Light first.** White canvas, black ink. Full-width bands of light grey and pink break long pages; one band per page may have an angled top edge.
- **Outlines, not shadows.** Cards, tables, inputs and illustrations have a 2px ink outline. Nothing floats: no shadows, no gradients, no glass, no glow.
- **Ink is the action colour.** Primary buttons are solid black with white text. Links are black and underlined.
- **Yellow is the highlight.** The active nav item, the secondary button, badges on featured cards and the marketing footer. Yellow is always a **fill** with black text and a black outline, never text.
- **IDs are the proof.** Citation chips carry the rule, fact or WCAG ID in mono on every finding.
- **Short copy.** Plain, active voice. One idea per line. No emoji.

**Reference and originality.** The visual language follows a flat, outlined illustration style seen in a commercial website template (the owner's reference, 2026-10-28). We copy the **style only**. No illustration, logo, character, text or layout file from the reference may be reused, traced or reproduced. Every illustration is drawn for BrandLens as inline SVG (§6), and no template or vendor names appear in the code or UI.

---

## 2. Colour

### 2.1 Tokens

Defined once in `apps/web/app/globals.css` as `--name: light-dark(#light, #dark)` inside the `tokens:start … tokens:end` block. `color-scheme` picks the theme: light by default, dark via `data-theme="dark"` or the OS preference when the user hasn't chosen. `lib/design/tokens.ts` mirrors the values; the contrast test fails if they drift.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#FFFFFF` | `#121211` | Page canvas |
| `--bg-elevated` | `#FFFFFF` | `#1B1B19` | Cards, sidebar, menus, dialogs (separated by outline, not tint) |
| `--bg-hover` | `#EEEEEC` | `#272725` | Hover rows, hover buttons |
| `--bg-code` | `#F6F6F4` | `#0B0B0A` | Draft render, code, run log |
| `--band-grey` | `#EEEEEC` | `#1F1F1D` | Section band, empty-state panel |
| `--band-pink` | `#FACBED` | `#3B2135` | Section band, onboarding, demo strip |
| `--border` | `#D9D9D4` | `#34342F` | Hairline dividers only (table rows, list separators) |
| `--outline` | `#000000` | `#ECEBE6` | 2px outline on cards, tables, illustrations |
| `--border-strong` | `#000000` | `#ECEBE6` | Legacy alias of outline |
| `--border-control` | `#000000` | `#ECEBE6` | Input, select, checkbox outlines |
| `--focus` | `#000000` | `#F2F1EC` | Focus ring |
| `--text` | `#000000` | `#F2F1EC` | Body and headings |
| `--text-muted` | `#45453F` | `#B6B5AD` | Secondary copy |
| `--text-faint` | `#5E5E58` | `#9A9991` | Meta, timestamps, helper text |
| `--accent` | `#000000` | `#F2F1EC` | Primary button fill, active tab (ink; inverts in dark) |
| `--accent-hover` | `#2E2E2B` | `#D8D7D0` | Primary hover |
| `--accent-fg` | `#FFFFFF` | `#121211` | Text on accent |
| `--accent-soft` | `#000000` | `#F2F1EC` | Links and ID chip text |
| `--accent-deep` | `#FACBED` | `#4A2343` | Pink tint: selected rows, specialist state, demo strip |
| `--highlight` | `#F7B924` | `#F7B924` | **Yellow. Fill only.** Active nav, secondary button, featured badge, marketing footer |
| `--highlight-fg` | `#000000` | `#000000` | Text on yellow |
| `--info` | `#46627C` | `#9DB7CF` | Neutral info text (rare) |
| `--mint` | `#146F4C` | `#4CC992` | Large text accents on marketing only |
| `--blocker` | `#A31428` | `#FF7D8C` | Blocker text, outline, fill |
| `--blocker-fg` | `#FFFFFF` | `#121211` | Text on blocker fill |
| `--blocker-bg` | `#FBE6E9` | `#3E1A21` | Blocker tint |
| `--warning` | `#A14400` | `#FF9D57` | Warning text and outline (burnt orange, not yellow) |
| `--warning-bg` | `#FDE7D6` | `#3A2415` | Warning tint (peach) |
| `--suggestion` | `#45453F` | `#B6B5AD` | Suggestion (deliberately neutral) |
| `--success` | `#137A52` | `#4CC992` | Verified, cited, approved, publish-ready |
| `--success-bg` | `#E3F3EA` | `#15301F` | Success tint |
| `--danger` | `#A31428` | `#FF7D8C` | Destructive actions and system errors (not findings) |
| `--illo-*` | see globals.css | | Illustration palette (§6): ink, paper, yellow, pink, green, blue, red, grey |

Non-contrast tokens (outside the tested block): `--overlay` (dialog scrim), `--shadow-pop: none`, `--angle` (angled band height). Legacy hooks (`--grid-line`, `--hero-glow`, `--dim-*`, `--accent-pixel`) are neutralised and are deleted with their last users (R3–R5).

### 2.2 Colour rules

1. **Yellow is a fill.** `bg-highlight` always pairs with `text-highlight-fg` and a 2px ink outline. Yellow text, yellow underlines and yellow focus rings are banned (ESLint fails on `text-highlight`; on white, yellow is 1.76:1).
2. **Yellow never carries status.** It never means warning, pending or "needs attention". Status comes from severity and state tokens, each with a text label and an icon.
3. **Warning is not yellow.** Warning uses burnt orange text (`--warning`) on a peach tint (`--warning-bg`), the `TriangleAlert` icon and the word `Warning`. It is never a solid fill. Yellow is never a tint. In dark mode, where the two hues are closer in lightness, the form (tint vs solid fill), icon and label still separate them.
4. **Ink is the action colour.** Primary buttons and active tabs are solid ink. Links are ink and underlined. There is no separate brand blue.
5. **One accent band per screen.** At most one pink or yellow band per screen in the product. Marketing pages alternate white, grey and pink, and end in the yellow footer.
6. **Tokens only.** Hex lives only in `globals.css` and `tokens.ts`. ESLint bans hex and Tailwind palette classes (`bg-zinc-900`, `text-white`, `bg-black/50`…) in `.tsx`.

### 2.3 Verified contrast

Computed with the WCAG 2.x relative-luminance formula. AA needs 4.5:1 for text and 3:1 for UI boundaries and large text. Every row below is asserted by `apps/web/tests/tokens.contrast.test.ts` in both themes.

| Foreground | Background | Light | Dark | Needs |
|---|---|---|---|---|
| `text` | `bg` | 21.00 | 16.57 | 4.5 text |
| `text` | `bg-elevated` | 21.00 | 15.25 | 4.5 text |
| `text` | `bg-hover` | 18.08 | 13.23 | 4.5 text |
| `text` | `band-grey` | 18.08 | 14.60 | 4.5 text |
| `text` | `band-pink` | 14.83 | 12.76 | 4.5 text |
| `text-muted` | `bg` | 9.65 | 9.11 | 4.5 text |
| `text-muted` | `bg-elevated` | 9.65 | 8.38 | 4.5 text |
| `text-muted` | `bg-hover` | 8.31 | 7.27 | 4.5 text |
| `text-muted` | `band-grey` | 8.31 | 8.02 | 4.5 text |
| `text-muted` | `band-pink` | 6.82 | 7.01 | 4.5 text |
| `text-faint` | `bg` | 6.53 | 6.55 | 4.5 text |
| `text-faint` | `bg-elevated` | 6.53 | 6.03 | 4.5 text |
| `text-faint` | `bg-hover` | 5.62 | 5.23 | 4.5 text |
| `text-faint` | `bg-code` | 6.03 | 6.88 | 4.5 text |
| `text-faint` | `band-grey` | 5.62 | 5.77 | 4.5 text |
| `text-faint` | `band-pink` | 4.61 | 5.04 | 4.5 text |
| `accent-soft` | `bg` | 21.00 | 16.57 | 4.5 text |
| `accent-soft` | `bg-elevated` | 21.00 | 15.25 | 4.5 text |
| `accent-soft` | `bg-hover` | 18.08 | 13.23 | 4.5 text |
| `accent-soft` | `accent-deep` | 14.83 | 11.51 | 4.5 text |
| `text` | `accent-deep` | 14.83 | 11.51 | 4.5 text |
| `accent-fg` | `accent` | 21.00 | 16.57 | 4.5 text |
| `accent-fg` | `accent-hover` | 13.62 | 12.99 | 4.5 text |
| `highlight-fg` | `highlight` | 11.92 | 11.92 | 4.5 text |
| `info` | `bg` | 6.37 | 9.02 | 4.5 text |
| `blocker` | `bg` | 7.81 | 7.64 | 4.5 text |
| `blocker` | `bg-elevated` | 7.81 | 7.03 | 4.5 text |
| `blocker` | `blocker-bg` | 6.55 | 6.23 | 4.5 text |
| `blocker-fg` | `blocker` | 7.81 | 7.64 | 4.5 text |
| `warning` | `bg` | 6.28 | 9.12 | 4.5 text |
| `warning` | `bg-elevated` | 6.28 | 8.39 | 4.5 text |
| `warning` | `warning-bg` | 5.26 | 7.08 | 4.5 text |
| `suggestion` | `bg` | 9.65 | 9.11 | 4.5 text |
| `suggestion` | `bg-elevated` | 9.65 | 8.38 | 4.5 text |
| `success` | `bg` | 5.34 | 8.99 | 4.5 text |
| `success` | `bg-elevated` | 5.34 | 8.28 | 4.5 text |
| `success` | `success-bg` | 4.65 | 6.83 | 4.5 text |
| `bg` | `success` | 5.34 | 8.99 | 4.5 text |
| `danger` | `bg` | 7.81 | 7.64 | 4.5 text |
| `danger` | `bg-elevated` | 7.81 | 7.03 | 4.5 text |
| `bg` | `danger` | 7.81 | 7.64 | 4.5 text |
| `outline` | `bg` | 21.00 | 15.70 | 3 UI |
| `outline` | `bg-elevated` | 21.00 | 14.45 | 3 UI |
| `outline` | `band-grey` | 18.08 | 13.83 | 3 UI |
| `outline` | `band-pink` | 14.83 | 12.09 | 3 UI |
| `border-control` | `bg` | 21.00 | 15.70 | 3 UI |
| `border-control` | `bg-elevated` | 21.00 | 14.45 | 3 UI |
| `focus` | `bg` | 21.00 | 16.57 | 3 UI |
| `focus` | `bg-elevated` | 21.00 | 15.25 | 3 UI |
| `focus` | `band-grey` | 18.08 | 14.60 | 3 UI |
| `focus` | `band-pink` | 14.83 | 12.76 | 3 UI |
| `accent` | `bg` | 21.00 | 16.57 | 3 UI |
| `accent` | `bg-elevated` | 21.00 | 15.25 | 3 UI |
| `mint` | `bg` | 6.16 | 8.99 | 3 UI |

Not text, so not in the table: yellow against white is 1.76:1, which is why a yellow surface always has a 2px ink outline (21:1) as its boundary (WCAG 1.4.11).

### 2.4 Semantic mapping

**Severity** (`SeverityBadge`): a text label, an icon and a colour, always all three (WCAG 1.4.1).

| Severity | Style | Label | Icon |
|---|---|---|---|
| blocker | solid `--blocker` fill, `--blocker-fg` text | `Blocker` | `OctagonX` |
| warning | `--warning-bg` tint, 2px `--warning` outline, `--warning` text | `Warning` | `TriangleAlert` |
| suggestion | 2px `--border` outline, `--suggestion` text | `Suggestion` | `Lightbulb` |

**Dimensions**: label plus Lucide icon, ink colour, never a severity colour.

| Label | Icon |
|---|---|
| Tone | `AudioLines` |
| Terms | `SpellCheck` |
| Facts | `CalendarCheck` |
| Claims | `Scale` |
| Visual | `Palette` |
| Access | `Accessibility` |

**Content states** (`StateBadge`, SPEC §4): 4px radius chips. The DOM text stays sentence case (tests and screen readers read words).

| State | Style |
|---|---|
| draft | 2px `--border` outline, `--text-muted` |
| ai_check | 2px ink outline + spinner icon, label `Checking` |
| needs_revision | `--blocker-bg` + `--blocker` text, label `Needs revision` |
| in_review | 2px ink outline, ink text, `Inbox` icon |
| changes_requested | `--warning-bg` + `--warning` text, `Undo2` icon |
| specialist_review | `--accent-deep` (pink) + ink text, label `Legal review` / `A11y review` / `Brand review` |
| approved | `--success-bg` + `--success` text, `Check` icon |
| publish_ready | **solid `--success` fill, `--bg` text, `Check` icon**, label `Publish-ready`. The only solid green element. |
| archived | `--text-faint`, label `Archived` |

**GCS status** (SPEC §11): `Unclear` solid blocker fill · `Watch` warning tint · `Clear` success text · `Insufficient data` faint italic.

**Highlights in the draft** (`.finding-hl`): tint background plus a 2px underline in the severity colour. Blocker solid, warning dashed, suggestion dotted. The line style carries meaning without colour.

---

## 3. Shape, space, depth

- **Outlines:** 2px `--outline` on cards, panels, tables, inputs, selects, dialogs, menus, popovers, toasts, buttons that aren't solid ink, and illustrations. Dividers inside a card are 1px `--border` hairlines.
- **Radius:** 4px for buttons, inputs, chips and badges (`rounded-sm`/`rounded-md`); 8px for menus, popovers, tooltips and toasts; 16px for cards, panels, dialogs, drawers and window cards (`rounded-lg`). Avatars and status dots are round.
- **Depth:** none. No shadows (`--shadow-pop` is `none`), no gradients, no blur. Overlap is shown by outline and the `--overlay` scrim.
- **Spacing:** 4px base. Product page padding 32px desktop, 16px mobile; card padding 20–24px; gaps 16/24px. Marketing sections 96px vertical (64px mobile).
- **Layout:** product max content 1440px, the editor full-bleed. Marketing max 1200px, 12 columns.
- **Breakpoints:** `sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536`. Product designed for ≥1024; below `lg` the sidebar becomes a sheet.
- **Targets:** at least 24×24px for every control (WCAG 2.5.8). Buttons are 40px tall in the product and 48px on marketing.

---

## 4. Typography

**Chosen: DM Sans + DM Mono** (both SIL OFL 1.1, loaded with `next/font/google`, served from our own origin).

| Option | One-line rationale |
|---|---|
| **DM Sans** (chosen) | Low-contrast geometric sans with open counters: friendly like the reference's round grotesque, very legible at 14–16px in dense product UI, variable weight, and it pairs with DM Mono from the same family for IDs. |
| Bricolage Grotesque | More character in big headings, but its quirks get noisy at small UI sizes and in tables. |
| Figtree | Clean and friendly, but softer and closer to generic SaaS. |
| Space Grotesk | Techy, mono-flavoured; pulls back toward the terminal look we're leaving. |

**Mono rule:** DM Mono only for rule/fact/WCAG IDs, numbers in tables and metrics, version labels (`v3`), quotes of draft text inside findings, and code. Labels, eyebrows, column headers, buttons, chips and headings use DM Sans.

| Role | Size / line-height / tracking | Weight | Where |
|---|---|---|---|
| Display | `clamp(40px, 5.5vw, 72px)` / 1.05 / -0.03em | 600 | Landing hero |
| Section H2 | `clamp(30px, 3.6vw, 48px)` / 1.1 / -0.02em | 600 | Marketing sections |
| Page title | 32px / 1.15 / -0.02em | 600 | Product pages |
| Card title | 20px / 1.25 / -0.01em | 700 | Feature cards, panels, two-line titles |
| Body L | 18px / 1.6 | 400 | Marketing body, hero line |
| Body | 16px / 1.6 | 400 | Product default |
| Small | 14px / 1.5 | 400 | Table cells, helper text, meta |
| Label | 12–13px / 1.3 / +0.01em | 500 | Eyebrows, column headers, chips (`label` utility; `mono-label` is the legacy alias) |
| Mono ID | 13px / 0 tracking | 500 | `CL-03`, `F-112`, `WCAG 1.4.3`, `review@2` (`mono-id`) |
| Draft text | 16px / 1.7, max 72ch | 400 | TipTap editor |

Headings are sentence case. Sizes are in rem; the UI must survive 200% zoom and text-spacing overrides (WCAG 1.4.4, 1.4.12).

---

## 5. Layout patterns

### 5.1 Product page

Sidebar (left) · top bar · page header (title, one-line description at most, actions on the right) · content. Content sits on white. A page may use **one** band (grey or pink) for an onboarding or empty-state panel. Detail pages (draft, review) are full-bleed with outlined panels.

### 5.2 Section bands (marketing; sparing in product)

| Band | Background | Use |
|---|---|---|
| White | `--bg` | Default |
| Grey | `--band-grey` | Alternate sections, "how it works", product empty states |
| Pink | `--band-pink` | Trust section, onboarding, demo strip |
| Angled | any band + `band-angled` utility | One per page: the top edge cut at a slight angle (`--angle`, 4vw). Add at least `--angle` extra top padding so content never sits in the cut. |
| Featured | solid ink (`--accent`) card with a yellow badge | The single strongest call to action on a page |
| Footer | `--highlight` with a solid ink bottom bar | Marketing pages only |

---

## 6. Illustrations

Original, flat, outlined. They make empty states, onboarding and the landing page friendly. They never carry information that isn't also in text.

- **Built as inline SVG React components** in `components/illustrations/` (R3, before the landing rebuild). No raster files, no external assets, no traced or adapted third-party art.
- **Style:** 2px `--illo-ink` stroke, round joins, flat fills from the `--illo-*` palette, white `--illo-paper` for windows and documents. No gradients, textures, shading or drop shadows. Shapes are simple: rectangles with 4–8px corners, circles, leaf shapes.
- **Set (first pass):** document, magnifier (the BrandLens lens), checkmark badge, shield, rule card (ID tag on a card), chart bars, speech bubble, little window (three dots + title bar), leaf cluster, stacked blocks, stamp (sign-off), calendar (facts).
- **Composition:** one hero scene for the landing page (a draft window being checked by a lens, with ID tags and leaves), three step scenes for "how it works", and small spot illustrations (64–120px) for empty states and onboarding.
- **Theming:** colours come only from `var(--illo-*)`, so dark mode swaps ink to off-white and paper to dark automatically.
- **Accessibility:** decorative by default (`aria-hidden`, no title). If one ever carries meaning, it gets `role="img"` and a label. No animation beyond a one-time fade, and none under reduced motion.
- **No people or characters** in the first set; this avoids resembling the reference's character style.

**Wordmark (proposal, built in R3):** "BrandLens" in DM Sans 700, preceded by a 24px mark: a 2px ink circle (the lens) with a small yellow-filled checkmark tab at its lower right, on a white tile with a 2px ink outline and 4px radius. Favicon: the same mark. It replaces the pixel lens everywhere.

---

## 7. Components

Primitives live in `components/ui/` (shadcn `base-nova` on Base UI, restyled to these specs). BrandLens components live in `components/brand/`. 21st.dev components may be ported in (STUDY.md §5) only if they are restyled to this section and use Base UI, `motion` and tokens.

### 7.1 Button

| Variant | Style | Use |
|---|---|---|
| `primary` | solid `--accent` (ink), `--accent-fg` text, no border; hover `--accent-hover` | The main action on a view |
| `highlight` | `--highlight` (yellow) fill, `--highlight-fg` text, 2px ink outline; hover: solid ink with white text | The second action on marketing pages; the marketing nav CTA. At most one per view in the product |
| `secondary` / `outline` | transparent, 2px ink outline, ink text; hover `--bg-hover` | Every other action (Edit, Dismiss, Request changes…) |
| `ghost` | transparent, ink text; hover `--bg-hover` | Toolbar, icon buttons |
| `danger` | 2px `--danger` outline, `--danger` text; hover solid `--danger` with `--bg` text | Destructive only (archive) |
| `link` | ink text, underlined (offset 3px) | Inline actions |

40px tall (product), 48px (marketing), 4px radius, 600 weight, Lucide icon 16px. Loading: spinner + verb ("Submitting…"). **Disabled actions that block the user keep focus (`focusableWhenDisabled`) and show the reason in visible text linked by `aria-describedby`** (invariant 6).

### 7.2 Inputs

Text input, textarea, select: white fill, 2px `--border-control` outline, 4px radius, 40px tall, 16px text. Label above (visible, 14px/600), helper below (14px `--text-faint`, only when it says something the label can't). Error: `--danger` outline + message linked by `aria-describedby`. Checkbox and radio: 20px, 2px ink outline, ink fill when checked with a white mark. Switch: 2px ink outline track, ink thumb; on = yellow track fill.

### 7.3 Card

White (`--bg-elevated`), 2px `--outline`, 16px radius, 24px padding, no shadow. Optional illustration on top (feature cards), a bold two-line title (20px/700), and one or two lines of muted text. Interactive cards: the whole card is the target (stretched link), hover `--bg-hover`, focus ring on the card.

### 7.4 Featured card

Solid ink card (`--accent` background, `--accent-fg` text), 16px radius, with a small **yellow badge** (`--highlight`, ink text, 2px ink outline, 4px radius) overlapping its top edge. Contains a heading, one line, and a white button (`--bg` fill, ink text). One per page at most.

### 7.5 Icon tile

40px ink square, 8px radius, white 20px Lucide icon, followed by a two-line label. Used for the three hero points, settings sections and the "how it works" summary.

### 7.6 Window card

The frame for a draft, render or code sample: a 16px-radius card with a 40px title bar (`--highlight` fill on marketing, `--band-grey` in the product) holding three 8px ink dots and a short title, separated from the body by a 2px ink rule. Replaces the old dark window header.

### 7.7 Navigation

- **Marketing nav:** white, 80px tall, wordmark left, text links in ink (active link underlined), "Sign in" as a text link, and the CTA as a `highlight` (yellow) button.
- **Sidebar (product):** white, 2px ink right border, 256px (collapsible to 64px icons). Group headings are sans 12px/600 `--text-faint`, sentence case. Items 40px tall, 16px icon, 15px text. **Active item: `--highlight` fill, ink text, 2px ink outline, 4px radius.** Hover: `--bg-hover`. The queue count is a small ink pill with white mono digits. Nav text and order stay as tested (STUDY.md §6).
- **Top bar:** white, 64px, 2px ink bottom border. Breadcrumb left; search (outlined input-style button with `⌘K` hint), `New draft` (primary), `?` (outline icon button) and the avatar menu right.
- **Demo strip:** `--band-pink`, ink text, 32px, "Demo · Creator · Switch role".

### 7.8 Tabs

Segmented control: a 2px ink outlined container with 4px radius; the active tab is solid ink with white text, others ink text with `--bg-hover` on hover. Counts in mono after the label. Base UI Tabs (arrow keys, manual activation for URL tabs).

### 7.9 Table

Outlined card (2px ink, 16px radius, overflow clipped) holding a full-width table. Header row `--band-grey`, sans 13px/600 ink, sentence case, sort buttons with `aria-sort`. Rows 48px with 1px `--border` dividers, hover `--bg-hover`. The row's main link is ink, underlined on hover and focus. Numbers right-aligned in mono. "Load more" button below, never infinite scroll.

### 7.10 Badges and chips

4px radius, 24px tall, 12px/600 sans label plus a 14px icon. Severity, state and GCS chips per §2.4. **ID chip (`IdBadge`):** mono 13px ink text on white, 2px ink outline, 4px radius; hover `--bg-hover`; it's a button that opens the source popover. Never hidden behind hover or truncated.

### 7.11 Empty state

A `--band-grey` panel (16px radius, no outline) with a 96–120px spot illustration, a 20px/700 title, one line of muted text, and one primary action. Loading uses skeletons where the layout is known (§11).

### 7.12 Modal and drawer

Modal: white, 2px ink outline, 16px radius, max 520px, 24px padding, title 20px/700, one-line description, actions right-aligned (primary last). `--overlay` scrim. Focus trapped and returned to the trigger; Esc closes. Drawer: same, full height on the right, 560px, 16px radius on the left corners only.

### 7.13 Toast, tooltip, popover, menu

White, 2px ink outline, 8px radius, no shadow. Toasts top-right under the top bar; errors persist until dismissed, success lasts 4s; announced via `aria-live`. Tooltips are supplementary only, never the sole home of information.

### 7.14 Product components (restyle only; behaviour unchanged)

| Component | Spec |
|---|---|
| **FindingCard** | Outlined card. Header: severity chip, ID chips (always visible), dimension label, `Deterministic` / `AI-assisted` source tag, confidence (`conf 0.96` in mono, or `Needs a person · 0.54` in warning style). Quote in mono. Explanation. Cites row. Fix block in a `--bg-code` panel with del/ins, `− / +` markers, and the intent check. Actions: Accept fix (primary), Edit, Dismiss, Route to Legal (outline). Disabled Accept shows its reason in visible text. Footer meta: `llm · model · review@2` or `deterministic · filters/facts` (invariant 9). A finding with no citation is never rendered (invariant 1). |
| **RunPanel** | Collapsible outlined panel, `--bg-code` body; sans header "Check run" with run id, provider, model and prompt version in mono; stage lines; summary chips. |
| **DegradedBanner** | `--warning-bg` panel, 2px `--warning` outline, icon, one line, Re-run button. |
| **DecisionBar** | Sticky outlined panel at the bottom of the review column. Only the actions `transition_content` allows; each reasoned action opens a modal with a required textarea. **No Publish button anywhere**; publish-ready shows the solid green badge and "Post it in your own channel." |
| **RiskMeter** | Five 8×12px segments with 1px ink outline, filled `--warning` (or `--blocker` when a blocker is routed), plus the number in mono. Label always shown. |
| **DiffView** | Removed text struck through on `--blocker-bg` with `−`; added underlined on `--success-bg` with `+`; "Resolves CL-03, E-19" per hunk. |
| **KpiTile** | Outlined card, label, 40px/600 mono number, one-line note. |
| **Chart** | Recharts bars in ink with 2px corners, values in mono, a "View as table" toggle; the table stays in the accessibility tree. |
| **OverlayCanvas** | Boxes are 2px outlines in the severity colour (dashed for warning), with a corner tab `CL-03 · Blocker`; each box is a focusable labelled button. |
| **IllustrativeDataPill** | Pink chip, ink text, "Illustrative data". |

---

## 8. Motion

All motion goes through `components/motion/*` (the `motion` package) or CSS, and respects `prefers-reduced-motion` (our own `useReducedMotion` hook; the global CSS kill switch stays).

- Durations: 100ms hover, 150–200ms UI, up to 400ms for page-level reveals.
- Easing: `cubic-bezier(.2,.8,.2,1)`. No springs with bounce, no parallax, no confetti, no marquees.
- Allowed: fade and 8px rise on first reveal (once), card hover background change, drawer slide, status cross-fade (150ms), the accepted-fix flash on the changed span (600ms), overlay boxes drawing in (300ms), skeleton shimmer (a slow 1.5s opacity pulse, off under reduced motion).
- Nothing loops forever except a spinner or skeleton while work is in progress. Nothing flashes more than 3 times per second (WCAG 2.3.1).

---

## 9. Landing page `/` (R5) and `/ai-use`

Everything on it must be true: no invented customers, logos, testimonials or numbers.

1. **Nav** (§7.7).
2. **Hero:** headline (≤ 8 words), one line, a primary button "Try the demo" and a secondary button "How it works", three icon tiles ("Cites every flag", "Checks facts and dates", "People approve"). Hero illustration on the right.
3. **How it works:** three illustrated steps on `--band-grey`: Add your rules · Check a draft · Review and approve. One line each.
4. **The context-bleed example:** a window card showing the draft line, the Fact Vault match and the `E-19 · Blocker` finding, captioned "Caught without AI."
5. **Trust:** a short pink band with three or four points (minimal context to AI, never-send items, row-level isolation, human sign-off) and a link to Services & AI use.
6. **Featured card:** the black demo card with a yellow "Live demo" badge and "Try a demo role".
7. **Footer:** yellow, with product, trust and build links, the licence, and "PayWise is a fictional demo brand" on the black bottom bar.

Cut: announcement bar, typewriter, pipeline animation, "Built on" row, guarantees and evidence stats bands, "What we heard", mega-menu. `/ai-use` uses the same nav and footer with outlined service cards.

---

## 10. Cross-cutting behaviours

### 10.1 Role-aware rendering

UI gates with `lib/workflow/permissions.ts` `can()`; RLS is the enforcement. Hide whole features a role can't use; inside a visible workflow, show disabled-with-reason ("Only Legal can sign off claims").

### 10.2 Demo mode (`NEXT_PUBLIC_DEMO_MODE=true`)

The pink demo strip, the role switcher (submit buttons, never change-on-select) and the six role cards on `/login`. Nothing demo-related renders when false.

### 10.3 Copy

Short, plain, active voice. Name the rule ID instead of saying "on-brand". Errors say what happened and what to do. No emoji in the app UI (external Discord messages are exempt). Numbers and IDs in mono. Times relative in tables, absolute (IST) in the audit log and tooltips.

### 10.4 Keyboard

| Key | Action |
|---|---|
| `⌘K` | Command palette |
| `?` | Shortcuts sheet |
| `g d` / `g r` / `g v` / `g i` | Drafts / Review / Vault / Insights |
| `j` / `k` | Next / previous finding |
| `a` / `e` / `x` | Accept / edit / dismiss the focused finding, when allowed |
| `Esc` | Close the drawer, dialog or palette |

Every shortcut has a clickable equivalent. Single-key shortcuts never fire in text inputs and can be turned off (WCAG 2.1.4).

### 10.5 Accessibility (non-negotiable)

- **WCAG 2.2 AA** across the app and landing, both themes. Contrast per §2.3, enforced by the token test.
- **Focus:** a visible 2px `--focus` **outline** with 2px offset on every interactive element (black in light, off-white in dark). Never a box-shadow ring and never yellow alone. `keyboard.spec` checks the computed outline on 25 tab stops. In Tailwind v4 use `focus-visible:outline-solid`, not `outline-none` + `ring`. Sticky bars never hide the focused element (scroll-padding).
- Colour is never the only signal: severity, state, diff, risk and GCS all carry text or symbols.
- Live regions: run status and finding counts announced politely; errors assertively.
- Dialogs and drawers trap focus and return it. "Skip to content" on every page.
- Every input has a visible label; errors linked via `aria-describedby`.
- Charts have a table alternative; overlay boxes are labelled buttons.
- Reduced motion honoured (§8). Targets ≥ 24px.
- **Gates:** `e2e/ui.spec.ts` (axe, 19 routes × 2 themes, zero serious/critical), `e2e/a11y.spec.ts`, `e2e/keyboard.spec.ts`, `tests/tokens.contrast.test.ts`.

---

## 11. Loading, empty, error, permission states

| State | Pattern |
|---|---|
| Loading (layout known: tables, card lists, KPI tiles) | Skeleton blocks in `--bg-hover` with the same radius as the real element, a 1.5s opacity pulse (static under reduced motion), and an sr-only `role="status"` "Loading drafts…" |
| Loading (action or unknown layout) | Spinner + verb ("Checking against your vault…"). Over 10s, add "Still working…" |
| Empty | Empty-state panel (§7.11) with a spot illustration and one action |
| Error | Outlined panel with a 2px `--danger` outline: what failed, "Try again", and the request or run ID in mono |
| Forbidden | "You don't have access to this." + "{role} can't {action}." + a link back. Never a blank page |
| Degraded run | DegradedBanner (§7.14) |

---

## 12. Decision → UI traceability

Every development decision has a visible home in the UI. If you add a decision to PROGRESS, add a row here.

| Decision / invariant (source) | Where the user sees it |
|---|---|
| Citation gate: no uncited finding (Inv. 1, SPEC §8) | ID chips on every FindingCard; UI refuses to render uncited findings; RunPanel "gate drops n"; landing context-bleed example |
| LLM untrusted, quotes matched locally (Inv. 2) | Quote line jumps to the exact span; injection test draft still caught |
| Deterministic first (Inv. 3) | `Deterministic` source tag + `conf 1.00`; landing "Caught without AI" |
| One LLM call per draft; 2nd sample only for blockers (Inv. 4) | RunPanel "LLM calls 1" (or 2 with a "blocker confirmation" note); confidence tooltip |
| Minimal context, PII redaction, never-send (Inv. 5, SPEC §6) | RunPanel "PII redacted n"; vault "Never send to AI" lock toggle; Services & AI use "Receives" column |
| Humans decide; confidence < 0.6; overrides need a reason (Inv. 6) | Disabled Accept with a visible reason; "Needs a person" chip; override dialog with required reasons; no Publish button anywhere |
| All transitions via `transition_content` + audit (Inv. 7) | DecisionBar shows only allowed actions; Audit tab and `/audit`; reason dialogs |
| RLS; agencies see summaries (Inv. 8, SPEC §2) | "Summary view" note; agency nav lacks Vault, Insights, Audit; read-only vault banner |
| `model_version` / `prompt_version` / `source` on findings (Inv. 9) | FindingCard footer meta; RunPanel header; AI-use "Models in use" |
| Precision gate 85% (Inv. 10, SPEC §17) | "Capped · precision 0.82" note in the AI-use Quality table |
| Groq primary, Gemini fallback | RunPanel provider label; AI-use cards; degraded banner when both fail |
| Free-tier rate limits, degraded mode | DegradedBanner + Re-run; run failure panel with `error_code` |
| Gemini free-tier training caveat | AI-use Gemini note; login "Demo data is fictional" |
| Langfuse Cloud | AI-use card; admin-only "Trace" link in the RunPanel in development |
| Email/password + demo role switcher | `/login` form + role cards; demo strip and switcher |
| Discord + optional Resend | Settings → Notifications status + "Send test"; no URL shown |
| Intent required (SPEC §5) | Intent panel; Submit disabled with the list of missing fields |
| Intent-verified rewrites (SPEC §9) | "Intent verified" tag on rewrites; "No safe fix…" when dropped |
| Campaign-scoped facts and context bleed (SPEC §6.1) | Campaign select with status; bleed explanation naming the other campaign; landing example |
| Fact expiry | "Expired" chip in Facts; warning finding |
| Required disclaimer (F-112) | Fix block shows the disclaimer inserted; facts table disclaimer icon |
| State machine (SPEC §4) | StateBadge everywhere; Drafts tabs; resubmit bar |
| Risk score and routing (SPEC §10) | RiskMeter; queue sorted by risk; routing reason line; route chip |
| Versions immutable, superseded findings | Version switcher; "Superseded" label; DiffView "Resolves …" |
| Dismiss reasons feed GCS (SPEC §7, §11) | Dismiss dialog with the "tells your brand team the rule may be unclear" line; GCS breakdown |
| GCS, UNCLEAR, example generation (SPEC §11) | `/insights` watchlist and suggested-examples drawer; before→after version bump |
| Simulated activity data (P13) | "Illustrative data" pill |
| Rule extraction from guides (SPEC §12) | Guides tab live status; draft cards with source page; bulk approve |
| CSV import for facts and glossary | Import dialog with preview and row errors |
| MAX_WORDS 2,000 / PDF 40 pages (SPEC §14) | WordCounter; PDF upload rejection message |
| Hidden text in PDFs | Its own finding with explanation; overlay box |
| WCAG contrast / ΔE / logo (P11) | Ratio + swatches in the card; ΔE comparison; logo box |
| Rate limit on submit (P15) | Toast with the wait time |
| AGPL-3.0, licences, AI disclosure | Footer licence link; README; AI-use page |
| Worker health | Worker status in the account menu (moved from the sidebar in R4) |
| Never auto-publish | Publish-ready badge + "Post it in your own channel"; no Publish control |

---

## 13. Implementation notes

- **Tokens only.** Colours come from `globals.css` / `tokens.ts`. ESLint (`apps/web/eslint.config.mjs`) fails on raw hex, Tailwind palette classes (`bg-zinc-900`, `text-white`, `bg-black/50`…) and yellow used as text (`text-highlight`) in `.tsx`.
- **Tailwind names:** `bg-canvas`, `bg-elevated`, `bg-hover`, `bg-code`, `bg-band-grey`, `bg-band-pink`, `bg-highlight`, `text-highlight-fg`, `border-outline`, `border-line` (hairline), `border-control`, `text-fg`, `text-fg-muted`, `text-fg-faint`, `bg-accent`/`text-accent-fg`, severity names, `bg-overlay`.
- **Utilities:** `label` (small sans label), `mono-id` (IDs and numbers), `band-angled` (angled top edge). `mono-label` is the legacy alias of `label`.
- **Fonts:** `next/font/google` (`DM_Sans`, `DM_Mono`) in `app/layout.tsx`, exposed as `--font-dm-sans` / `--font-dm-mono`. No other font source (the CSP allows `font-src 'self'` only).
- **Kitchen sink:** `/dev/kitchen-sink` (dev only) renders every component and illustration in both themes; it is the visual QA page and an axe target.
- **21st.dev intake:** quarantine, port to Base UI + `motion` + tokens, restyle to §7, outline focus, kitchen sink, log any dependency (STUDY.md §5).
- **Icons:** Lucide only, 16px (20px in tiles), 2px stroke to match the outlines.

---

## 14. Redesign status

| Phase | Status |
|---|---|
| R0 Study | Done (`docs/ui-redesign/STUDY.md`) |
| R1 Direction, tokens, fonts, lint | Done: this file, `globals.css`, `tokens.ts`, contrast test, ESLint bans, DM Sans/Mono |
| R2–R11 | See STUDY.md §7 (R3 adds the illustration set before the landing rebuild in R5) |

Until each phase lands, older components keep their structure and pick up these tokens: ink and yellow replace violet, outlines replace hairlines where they use `border-line-strong`/`border-control`, labels are sans, and no shadows or grid remain.
