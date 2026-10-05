---
name: powerreact-design-system
description: Design contract for PowerReact's React UI. Covers the two Univerus templates ported from Univerus-Lens (Neo-Glass light / Nocturne dark, switched app-wide with the dark-mode button), the design tokens, surfaces, typography, 12-column grid, the hover curtain, motion rules, the visual selection policy and the chart library (KPI card, hero KPI, spotlight / ranking / bullet / diverging bars, donut, trend, IBCS variance). Use whenever you add or change any UI, visual, colour, card, chart, layout or theme in this repository. For wiring a new visual to the semantic model (DAX, queries, cross-filter), also follow powerreact-visual-builder.
---
<!-- GENERATED COPY of .agents/skills/powerreact-design-system/SKILL.md by scripts/sync-agent-skills.mjs. Edit the canonical file, then run npm run skills:sync. -->


# PowerReact Design Skill: Univerus Neo-Glass ↔ Nocturne

PowerReact renders Power BI semantic-model data with **native React visuals** (no Power BI visuals, no Deneb, no HTML Content). The look is the Univerus design system from **Univerus-Lens**, ported to responsive React:

| Template | `data-theme` | Source in Univerus-Lens | Character |
| :--- | :--- | :--- | :--- |
| **Neo-Glass** (Plantilla B, light) | `neoglass` | `templates/html/07_neo-glass-v3-light.html` + `mockups/08_neo-glass-light-dashboard-mockup.html` | Quiet technical backdrop `#F5FAFF`, one frosted-glass plane, compact header (logo · eyebrow · title) and a single teal rule. Cards are translucent white glass. |
| **Nocturne** (Plantilla A, dark) | `nocturne` | `templates/html/univerus-dashboard-A-nocturne.html` + `mockups/univerus-dashboard-A-nocturne-mockup.html` | Obsidian window `#070B0E` on a navy/teal backdrop with a teal glow rising from its base. Cards are dark glass. |

The dark-mode button (`ThemeToggle`, in the shell header) switches **the whole app**: shell, report canvas, charts, chat, briefing dialog and mini-player, and the embed toolbar.

## Sources of truth

If this document and the code disagree, the code wins and this document must be fixed.

| Concern | File |
| :--- | :--- |
| Every colour, surface, radius, shadow, blur, padding, gap | `src/theme/tokens.css` (the ONLY place colours live) |
| Token → Tailwind utility mapping (`bg-u-*`, `text-u-*`, `border-u-*`), no stock palette | `src/index.css` |
| Surface classes: scene, plane, card, curtain, tabs, buttons, inputs, chips, table, tooltip | `src/theme/surfaces.css` |
| Keyframes (`u-rise`, `u-fade`, `u-grow`, `u-wipe`, `u-seg`, …) and the reduced-motion block | `src/theme/base.css` |
| Theme state, persistence, OS preference; pre-paint script | `src/store/theme.ts`, `index.html` |
| Report template (scene, plane, header, rule) | `src/components/template/ReportTemplate.tsx` |
| UI primitives | `src/components/ui/` (`Card`, `ChartCard`, `InfoCurtain`, `KpiCard`, `KpiHero`, `primitives.tsx`) |
| Charts + pure layout math | `src/components/charts/` (`layout/*.ts` are unit-tested) |
| Living catalogue in both themes | `/gallery` → `src/pages/Gallery.tsx`, fixtures in `src/components/charts/__fixtures__/samples.ts` |
| Mechanical guards | `src/theme/contrast.test.ts`, `src/theme/noRawColors.test.ts`, `src/components/charts/charts.ssr.test.tsx`, `e2e/theme.spec.ts`, `e2e/gallery.spec.ts` |

Full token table: [references/tokens.md](references/tokens.md). All 41 principles adapted to React: [references/principles.md](references/principles.md). IBCS: [references/ibcs.md](references/ibcs.md).

---

## 0. Non-negotiable rules

