---
name: powerreact-design-system
description: Design contract for PowerReact's UI. Covers the two Univerus templates ported from Univerus-Lens (Neo-Glass light / Nocturne dark, switched app-wide with the dark-mode button), the design tokens, surfaces, typography, 12-column grid, the hover curtain, motion rules, the visual selection policy and the Univerus web components (package udp-powerbi-visuals: Stencil, Shadow DOM, UDP conventions, token bridge with Fluent fallback, frame card | none) with their standard toolbar (export CSV / Excel, table view, focus view) — KPI card, hero KPI, spotlight / ranking / bullet / diverging bars, columns, stacked / Likert bars, donut, treemap, trend (gap shading), calendar heatmap, timeline, waterfall, dot plot, lollipop, boxplot, IBCS variance, scatter, matrix, data table. Use whenever you add or change any UI, visual, colour, card, chart, layout or theme in this repository. For wiring a new visual to the semantic model (DAX, queries, cross-filter), also follow powerreact-visual-builder; for manifests, powerreact-manifest.
---

# PowerReact Design Skill: Univerus Neo-Glass ↔ Nocturne

PowerReact renders Power BI semantic-model data with **native visuals** (no Power BI visuals, no Deneb, no HTML Content): the **Univerus web components** (Stencil, Shadow DOM, `packages/udp-powerbi-visuals`), wrapped for React 18. The look is the Univerus design system from **Univerus-Lens**, ported to the responsive web:

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
| Surface classes shared by the app **and** the shadow roots: card, curtain, controls, tabs, chips, table, tooltip, skeleton, menu, focus dialog, pager | `packages/udp-powerbi-visuals/src/styles/surfaces.css` (imported by `src/theme/surfaces.css`) |
| App-only surfaces: scene, plane, rule, eyebrow, horizontal scroller | `src/theme/surfaces.css` |
| Keyframes (`u-rise`, `u-fade`, `u-grow`, `u-wipe`, `u-seg`, …) and the reduced-motion block | `packages/udp-powerbi-visuals/src/styles/motion.css` (imported by `src/theme/base.css` and every element) |
| Shadow-root baseline (host reset, focus ring, scrollbars) · bar-family marks | `packages/udp-powerbi-visuals/src/styles/shadow.css` · `charts.css` |
| Theme state, persistence, OS preference; pre-paint script | `src/store/theme.ts`, `index.html` |
| Report template (scene, plane, header, rule) | `src/components/template/ReportTemplate.tsx` |
| React chrome | `src/components/ui/` (`Card`, `ChartCard`, `InfoCurtain`, `Popover`, `Sheet`, `primitives.tsx`) |
| Visuals: the Univerus elements (`udp-powerbi-visuals`, UDP layout), their shared frame, chart kit and pure layout math | `packages/udp-powerbi-visuals/src/components/{kpi,charts,tables}/udp-pbi-*` (each with a generated `readme.md`), `src/functional/{frame,chart-kit}.tsx`, `src/utils/layout/*.ts` (unit-tested); package `README.md` and `MIGRATION.md` (how it moves into UDP) |
| Token bridge: every role the elements read, `--pbi-<role>: var(--u-<role>, <Fluent token>)` | `packages/udp-powerbi-visuals/src/styles/tokens-bridge.css` (guarded by `src/theme/tokensBridge.test.ts`) |
| React wrappers (generated on every elements build) | `src/components/powerbi-visuals/` (`index.ts` re-exports `generated/` and the public types) |
| Living catalogue in both themes | `/gallery` → `src/pages/Gallery.tsx`, fixtures in `src/components/powerbi-visuals/__fixtures__/samples.ts` |
| Mechanical guards | `src/theme/contrast.test.ts`, `src/theme/noRawColors.test.ts` (app + package), `src/theme/tokensBridge.test.ts`, `src/components/powerbi-visuals/elements.ssr.test.ts` (hydrate), `e2e/theme.spec.ts`, `e2e/gallery.spec.ts` |

Full token table: [references/tokens.md](references/tokens.md). All 41 principles adapted to React: [references/principles.md](references/principles.md). IBCS: [references/ibcs.md](references/ibcs.md).

