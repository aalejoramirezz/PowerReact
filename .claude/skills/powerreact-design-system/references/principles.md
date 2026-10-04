# Univerus dashboard principles, adapted to React

Source: Univerus-Lens `design_specs/DASHBOARD_PRINCIPLES.md` (numbering kept). The **Enforced by** column names what makes each principle mechanical in PowerReact; "Judgement" means the author applies it before handing over.

> Design dashboards as analytical instruments, not collections of charts. Every visual answers one question; every pixel clarifies data, establishes hierarchy or helps a decision.

**Before adding any element:** does it help the user compare, spot an anomaly, understand a trend or make a decision? If not, remove it.

## Structure and layout

| # | Principle | Enforced by |
| :--- | :--- | :--- |
| 1 | **Hierarchy first, charts second.** Read order: context → KPIs → main trend → breakdowns → detail. | `ReportTemplate` (header → toolbar → content); page composition review |
| 2 | **Consistent 12-column grid.** Primary 7–8 columns, secondary 4–5, KPI 3. | `grid-cols-12` / `lg:col-span-*`; `/gallery` layouts |
| 3 | **A spacing system, never random values.** 8 / 12 / 16 / 20 / 24 / 32 px. | `--u-gap`, `--u-card-pad`, `--u-kpi-pad` tokens |
| 4 | **Proximity communicates relationship.** Title + subtitle close; legend next to the chart. | `ChartCard` header layout |
| 5 | **One card, one purpose.** | §2 selection policy; one component per `ChartCard` |
| 6 | **Not every visual needs a heavy card.** Light: subtle translucent glass; dark: dark glass with low-opacity borders. | `.u-card` from tokens |
| 7 | **The main insight gets the most space.** | Judgement; spans 7–8 for the main visual |
| 8 | **No charts that are too short.** If it cannot get height, make it a KPI or remove it. | `TrendChart` default height 260; judgement |
| 9 | **Control density.** One narrative + 3–6 supporting blocks per viewport. | Judgement |
| 10 | **Align to invisible lines.** Adjacent cards share baseline and height for the same role. | Shared grid rows, `minHeight` on KPI cards |
| 11 | **One radius per level.** Cards 14 (Neo-Glass) / 20 (Nocturne); controls 8–9; chips 6; pills full. | `--u-card-radius`, surface classes |
| 12 | **Whitespace over decoration.** | Judgement |
| 13 | **Responsive is not blind stacking.** Mobile order follows importance. | Container queries on the report area (`@md:` / `@4xl:` / `@5xl:`), so the chat drawer reflows the grid; judgement |

## Choosing the visual

| # | Principle | Enforced by |
| :--- | :--- | :--- |
| 14 | **Lines for evolution over time.** One dominant series, comparisons quieter. | `TrendChart` (`validateTrendSeries`: 1 primary, ≤ 1 comparison, dev warning) |
| 15 | **Area to stress magnitude**, same hue fading to zero; never competing with the line. | `TrendChart area` (domain includes 0, `--u-area-opacity`) |
| 16 | **Bars for comparison and ranking**, sorted high → low unless naturally ordered; quiet track, the bar is the message. | `rankedRows` sort + stable tie-break; `--u-track` |
| 17 | **Donut only for simple composition** (2–6 parts of a real total). | `donutLayout` folds > 6 into "Other" + dev warning |
| 18 | **KPI cards answer "how much", not "why".** No decorative sparklines. | `KpiCard` API (value, label, delta) |
| 19 | **Tables when precision matters.** | `ChartCard` + `.u-table` |
| 20 | **No redundant visualizations.** | Judgement |
| 21 | **No dual axis.** | No dual-axis component exists |
| 22 | **No 3D.** Depth lives in the surface, not the data. | No 3D component exists |

## Colour, contrast and chrome

| # | Principle | Enforced by |
| :--- | :--- | :--- |
| 23 | **Functional colour hierarchy**: primary, secondary, neutral, grid, track, interaction. No new colour per chart. | `tokens.css` roles; `noRawColors.test.ts` |
| 24 | **1–2 dominant colours per chart**; tonal scale before new hues. | `--u-series-*` tonal order |
| 25 | **Consistent semantics across pages.** | Fixed roles; `ok` / `warn` / `bad` |
| 26 | **The grid disappears before the data.** Light: soft solid; dark: white 9 % dashed. | `--u-grid`, `--u-grid-dash` |
| 27 | **Reduce axis noise.** No plot borders, no axis titles, only needed ticks. | `TrendChart` (4 ticks, no axis titles) |
| 28 | **Legends are secondary**; label series directly where possible. | `Legend` (11 px, muted); `TrendChart directLabels` |
| 29 | **Interactions concentrate contrast.** Tooltip inverts (white on Nocturne, ink on Neo-Glass); active point gets the interaction ring. | `--u-tooltip-*`, `.u-tooltip`, crosshair in `TrendChart` |
| 30 | **No decorative shadows.** Light: wide ~4 %; dark: inset highlight + translucent border. | `--u-card-shadow` per theme |
| 31 | **Aesthetics never reduce legibility.** | `contrast.test.ts` (AA 4.5:1 for text roles; 3:1 floor for the Lens-specified secondary greys) |

## Motion and states

| # | Principle | Enforced by |
| :--- | :--- | :--- |
| 32 | **Animation explains, it doesn't decorate.** Lines draw once, bars grow from zero, segments appear progressively. No loops. | `base.css` keyframes; no `animate-ping` / decorative pulses |
| 33 | **Works perfectly without animation.** | Global `prefers-reduced-motion` block; `e2e/theme.spec.ts` |
| 34 | **Empty and loading states keep the final geometry.** | `LoadingState rows`, `EmptyState`, `ErrorNote`; SSR empty-data tests |
| 35 | **Context on demand, not on the canvas.** "What it means / how it is calculated" lives in the curtain. | `InfoCurtain` via `KpiCard` / `KpiHero` (hover + focus) and `ChartCard` (ⓘ) |

## Variance (IBCS)

| # | Principle | Enforced by |
| :--- | :--- | :--- |
| 36 | **Scenarios have one look each**: AC solid strongest neutral; PY solid grey; PL outlined; FC dashed; BU dotted. Never brand colours for scenarios. | `SCENARIO_STYLE`, `--u-ac`, `--u-secondary` |
| 37 | **Show the variance, not only the two values**: ΔAbs bars + Δ% pins aligned with AC vs comparison. | `IbcsVariance` three panels |
| 38 | **Colour by business meaning, not by sign.** | `goodWhen` (`IbcsVariance`, `BulletBars`), `KpiDelta favourable` |
| 39 | **One scale, one unit** (K / M / bn) stated in the panel titles. | `scaleUnit` (K from 10,000) |
| 40 | **Time runs left to right, structure top to bottom.** | `orientation` (`vertical` defaults to natural order) |
| 41 | **Mark outliers instead of flattening the chart**: beyond ±200 % at the cap as a triangle with the real label. | `pctMarker` / `pctCap` |

## What changes from Power BI (Lens) to React

- **Interaction is everywhere.** In Power BI, HTML Content visuals are display-only and anything that filters must be native or Deneb. In React every component can cross-filter (`onSelect` → filter store).
- **Backdrop blur works** on cards and panels (one document, no iframes).
- **Direct series labels** are available, so trends label their last point instead of relying on a legend.
- **Web fonts** (Space Grotesk, Montserrat) are used everywhere; Lens restricts native visuals to Segoe UI.
- **Sizes are real CSS pixels** in a responsive grid, not a fixed 1920 × 1080 canvas: Nocturne radii and paddings are scaled ~0.7.