1. **Colours come only from tokens.** Use `bg-u-*`, `text-u-*`, `border-u-*` utilities or `var(--u-*)` in SVG/inline styles. Stock Tailwind colours (`slate-500`, `teal-600`…) do not exist in this build (`--color-*: initial`), and `noRawColors.test.ts` fails on palette classes, hex, `rgb()` or `hsl()` anywhere in `src/` except `tokens.css`. White and black are the only keywords allowed.
2. **New colour = new role.** Add it to **both** theme blocks in `tokens.css` (the contrast test checks role parity), map it in `index.css` if utilities need it, and add a contrast pair to `contrast.test.ts` if it carries text.
3. **Every visual sits on exactly one card**: `ChartCard` for charts and tables, `KpiCard` / `KpiHero` for numbers. Never hand-roll a card with borders and shadows; never nest cards.
4. **One question per card** (§2). A chart answers how much, which leads, how it is split, how it evolved, how far from target, or which exact rows; never two of them.
5. **Both themes, always.** Check every change on `/gallery` and on the real view in Neo-Glass **and** Nocturne before handing over.
6. **Switching theme never changes geometry or text.** Sizes and typography are shared; themes change colour, radius (14 / 20), gap (16 / 20) and card padding only.
7. **Motion explains, it never loops** (§7). The only infinite animations are loading spinners (`u-spin`) and the voice equalizer while speaking. Every entrance uses `var(--u-ease)` and works under `prefers-reduced-motion`.
8. **Loading, empty and error states keep the final geometry** (`LoadingState rows={n}`, `EmptyState`, `ErrorNote`).
9. **Context on demand**: definitions and formulas go in the hover curtain (§6), never as footnotes on the card face.
10. **Accessible by construction**: interactive rows and cards are `<button>`s (or rows with `tabIndex`, `aria-selected` and Enter/Space handlers); toggles expose `aria-pressed`; charts expose `role="img"` + `aria-label`; text roles meet the contrast test.
11. **No pie, no 3D, no dual axis, no gauges.** A composition with more than 6 parts is a ranking.
12. **Tests stay green**: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`.

---

## 1. Theme mechanics

- `<html data-theme="neoglass|nocturne">` selects the token block. `index.html` sets it **before first paint** from `localStorage['powerreact-theme']`, else from `prefers-color-scheme`. `src/store/theme.ts` (`useThemeStore`: `theme`, `setTheme`, `toggle`) keeps it, persists it (storage errors tolerated) and swaps **instantly**: transitions are suppressed for the flip so colours, borders and shadows do not smear (better-ui).
- `dark:` utilities target Nocturne (`@custom-variant dark`). Prefer a token role over `dark:` overrides: a role keeps both themes in one place.
- Template-specific chrome is CSS, not JSX branches: `.u-plane-glow` / `.u-plane-rays` only display in Nocturne; `--u-rule` is transparent in Nocturne; Nocturne tabs are pills.
- **Choose by audience** when a page has a default: Neo-Glass for executive, audit and print; Nocturne for operational monitoring and wall displays. The user's toggle always wins.

---

## 2. Visual selection policy

| Question the module answers | Component | Notes |
| :--- | :--- | :--- |
| How much? (value + delta / context) | `KpiCard` | One card per KPI, 3 columns each (4 per row). Delta via `KpiDelta` coloured by business meaning. |
| One headline metric with supporting figures | `KpiHero` | Dominant number, ≤ 4 metrics, optional 60-tick meter. Takes 7–8 columns. |
| Which category leads? (and can filter the page) | `SpotlightBars` | Label above a slim pill bar, value, share of total over **all** categories, optional `#rank`, selection dims the rest. |
| Which leads, compact / long lists | `RankingBars` | One line per row; bottom-N stays relative to the overall leader. |
| On target per category? | `BulletBars` | Fill = actual, tick = target, variance chip by `goodWhen`. |
| Signed imbalance (net flow, variance), both ends visible | `DivergingBars` | Centre axis; direction by side, sign and end labels, never colour alone. |
| How is a real total split? (2–6 parts) | `Donut` | Total in the hole, legend list with share + value. > 6 parts folds into "Other" and warns: use a ranking. |
| How did it evolve? | `TrendChart` | 1 primary series + ≤ 1 comparison (dashed). Area to zero. Direct labels. Crosshair tooltip. |
| How far above / below PY, plan, forecast, budget — and where? | `IbcsVariance` | IBCS notation. `orientation="horizontal"` for structures, `"vertical"` for time. See [references/ibcs.md](references/ibcs.md). |
| Which exact rows, owners, statuses? | `ChartCard` + `.u-table` | Identifiers first, status last (`StatusChip`), inline `MiniMeter` for ratios. |
| Filter the page | `Tabs` / `Tab` (framed buttons, §5.1), search `u-input` | Toggles use `aria-pressed`; the selected button *is* the visible state (no second chip for it); removable chips show the other active filters. |