---

## 0. Non-negotiable rules

1. **Colours come only from tokens.** Use `bg-u-*`, `text-u-*`, `border-u-*` utilities or `var(--u-*)` in SVG/inline styles. Stock Tailwind colours (`slate-500`, `teal-600`…) do not exist in this build (`--color-*: initial`), and `noRawColors.test.ts` fails on palette classes, hex, `rgb()` or `hsl()` anywhere in `src/` or `packages/udp-powerbi-visuals/src/` except `tokens.css`. White and black are the only keywords allowed.
   **Inside the web components only `var(--pbi-*)` is used.** Tailwind utilities and the document's classes stop at the shadow boundary; custom properties, fonts and colour inherit through it. `packages/udp-powerbi-visuals/src/styles/tokens-bridge.css` (first in every `styleUrls`, and imported by the app for the shared surfaces) declares each role once as `--pbi-<role>: var(--u-<role>, <Fluent token>)`: the Univerus template here, the platform theme inside UDP. A new role goes in `tokens.css` (both themes) and in the bridge with its Fluent fallback; `tokensBridge.test.ts` fails otherwise and when an element reads `--u-*` directly. Element styles are plain CSS in the package (`styleUrls`), reading roles only. Content a container passes through a `slot` stays in light DOM and uses Tailwind normally.