React lifts the Power BI limitation that HTML visuals are display-only: **every component may cross-filter** through the filter store (see powerreact-visual-builder).

---

## 3. Colour roles (summary)

| Role | Neo-Glass | Nocturne | Use |
| :--- | :--- | :--- | :--- |
| `--u-primary` | `#34A7AD` teal | `#8AF3F9` cyan | Main series, the insight, KPI marks |
| `--u-secondary` | `#8A9B9C` | `#95989A` | Comparison / target, dashed lines, IBCS scenarios, negative diverging bars |
| `--u-neutral` | `#B8CACB` | `#B7C9D2` | Context categories |
| `--u-grid` / `--u-grid-dash` | `#E9EEF4` solid | `#2A2F33` dashed `4 6` | Value gridlines only |
| `--u-track` | `#EFF4FA` | `#262C30` | Bar tracks, meter off-ticks, hover bands |
| `--u-interaction` | `#237A7F` | `#8AF3F9` | Selection, hover, focus accents, active KPI ring |
| `--u-bar-1..3` (+ `--u-bar-glow`) | `#34A7AD → #62C0C5` | `#237A7F → #62C0C5 → #8AF3F9` + cyan glow | Bar gradient (`BAR_FILL`) |
| `--u-series-1..6` | tonal teal ramp | cyan, teal, teal-dark, slate-light… | Categorical (donut) — tonal before new hues |
| `--u-ok / -warn / -bad` (+ `-text`, `-bg`) | teal / `#8B6A3A` / `#BA1A1A` | cyan / `#F5A524` / `#FF7A6B` | Status chips, IBCS good/bad, variance |
| `--u-delta-up / -down` | `#237A7F` / `#9A5E51` | `#8AF3F9` / `#FF7A6B` | KPI deltas (by meaning) |
| `--u-ac` | `#0D1317` | `#FFFFFF` | IBCS actuals (solid, strongest neutral) |
| `--u-tooltip-*` | ink with white text | white with ink text | Interactions concentrate contrast |