2. **New colour = new role.** Add it to **both** theme blocks in `tokens.css` (the contrast test checks role parity), map it in `index.css` if utilities need it, and add a contrast pair to `contrast.test.ts` if it carries text.
3. **Every visual is exactly one Univerus element**, which is its card: `<udp-pbi-*>` (React: `Univerus…` wrappers from `src/components/powerbi-visuals`). Never wrap an element in another card, never hand-roll a card with borders and shadows. `ChartCard` remains for non-visual React surfaces.
4. **One question per card** (§2). A chart answers how much, which leads, how it is split, how it evolved, how far from target, or which exact rows; never two of them.
5. **Both themes, always.** Check every change on `/gallery` and on the real view in Neo-Glass **and** Nocturne before handing over.
6. **Switching theme never changes geometry or text.** Sizes and typography are shared; themes change colour, radius (14 / 20), gap (16 / 20) and card padding only.
7. **Motion explains, it never loops** (§7). The only infinite animations are loading spinners (`u-spin`) and the voice equalizer while speaking. Every entrance uses `var(--u-ease)` and works under `prefers-reduced-motion`.
8. **Loading, empty and error states keep the final geometry**: every element takes `loading` (skeleton rows), `error` (note; the last good data stays visible under it), `stale` (dimmed while refetching) and `empty-message`.
9. **Context on demand**: definitions and formulas go in the hover curtain (§6), never as footnotes on the card face.
10. **Accessible by construction**: interactive rows and cards are `<button>`s (or rows with `tabIndex`, `aria-selected` and Enter/Space handlers); toggles expose `aria-pressed`; charts expose `role="img"` + `aria-label`; text roles meet the contrast test.
11. **No pie, no 3D, no dual axis, no gauges.** A composition with more than 6 parts is a ranking.
12. **Tests stay green**: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`.

---

## 1. Theme mechanics

- `<html data-theme="neoglass|nocturne">` selects the token block. `index.html` sets it **before first paint** from `localStorage['powerreact-theme']`, else from `prefers-color-scheme`. `src/store/theme.ts` (`useThemeStore`: `theme`, `setTheme`, `toggle`) keeps it, persists it (storage errors tolerated) and swaps **instantly**: transitions are suppressed for the flip so colours, borders and shadows do not smear (better-ui).
- `dark:` utilities target Nocturne (`@custom-variant dark`). Prefer a token role over `dark:` overrides: a role keeps both themes in one place.
- Template-specific chrome is CSS, not JSX branches: `.u-plane-glow` / `.u-plane-rays` only display in Nocturne; `--u-rule` is transparent in Nocturne; Nocturne tabs are pills.
- **One element can pin a template**: every element takes `theme="neoglass|nocturne"`, which sets `data-theme` on its host; `tokens.css` also matches bare `[data-theme='…']`, so the roles re-resolve there and inherit into the shadow root. Use it for side-by-side comparisons (the gallery's "Pinned template" card); a manifest visual can set `props.theme`.
- **Choose by audience** when a page has a default: Neo-Glass for executive, audit and print; Nocturne for operational monitoring and wall displays. The user's toggle always wins (a manifest's `theme` applies once, when it loads).

---

## 2. Visual selection policy

| Question the module answers | Component | Notes |
| :--- | :--- | :--- |
| How much? (value + delta / context) | `UdpPbiKpiCard` | One card per KPI, 3 columns each (4 per row). Delta (explicit or derived from `comparison-value` + `good-when`) coloured by business meaning; `badge`, `meter`, `caption`, `icon`. |
| One headline metric with supporting figures | `UdpPbiKpiHero` | Dominant number, ≤ 4 metrics, optional 60-tick meter. Takes 7–8 columns. |
| Which category leads? (and can filter the page) | `UdpPbiSpotlightBars` | Label above a slim pill bar, value, share of total over **all** categories (`secondary`), optional `#rank`, `meta` lines, selection dims the rest. |
| Which leads, compact / long lists | `UdpPbiRankingBars` | One line per row; bottom-N stays relative to the overall leader. `mark="lollipop"` (a hairline ending in a dot) when many similar values make solid bars heavy. |
| Two values per category: before → after, plan → actual, raised → closed | `UdpPbiDotPlot` | `variant="dumbbell"` (hollow `from` dot, solid `to` dot on one axis) or `"slope"` (two columns of values); the connector is coloured by `goodWhen`, so the direction reads without a legend; `sort` by `to` or by change. |
| On target per category? | `UdpPbiBulletBars` | Fill = actual, tick = target, variance chip by `goodWhen`. |
| Signed imbalance (net flow, variance), both ends visible | `UdpPbiDivergingBars` | Centre axis; direction by side, sign and end labels, never colour alone. |
| How is a real total split? (2–6 parts) | `UdpPbiDonut` | Total in the hole, legend list with share + value. > 6 parts folds into "Other" and warns: use a ranking. |
| How does a large total split across a hierarchy (many parts)? | `UdpPbiTreemap` | Squarified tiles, ≤ 2 levels (group header + items); colour by group (sequential steps) or by a colour measure (`colorScale` sequential / diverging around `colorCenter`); labels only where they fit; a tile reports its group and itself (`levelFields`). |
| How did it evolve? | `UdpPbiTrendChart` | 1 primary series + ≤ 1 comparison (dashed). Area to zero, or `gap` to shade the difference to the comparison by meaning (`goodWhen`: surplus teal, shortfall red). `referenceLines` (labelled at the start), tooltip measures per period. Direct labels. Crosshair tooltip; a click / Enter reports the period. |
| What happened day by day? (seasonality, quiet spells, peaks) | `UdpPbiCalendarHeatmap` | Weeks × weekdays, whole months, sequential ramp (Less → More, "No data" apart); the grid scrolls horizontally when narrow; ←/→ move a week, ↑/↓ a day; a click reports the engine's date (filters as `DATE()`). |
| When does each item start and end? (warranties, contracts, projects) | `UdpPbiTimeline` | Thin bars with the label above, grouped in lanes, packed into rows; tone by meaning (`ok` / `warn` / `bad` from the data, legend in that order); dashed **Today** line (`today="auto"`, an ISO date or `none`); open-ended items run to the edge. |
| How did a level move from A to B, and through what? | `UdpPbiWaterfall` | IBCS bridge: levels (start / subtotal / end) in `--u-ac`, movements in good / bad by `goodWhen`, dashed connectors, signed labels with a true minus. `orientation="horizontal"` for long step names. `baseline="auto"` starts the axis near the lowest level when the movements are small, and marks the cut levels with break strokes. |
| How far above / below PY, plan, forecast, budget — and where? | `UdpPbiIbcsVariance` | IBCS notation. `orientation="horizontal"` for structures, `"vertical"` for time. See [references/ibcs.md](references/ibcs.md). |
| Which exact rows, owners, statuses? | `UdpPbiDataTable` | Identifiers first, status last (`kind: 'status'` chip), `kind: 'meter'` for ratios; sortable, paginated, a two-line list below 520 px. |
| How much, per period or ordinal band? Several measures side by side? | `UdpPbiColumnChart` | Columns from zero; `layout` grouped / stacked / percent; `variant="histogram"` for continuous bins (bars touch); reference lines labelled in the right margin; totals on top where they fit; ≤ 16 grouped labels. |
| How do parts split per category (long names)? Grades around a midpoint? | `UdpPbiStackedBars` | `stacked` (magnitude), `percent` (spine, 100 %), `diverging` (Likert: `negativeSeries`, `neutralSeries`, shares at both ends), `grouped`. Shares inside ramp segments only (their text tokens are contrast-checked). |
| How do two measures relate? | `UdpPbiScatter` | x / y, optional size (area, √) and group colour; reference lines make labelled quadrants; the selected and top-N points labelled. |
| How is a measure spread within each category? | `UdpPbiBoxplot` | Box = quartiles, line = median (`--u-ac`), diamond = mean (`showMean`), whiskers, outliers. Engine statistics per row (PERCENTILEX) or raw `values` (≤ 5,000 per category, Tukey 1.5 × IQR in the element). `zero` starts the axis at 0. |
| Where does a value concentrate across two dimensions? Exact figures by a hierarchy? | `UdpPbiMatrix` | Treegrid (1–3 row levels, expand / collapse), optional pivot, heatmap per value (sequential, or diverging by `goodWhen` around `center`) on the deepest rows only; totals passed in from the engine. |

**Not in the vocabulary, on purpose** (FT Visual Vocabulary): pie, 3D, dual axis, gauges (§0.11); radar, parallel coordinates, isotype, marimekko (hard to read); violin, beeswarm, barcode, Lorenz, bump, streamgraph, chord, network (no fitting data); Sankey (deferred until a report has source → target flows; bridges use the waterfall); maps (deferred until the UDP GIS integration is decided).

**Palettes by meaning** (`palette` on series charts, `src/utils/palette.ts`): `categorical` for nominal series (≤ 6, the rest fold into "Other"), `sequential` (`--u-seq-1..7`) for ordered magnitudes, `diverging` (`--u-div-1..7`, bad → good, picked symmetrically) for grades around a neutral. Each step has a text token (`--u-seq-text-k`, `--u-div-text-k`) checked at 4.5:1. **Chart kit** (`src/functional/chart-kit.tsx`): gridlines, reference lines, legend, the tooltip rows (series + tooltip measures); **keyboard** (`src/utils/roving.ts`): one tab stop per chart, arrows move the active mark and its tooltip, Enter / Space select, Esc clears — never animated.
| Filter the page | `Tabs` / `Tab` (framed buttons, §5.1), search `u-input` | Toggles use `aria-pressed`; the selected button *is* the visible state (no second chip for it); removable chips show the other active filters. |

Web components lift the Power BI limitation that HTML visuals are display-only: **every element may cross-filter** — it emits `dataPointClick { visualId, field, value, label, filters? }` and the container decides what that filters (see powerreact-visual-builder). A mark with two dimensions (matrix cell, stacked segment) lists both in `filters`; slicers are controls of the container (`ManifestSlicer`), not elements.

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
- **Container queries cross the shadow boundary**: an element's `@container (min-width: 28rem)` resolves against the nearest container in the flat tree, so a KPI card answers to the report's data area exactly as the React card did. Chart cards are containers themselves (`.u-card--frame`), so their header, tables and charts adapt to the card's own width.
- **Padding**: cards use `--u-card-pad` (`.u-card--pad`, default in `Card`); KPI cards `--u-kpi-pad`.
- **Radii**: cards `--u-card-radius` (14 / 20), controls 8–9 px, chips 6 px, pills full. Never mix arbitrary radii.

---

## 5. Components

The visuals are the Univerus elements (`packages/udp-powerbi-visuals`), used in React through the generated wrappers exported by `src/components/powerbi-visuals`. React chrome lives in `src/components/ui`. See `/gallery` for each one rendered in the active theme.