Text: `--u-title` > `--u-text` > `--u-text-soft` > `--u-label` / `--u-axis` > `--u-subtitle`. Neo-Glass `subtitle` (#819095) and `label` (#748388) are 3.3–3.9:1 by Lens spec — keep them for secondary text only (≥ 3:1 is enforced); anything people must read uses `text-soft` or stronger (≥ 4.5:1).

---

## 4. Typography, spacing, layout

- **Fonts** (self-hosted, `@fontsource-variable`): Space Grotesk (`font-display`, `.u-num`) for titles and numbers; Montserrat (`font-sans`, default) for body, labels and controls.
- **Scale**: report title 22 px/600 · card title 15 px/600 (`.u-card-title`) · subtitle 12 px (`.u-card-subtitle`) · body 12.5 px · KPI label 11 px/600 uppercase `tracking-[0.04em]` · KPI number 30 px/600 `tracking-[-0.045em]` · hero number `clamp(52px, 6vw, 84px)` · table header 10 px uppercase `0.08em` · eyebrow 10 px `0.18em` · legends/axis 11 px.
- **Numbers** use `.u-num` (tabular figures). Values right-aligned in tables.
- **Grid**: 12 columns with `gap-(--u-gap)`. KPIs span 3; the main insight 7–8; supporting 4–5. Sections stack with the same gap. Equivalent cards share height and baseline.
- **Responsive by container, not viewport**: the report's data area is a size container (`@container` in `ReportTemplate`), because its width changes with the sidebar and the chat drawer. Use container variants — KPIs `grid-cols-2 @4xl:grid-cols-4`, breakdown rows `grid-cols-1 @5xl:grid-cols-12` with `@5xl:col-span-*` — never `sm:`/`lg:` for report layouts. Header and toolbar respond to the plane, a named container: `@md/plane:`, `@lg/plane:`. Viewport breakpoints are for the app shell only (§5.2).
- **Padding**: cards use `--u-card-pad` (`.u-card--pad`, default in `Card`); KPI cards `--u-kpi-pad`.
- **Radii**: cards `--u-card-radius` (14 / 20), controls 8–9 px, chips 6 px, pills full. Never mix arbitrary radii.

---

## 5. Components

All live in `src/components/ui` and `src/components/charts`. See `/gallery` for each one rendered in the active theme.

```tsx
<ReportTemplate eyebrow="Asset Management" title="Asset Portfolio Overview" meta={<span>Updated <time>10:53</time></span>}
                actions={<>{briefingButton}<ReportDetails onOpenInspector={…} />{refreshButton}</>} toolbar={<FilterBar />}>
  <div className="grid grid-cols-2 gap-(--u-gap) @4xl:grid-cols-4">
    <KpiCard index={2} label="Due For Renewal" icon={AlertTriangle} value="687"
             aside={<StatusChip tone="warn">6.9% of assets</StatusChip>}   {/* contextual, "None due" (ok) at 0 */}
             active={focus === 'renewal'} onClick={() => toggleKpiFocus('renewal')}
             info="Assets whose renewal date is on or before today…" calc="[Assets Due For Renewal]" />
  </div>
  <ChartCard index={4} className="@5xl:col-span-5" title="Asset Distribution by Group" subtitle="Asset count and share of the register"
             info="…" calc="[Asset Count (All States)] by …" aside={<span className="u-num text-[11px] text-u-label">5 groups</span>}>
    <SpotlightBars data={rows} label="Asset distribution by group" selectedId={group} onSelect={(d) => toggleGroup(d.id)}
                   selectedBadge="Cross-Filtered" testIdPrefix="group" />
  </ChartCard>
</ReportTemplate>
```

| Component | Key props |
| :--- | :--- |
| `ReportTemplate` | `eyebrow`, `title`, `meta`, `actions`, `toolbar`, `contentClassName` (bottom room, e.g. for the mini-player), children (scrolling data area, `data-testid="report-content"`) |
| `Card` / `ChartCard` | `index` (entrance stagger), `title`, `subtitle`, `aside` (legend / counter / controls), `info`, `calc` (ⓘ curtain) |
| `KpiCard` | `label`, `icon`, `value` (formatted or `…` / `—`), `aside`, `footer`, `active` (leave undefined for a plain action: no `aria-pressed`, no ring), `stale`, `onClick`, `info`, `calc` — `data-testid="kpi-<label-slug>"` on the number, `kpi-card-<label-slug>` on the card |
| `KpiHero` | `label`, `value`, `unit`, `delta {text, favourable}`, `metrics[≤4]`, `meter {label, value 0..1}` |
| `SpotlightBars` | `data: {id,label,value}[]`, `label`, `formatValue`, `secondary` (default share), `topN`, `rank`, `selectedId`, `onSelect`, `renderMeta`, `selectedBadge`, `testIdPrefix` |
| `RankingBars` | `data`, `label`, `topN`, `order: 'desc'|'asc'`, `selectedId`, `onSelect` |
| `BulletBars` | `data: {id,label,actual,target}[]`, `goodWhen: 'above'|'below'` |
| `DivergingBars` | `data`, `negativeLabel`, `positiveLabel`, `maxRows` |
| `Donut` | `data`, `centerLabel`, `formatValue`, `size`, `selectedId`, `onSelect` |
| `TrendChart` | `categories`, `series: {id,label,role:'primary'|'comparison',values}[]`, `area`, `directLabels`, `height` |
| `IbcsVariance` | `data: {id,label,actual,comparison}[]`, `orientation`, `scenario: PY|PL|FC|BU`, `goodWhen: higher|lower`, `sort`, `topN`, `pctCap`, `selectedId`, `onSelect` |
| Primitives | `StatusChip tone`, `Tabs`/`Tab active`, `Legend items`, `MiniMeter value`, `LoadingState rows`, `EmptyState`, `ErrorNote error` |
| `Popover` | `label`, `trigger`, `triggerClassName`, `children(close)` — anchored panel (Esc / outside click close, focus returns to the trigger); below `sm` it spans the report header |
| `Sheet` | `open`, `onClose`, `title` — side sheet in a portal (560 px, full screen on phones) for secondary tools |
| `ReportDetails` | `onOpenInspector` — the header's ⓘ "Details": model, dataset id (copy), engine, auth, last latency, query count, "Open DAX Inspector" |
| `VoiceBriefingOrb` | `open`, `onOpenChange` (dialog opened from the header's Briefing button), `onPlayingChange`, `onFocus`, `onResetAll` |
| CSS classes | `.u-btn` (primary), `.u-btn-ghost` (+ `aria-pressed`), `.u-icon-btn` (+ `aria-pressed`), `.u-input`, `.u-chip[data-tone]`, `.u-tab` / `.u-tabs`, `.u-scroll-x`, `.u-table` (+ `.u-table--stack`, `.u-cell-end`), `.u-chart-scroll`, `.u-tooltip`, `.u-status-dot`, `.u-eyebrow`, `.u-num` |

Bar lengths come from pure layout functions (`rankedRows`, `bulletRows`, `divergingRows`, `donutLayout`, `trendDomain`, `ibcsRows`/`ibcsScales`/`pctMarker`). Put new chart math in `charts/layout/` with a unit test, never inline in JSX.

### 5.1 Report chrome: filters, header, on-demand detail

- **Filters are framed buttons** (Lens page navigator, `--u-tab-*`): 32 px, 1 px border, radius 10 / 12, 8 px apart, **no shadows and no track**. Selected = `--u-tab-active-bg` (#237A7F, the AA teal) with white text; Nocturne adds the cyan border (#8AF3F9). Colour alone carries the selection (no dot). Hover tint only on hover-capable pointers. The row is one `.u-scroll-x` line (snap, right-edge fade) and a click calls `scrollIntoView({ inline: 'nearest' })`. Labels are short ("Group", "All groups").
- **Active filters**: chips only for what has no visible control of its own (class, KPI focus, search) plus **Reset all** whenever any filter, the group included, is set. The filter buttons keep their content width (`flex-auto`, not `flex-1`) so the chips wrap to a second line instead of squeezing the selected button out of view.
- **The header carries no telemetry.** Model name, dataset id, engine, auth, latency and query counts are developer context: they live behind **ⓘ Details** (`ReportDetails` popover). The header shows a quiet "Updated hh:mm" (from the KPI query's `dataUpdatedAt`) and the actions **Briefing**, **Details** and **Refresh**; on a narrow plane they are icon-only with an `aria-label` equal to the visible word.
- **Developer tools open off-canvas**: the DAX Inspector is a `Sheet`, opened from Details, never inline at the end of the page.
- **Card subtitles describe the data** ("Asset count and share of the register"); how to interact goes in the ⓘ curtain text.
- **One signal per fact**: no chip repeating a meter's percentage, no column repeating another column, no fixed alarm text ("Urgent Action") — a chip states the value in context or switches tone ("None due").
- **Briefing**: started from the header's Briefing button (dialog). Nothing floats over the data while idle; the mini-player (step title, pause, CC, stop) exists only while it plays — a pill bottom-right from `sm`, a full-width bar above `env(safe-area-inset-bottom)` on phones — and the report reserves bottom room (`contentClassName`) so it never covers the last rows.

### 5.2 Responsive and touch

| Width | Shell | Report |
| :--- | :--- | :--- |
| < md (phones) | Menu button opens the sidebar **drawer**; breadcrumb, settings, help and language hidden; "Chat with Data" icon-only (name kept as `sr-only`) | Plane `inset: 6px`, radius 18, 16 px gutters; logo 60 px; title ≤ 2 lines; KPIs 2×2 compact (24 px number, no icon mark, label ≤ 2 lines); table as a two-line list |
| md – lg (tablets) | Drawer; breadcrumb back | KPIs 2×2 full size; table back to columns when its card is wider than 520 px |
| ≥ lg | Persistent, collapsible sidebar; view switcher in the header | As designed for desktop |

- **App height** is `h-dvh` (the mobile browser bar must not push the report below the fold).
- **Drawer** (`UnityAssetsSidebar`, < lg): fixed, slides with `translate`, overlay `bg-u-overlay`; Esc, the overlay or choosing a module closes it; focus moves to its close button and back to the menu button; it is `inert` while closed. Collapse exists only ≥ lg.
- **Chat** is a full-screen sheet below lg (solid canvas behind the translucent panel).
- **KPI curtain on touch**: there is no hover, so on `(hover: none)` the icon slot becomes an ⓘ button (`What <label> means`) that toggles the same curtain. The card is a frame with two siblings — the full-card content button and the ⓘ — never nested buttons.
- **Tables** carry `.u-table--stack` and explicit roles (`table`, `row`, `columnheader`, `cell`): below a 520 px container each row becomes a grid (line 1 name + value, line 2 secondary cells), the header is visually hidden and `getByRole('row', …)` keeps working. End-aligned flex cells use `.u-cell-end` (CSS, so the list can re-align them; a `justify-end` utility would win over it).
- **Charts with a minimum geometry** (IBCS variance needs ~480 px for honest panel scales) keep it and scroll inside their card (`.u-chart-scroll`, a focusable region) instead of squeezing their scales or widening the page.
- **Touch targets** under `(pointer: coarse)`: tabs and buttons 40 px, icon buttons 40 × 40, table cells 48 px.
- **Verify** at 390 × 844 with touch in both themes: `e2e/responsive.spec.ts` (no sideways overflow on `/visuals` and `/gallery`, drawer, filters, KPI ⓘ, table list, full-screen chat, mini-player).

---

## 6. The hover curtain ("What it means")

Port of Lens `univerus_html._curtain` (principle 35): an opaque panel (`--u-curtain-bg`) drops from the top edge in .55 s, its text fades in after .16 s, and a 2 px accent hem with a glow marks its bottom. Content: kicker **What it means**, `info` (one definition sentence, ≤ 3 lines) and `calc` (**ƒ** + one line: the measure or formula).

- **KPI cards / hero**: opens on hover **and** keyboard focus (`.u-curtain-host`); `pointer-events: none`, so the card's click still works. The card exposes the text through `aria-describedby`. On touch screens (`hover: none`) an ⓘ in the icon slot toggles it (§5.2).
- **Chart cards**: opens from the **ⓘ** button in the header (`aria-expanded`), closes with the button, **Esc**, a click on the curtain or focus leaving the card. Never on hover: it would cover bars and rows exactly when the user aims at them.
- Text comes from the semantic model's measure descriptions (`EVALUATE INFO.VIEW.MEASURES()`); keep them in a definitions module (e.g. `src/components/visuals/kpiDefinitions.ts`) and mark wording that is not from the model (`pendingModelDescription`).
- Under `prefers-reduced-motion` it appears without sliding.

---

## 7. Motion

- Cards rise once (`u-rise` .7 s, stagger `--i` × 80 ms). Rows fade with `--k`. Bars grow from zero (`u-grow`, `transform-origin: left`) and transition `width` on data changes. Lines are revealed with a single wipe (`u-wipe`); donut segments with `u-seg`; the hero meter wipes in.
- Ease is always `var(--u-ease)` = `cubic-bezier(.16,1,.3,1)`.
- No pings, pulses or floating loops on data or chrome. A live state is a static `.u-status-dot` with a halo.
- `base.css` collapses every animation and transition under `prefers-reduced-motion: reduce`; nothing may depend on an animation finishing.
- **Interaction feedback is fast and interruptible**: controls (`.u-btn`, `.u-btn-ghost`, `.u-icon-btn`, `.u-tab`) transition named properties in 150 ms ease-out and press to `scale: 0.96`; dialogs enter in 250 ms from `scale(0.95)`. Never `transition: all`.
- **Hover effects only on hover-capable pointers** (`@media (hover: hover) and (pointer: fine)`): card lift and the KPI curtain; keyboard focus still opens the curtain.
- **Overlays render through a portal** to `document.body`: the plane's `backdrop-filter` would otherwise trap `position: fixed` layers inside it.

UI polish and motion details beyond this contract come from the vendored `better-ui` and `emil-design-eng` skills; where they disagree with this document, this document wins (precedence and resolved conflicts: powerreact-visual-builder, "Companion skills").

---

## 8. Adding or changing a component

1. Pick the component from §2; if none fits, write the new one in `src/components/charts` with its math in `layout/` (+ test) and colours only from roles.
2. Wrap it in `ChartCard` with `title`, `subtitle`, `info`, `calc`.
3. Give it loading / empty / error states with the final geometry.
4. Add it to `/gallery` with fixtures in `__fixtures__/samples.ts`, and an SSR smoke test (`charts.ssr.test.tsx`) for full and empty data.
5. Check `/gallery` and the real view in both themes (toggle in the header), with reduced motion emulated.
6. Run lint, typecheck, unit and E2E tests; update this skill and run `npm run skills:sync`.

---

## 9. Principles checklist (full text: references/principles.md)

**Hierarchy** — context → KPIs → main trend → breakdowns → detail; the main insight gets the most space; one question per card; no redundant visuals.
**Density** — one narrative + 3–6 supporting blocks; shared radius, baselines, heights; whitespace over filler.
**Colour** — one functional hierarchy; 1–2 dominant colours per chart; tonal before new hues; semantics constant across pages; the brightest colour is the insight.
**Chrome** — the grid disappears before the data; no axis titles or plot borders; legends small and near the title, or direct labels; shadows ~4 % in light, inset highlights in dark.
**Interaction** — hover, selection and tooltips concentrate contrast; selection dims the rest (≈ 35 %).
**Motion** — explanatory only; the page reads the same without it.

**Before adding any element:** does it help compare, spot an anomaly, understand a trend or make a decision? If not, remove it.

---

## 10. Common mistakes

| Mistake | Effect | Fix |
| :--- | :--- | :--- |
| `bg-slate-800`, `text-teal-600`, `#34A7AD` in a component | No CSS generated / test failure; breaks the other theme | Token role: `bg-u-*`, `text-u-*`, `var(--u-*)` |
| Colour picked with `dark:` per component | Two sources of truth per role | Add or reuse a role in `tokens.css` |
| Hand-made card (`rounded-xl border shadow`) | Wrong radius / blur / border per theme | `Card` / `ChartCard` |
| Curtain on hover over an interactive chart | Covers bars when the user aims at them | `ChartCard info/calc` (ⓘ) |
| Pie or donut with 8+ slices | Unreadable composition | `SpotlightBars` |
| Two comparison series on a trend | Competes with the main series | One primary + one comparison, or two charts |
| Share computed over the rows left after top N | Wrong percentages | `rankedRows` (shares over every category) |
| Variance coloured by sign | A cost overrun shows as "good" | `goodWhen` (`BulletBars`, `IbcsVariance`, `KpiDelta favourable`) |
| `animate-ping` / looping pulses as decoration | Restless dashboard | Static `.u-status-dot`; entrance-only motion |
| Spinner replacing a whole card | Layout shift | `LoadingState rows={n}` inside the card |
| Raw hex in SVG `fill` | Ignores the theme | `style={{ fill: 'var(--u-…)' }}` |
| `lg:grid-cols-4` on report grids | Opening the chat squeezes four KPIs into 700 px and truncates labels | Container variants (`@4xl:grid-cols-4`) |
| Model, dataset id or latency on the report canvas | Developer telemetry competes with the data | `ReportDetails` (ⓘ Details) and the DAX Inspector `Sheet` |
| Selected filter shown by a shadow or a dot | Near-invisible on glass; shadows used as structure | Filled `--u-tab-active-bg` + white text; borders for structure |
| A chip for the group next to its selected button | The same fact twice | Chips only for filters without their own control |
| `<button>` inside the KPI `<button>` (for an ⓘ) | Invalid nesting; screen readers and clicks misbehave | Card frame with two sibling buttons (`KpiCard`) |
| Fixed-width sidebar on phones | A 138 px report column | Drawer below lg (§5.2) |
| A chart that clamps to a minimum width with no scroller | The whole page scrolls sideways on phones | `.u-chart-scroll` around the SVG |
| Floating idle widget over the data (orb) | Covers rows and columns | Header button; mini-player only while active |