```tsx
import { UdpPbiKpiCard, UdpPbiSpotlightBars } from '../powerbi-visuals';

<ReportTemplate eyebrow="Asset Management" title="Asset Portfolio Overview" meta={<span>Updated <time>10:53</time></span>}
                actions={<>{briefingButton}<ReportDetails onOpenInspector={…} />{refreshButton}</>} toolbar={<FilterBar />}>
  <div className="grid grid-cols-2 gap-(--u-gap) @4xl:grid-cols-4">
    <UdpPbiKpiCard index={2} heading="Due For Renewal" icon="alert-triangle" value={687}
                     badge={{ text: '6.9%', detail: 'of assets', tone: 'warn' }}   {/* "None due" (ok) at 0 */}
                     active={focus === 'renewal'} onDataPointClick={() => toggleKpiFocus('renewal')}
                     loading={isPending} error={errorText} stale={isPlaceholderData}
                     info="Assets whose renewal date is on or before today…" calc="[Assets Due For Renewal]" />
  </div>
  <UdpPbiSpotlightBars index={4} className="@5xl:col-span-5" heading="Asset Distribution by Group"
                         subheading="Asset count and share of the register" info="…" calc="[Asset Count (All States)] by …"
                         data={rows /* {id, label, value, raw?, meta?}[] */} secondary="share-paren" selectedBadge="Cross-Filtered"
                         selectedValue={group} crossFilterField={GROUP_COLUMN} testIdPrefix="group"
                         onDataPointClick={(e) => toggleGroup(String(e.detail.value))}>
    <span slot="aside" className="u-num text-[11px] text-u-label">5 groups</span>
  </UdpPbiSpotlightBars>
</ReportTemplate>
```

**The element contract.** Data and state in (`data` / `rows` / `categories`…, `format`, `loading`, `error`, `stale`, `selected-value`, `cross-filter-field`, `theme`, `frame`), events out — never a fetch, never DAX:

| Event | Detail | When |
| :--- | :--- | :--- |
| `dataPointClick` | `{ visualId, field, value, label, filters? }` (`value` is the category's raw value; `filters` lists every dimension of a multi-dimensional mark — matrix cell, stacked segment — so the container applies them in one update) | Click / Enter on a bar, row, segment, cell, point, legend row, period or KPI |
| `exportData` | `{ visualId, format, fileName, rowCount }` | After a CSV / Excel file was generated and downloaded (on the client) |
| `focusModeChange` | `{ visualId, open }` | Focus view opened / closed |
| `viewChange` | `{ visualId, view: 'chart' | 'table' }` | Table view toggled |

**`frame`** (charts and tables): `card` (default) is the approved template — card, header, toolbar, curtain, focus view; `none` renders the visual alone (states, tooltip, keyboard and events intact) for a host that brings its own card, e.g. `udp-fluent-card` inside UDP. KPI elements are cards by design and have no `frame`.

The card title is **`heading`** (`title` is a global HTML attribute: it would put a tooltip on the host). Slots: `aside` (counters, legends, a search box, scenario tabs) and `footer` on every chart; `aside`, `footer` and `icon` on the KPI card.

**The standard toolbar** (every chart and table card, `.u-icon-btn`, 150 ms, press `scale .96`): **Export data** (menu: Export CSV / Export Excel; RFC 4180 + BOM + formula-injection guard, SheetJS loaded on demand; the raw query rows when the container passes `export-rows`), **Table view** (`aria-pressed`; the same data as a sortable `udp-pbi-data-table`; not on the data table itself), **Focus view** (a native modal `<dialog>`: top layer, focus trapped, Esc closes and focus returns to the button; enters in 250 ms from `scale(.95)`; the card keeps its size meanwhile) and **ⓘ** (the curtain). KPIs keep their face clean: the same actions sit in a compact **⋯** menu (`More options for <label>`), shown on hover / focus, always on touch. Turn tools off with `exportable`, `table-toggle`, `focusable` (the `/visuals` KPIs are filter toggles and switch the ⋯ off to keep one tab stop per card).

| Component | Key props |
| :--- | :--- |
| `ReportTemplate` | `eyebrow`, `title`, `meta`, `actions`, `toolbar`, `contentClassName` (bottom room, e.g. for the mini-player), children (scrolling data area, `data-testid="report-content"`) |
| Every Univerus element | `visualId`, `heading`, `info`, `calc` (curtain), `format` (`{style: integer|decimal|percent|currency|compact, decimals?, currency?}`), `loading`, `error`, `stale`, `index` (entrance stagger), `theme`, `exportable`, `exportFormats`, `exportFileName`, `exportRows`, `focusable` |
| Every chart / table element | + `subheading`, `label` (the chart's accessible name; default heading), `emptyMessage`, `selectedValue`, `crossFilterField`, `interactive` (default: when a field is set), `tableToggle`, `testIdPrefix` (`${p}-bar-${id}`, `${p}-share-${id}`, `${p}-row-${key}`) |
| `UdpPbiKpiCard` | `heading` (the label), `value` / `displayValue`, `caption`, `delta {text, favourable}` or `comparisonValue` + `goodWhen` + `deltaLabel`, `badge {text, tone, detail}`, `meter {value 0..1, label, detail}`, `icon` (named: `database`, `check-circle`, `alert-triangle`, …), `active` (leave undefined for a plain action: no `aria-pressed`, no ring), `interactive` — `data-testid="kpi-<label-slug>"` on the number, `kpi-card-<label-slug>` on the card |
| `UdpPbiKpiHero` | `heading`, `value` / `displayValue`, `unit`, `delta` or `comparisonValue`, `metrics[≤4] {label, value, format}`, `meter {label, value 0..1}` |
| `UdpPbiSpotlightBars` | `data: {id,label,value,raw?,meta?}[]`, `secondary: share|share-paren|none`, `topN`, `rank`, `selectedBadge` |
| `UdpPbiRankingBars` | `data`, `topN`, `order: 'desc'|'asc'`, `mark: 'bar'|'lollipop'` |
| `UdpPbiDotPlot` | `items: {id,label,from,to,raw?,tooltips?}[]`, `variant: dumbbell|slope`, `fromLabel`, `toLabel`, `goodWhen`, `sort: none|to|change`, `categoryLabel`, `chartHeight` — `${p}-row-${id}` |
| `UdpPbiBulletBars` | `data: {id,label,actual,target}[]`, `goodWhen: 'above'|'below'`, `topN`, `targetLabel` |
| `UdpPbiDivergingBars` | `data`, `negativeLabel`, `positiveLabel`, `maxRows` |
| `UdpPbiDonut` | `data`, `centerLabel`, `size` |
| `UdpPbiTreemap` | `nodes: {id,label,value?,colorValue?,children?,raw?,tooltips?}[]`, `levelFields` (group, item columns), `colorLabel`, `colorFormat`, `colorScale`, `goodWhen`, `colorCenter`, `levelLabels`, `chartHeight` — `${p}-group-${id}`, `${p}-tile-${group}/${item}` |
| `UdpPbiTrendChart` | `categories`, `series: {id,label,role:'primary'|'comparison',values}[]`, `area`, `directLabels`, `gap`, `goodWhen`, `referenceLines: {value,label?}[]`, `categoryTooltips: TooltipItem[][]`, `chartHeight` |
| `UdpPbiCalendarHeatmap` | `days: {date (ISO), value, raw?, tooltips?}[]`, `valueLabel`, `weekStart: monday|sunday` — `${p}-day-YYYY-MM-DD` |
| `UdpPbiTimeline` | `tasks: {id,label,start,end|null,lane?,tone?: ok|warn|bad|accent|neutral,raw?,tooltips?}[]`, `today`, `toneLabels`, `categoryLabel`, `laneLabel` — `${p}-item-${id}` |
| `UdpPbiWaterfall` | `steps: {id,label,value,kind?: start|delta|subtotal|end,raw?,tooltips?}[]` (without `kind`: first starts, last ends), `goodWhen`, `orientation`, `baseline: zero|auto`, `labels: auto|none`, `categoryLabel`, `chartHeight` — `${p}-step-${id}` |
| `UdpPbiBoxplot` | `items: {id,label, min?,q1,median,q3,max?,mean?,count? | values: number[]}[]`, `showMean`, `zero`, `categoryLabel` — `${p}-row-${id}` |
| `UdpPbiIbcsVariance` | `data: {id,label,actual,comparison}[]`, `orientation`, `scenario: PY|PL|FC|BU`, `goodWhen: higher|lower`, `actualLabel`, `comparisonLabel`, `sort`, `topN`, `pctCap`, `decimals`, `chartHeight` |
| `UdpPbiDataTable` | `columns: {key,label,kind?: text|number|meter|status,format?,ratioKey?,suffix?,tone?,emptyLabel?}[]`, `rows`, `rowKey`, `sortable`, `paginated`, `pageSize` (10/25/50), `maxHeight`, `bare` (table only) |
| Primitives (React) | `StatusChip tone`, `Tabs`/`Tab active`, `Legend items`, `MiniMeter value`, `RemovableChip`, `LoadingState rows`, `EmptyState`, `ErrorNote error` |
| `Popover` | `label`, `trigger`, `triggerClassName`, `children(close)` — anchored panel (Esc / outside click close, focus returns to the trigger); below `sm` it spans the report header |
| `Sheet` | `open`, `onClose`, `title` — side sheet in a portal (560 px, full screen on phones) for secondary tools |
| `ReportDetails` | `onOpenInspector` — the header's ⓘ "Details": model, dataset id (copy), engine, auth, last latency, query count, "Open DAX Inspector" |
| `VoiceBriefingOrb` | `open`, `onOpenChange` (dialog opened from the header's Briefing button), `onPlayingChange`, `onFocus`, `onResetAll` |
| CSS classes | `.u-btn` (primary), `.u-btn-ghost` (+ `aria-pressed`), `.u-icon-btn` (+ `aria-pressed`), `.u-input`, `.u-chip[data-tone]`, `.u-tab` / `.u-tabs`, `.u-scroll-x`, `.u-table` (+ `.u-table--stack`, `.u-cell-end`), `.u-chart-scroll`, `.u-tooltip`, `.u-status-dot`, `.u-eyebrow`, `.u-num` |

Bar lengths come from pure layout functions (`rankedRows`, `bulletRows`, `divergingRows`, `donutLayout`, `trendDomain`, `ibcsRows`/`ibcsScales`/`pctMarker`, `waterfallLayout`, `treemapLayout`, `calendarLayout`, `timelineLayout`, `dotPlotRows`/`dotDomain`, `boxStats`) in `packages/udp-powerbi-visuals/src/utils/layout/`. Put new chart math there with a unit test, never inline in JSX. Charts that draw SVG in real pixels (trend, IBCS) measure the box they draw into with `WidthObserver` (card body or focus dialog).

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

- **KPI cards / hero**: opens on hover **and** keyboard focus (`.u-curtain-host`); `pointer-events: none`, so the card's click still works. The card exposes the text through `aria-describedby` (inside the element's shadow root). On touch screens (`hover: none`) an ⓘ in the icon slot toggles it (§5.2).
- **Chart cards**: opens from the **ⓘ** button in the header (`aria-expanded`), closes with the button, **Esc**, a click on the curtain or focus leaving the card. Never on hover: it would cover bars and rows exactly when the user aims at them.
- Text comes from the semantic model's measure descriptions (`EVALUATE INFO.VIEW.MEASURES()`); keep them in a definitions module (e.g. `src/components/visuals/kpiDefinitions.ts`) and mark wording that is not from the model (`pendingModelDescription`).
- Under `prefers-reduced-motion` it appears without sliding.

---

## 7. Motion

- Cards rise once (`u-rise` .7 s, stagger `--i` × 80 ms). Rows fade with `--k`. Bars grow from zero (`u-grow`, `transform-origin: left`) and transition `width` on data changes. Lines are revealed with a single wipe (`u-wipe`); donut segments with `u-seg`; the hero meter wipes in.
- Ease is always `var(--u-ease)` = `cubic-bezier(.16,1,.3,1)`.
- No pings, pulses or floating loops on data or chrome. A live state is a static `.u-status-dot` with a halo.
- `motion.css` (imported by `base.css` and by every element, because document rules do not reach into shadow roots) collapses every animation and transition under `prefers-reduced-motion: reduce`; nothing may depend on an animation finishing.
- **Interaction feedback is fast and interruptible**: controls (`.u-btn`, `.u-btn-ghost`, `.u-icon-btn`, `.u-tab`) transition named properties in 150 ms ease-out and press to `scale: 0.96`; dialogs enter in 250 ms from `scale(0.95)`. Never `transition: all`.
- **Hover effects only on hover-capable pointers** (`@media (hover: hover) and (pointer: fine)`): card lift and the KPI curtain; keyboard focus still opens the curtain.
- **Overlays render through a portal** to `document.body`: the plane's `backdrop-filter` would otherwise trap `position: fixed` layers inside it. Inside the elements, overlays use the **top layer** instead (native `<dialog>` with `showModal()`, `popover="auto"` menus): it escapes the card's `overflow` and the plane's `backdrop-filter` without leaving the shadow root.

UI polish and motion details beyond this contract come from the vendored `better-ui` and `emil-design-eng` skills; where they disagree with this document, this document wins (precedence and resolved conflicts: powerreact-visual-builder, "Companion skills").

---

## 8. Adding or changing a component

1. Pick the element from §2; if none fits, write a new one in `packages/udp-powerbi-visuals/src/components/<kpi|charts|tables>/udp-pbi-<name>/` (`udp-pbi-<name>.tsx` + `.css`, class `UdpPbi<Name>`, `shadow: true`, `styleUrls: [tokens-bridge, motion, shadow, surfaces, (charts), own]`, a `frame: VisualFrameMode` prop for charts and tables) with its math in `utils/layout/` (+ test) and colours only from `var(--pbi-*)`. Nothing PowerReact-specific goes in the package (no store, no DAX, no app imports): it must stay copy-ready for UDP (`MIGRATION.md`).
2. Declare the shared contract (props and the four events: copy them from an existing element) and render through `VisualFrame` (`hasData`, `renderChart`, `renderTable`, `model`), which brings the header, the standard toolbar, the curtain, the states and the focus dialog. Use `<udp-pbi-data-table bare>` for the table view, written in the component file itself (Stencil detects nested tags per module).
3. `npm run elements:build` regenerates the React wrapper; export its data types from `src/index.ts` if React needs them.
4. Add it to `/gallery` with fixtures in `src/components/powerbi-visuals/__fixtures__/samples.ts`, an SSR smoke test in `elements.ssr.test.ts` (full and empty data), and — for manifests — a schema entry, a `mapRows` case and a registry entry (powerreact-manifest).
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
| `bg-slate-800`, `text-teal-600`, `#34A7AD` in a component | No CSS generated / test failure; breaks the other theme | Token role: `bg-u-*`, `text-u-*` in the app; `var(--pbi-*)` in the package |
| Colour picked with `dark:` per component | Two sources of truth per role | Add or reuse a role in `tokens.css` |
| Hand-made card (`rounded-xl border shadow`), or an element wrapped in a card | Wrong radius / blur / border per theme; nested cards | The element is the card |
| Curtain on hover over an interactive chart | Covers bars when the user aims at them | `info` / `calc` on the element (ⓘ) |
| A Tailwind class or a document class inside a shadow root | No style: utilities do not cross the boundary | Plain CSS in the element with `var(--pbi-*)`; shared classes come from the package's `surfaces.css` |
| A module named `*spec.ts` / `*e2e.ts` in the package | Stencil silently skips it (it assumes a test) and the build fails with a Rollup parse error | Another name (`formats.ts`, not `format-spec.ts`) |
| A nested element tag only inside a shared functional component | Stencil does not define it with the parent | Write `<udp-pbi-data-table>` in the component's own file |
| `title` as a prop of an element | A native tooltip on the whole host | `heading` |
| Setting `data` / `columns` as HTML attributes | Arrays and objects need properties | Use the React wrapper (it sets properties) or assign the property in JS |
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
