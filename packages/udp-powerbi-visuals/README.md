# udp-powerbi-visuals

The Univerus Power BI visuals as **presentational Stencil web components**, laid out like UDP's
`udp-stencil-component-library` so they can move there unchanged once approved (see
[MIGRATION.md](MIGRATION.md)). PowerReact renders them through generated React 18 wrappers
(`src/components/powerbi-visuals`), both on hand-built pages and from declarative manifests.

- **Presentational only.** Data and state in (props), typed events out. An element never fetches,
  never builds DAX and never knows the semantic model: the container does.
- **The approved template.** Neo-Glass / Nocturne from Univerus-Lens: tokens, card, toolbar,
  curtain, IBCS notation, motion. `frame="none"` drops the card for hosts that bring their own.
- **Themeable anywhere.** Every role is read as `--pbi-<role>`, bridged to the Univerus tokens when
  present and to the Fluent tokens otherwise (UDP light / dark).

## Elements

| Tag | Family (FT) | Answers |
| :--- | :--- | :--- |
| `udp-pbi-kpi-card` | KPI | How much? Value, delta by business meaning, badge, meter. |
| `udp-pbi-kpi-hero` | KPI | One headline metric with up to four supporting figures. |
| `udp-pbi-kpi-trend` | KPI · Change | How much, and which way is it going? Number, delta and a sparkline of the recent periods (min / max, target line). |
| `udp-pbi-kpi-bullet` | KPI · Magnitude | How far from target? A bullet graph: qualitative bands, value bar, target tick, forecast marker, status chip. The replacement for gauges. |
| `udp-pbi-kpi-variance` | KPI · Deviation | Better or worse than PY / PL / FC / BU? AC, the scenario, ΔAbs and Δ% in IBCS notation. |
| `udp-pbi-spotlight-bars` | Ranking | Which leads? Label above a slim bar, share of total. |
| `udp-pbi-ranking-bars` | Ranking | Which leads, compact and long lists; a slim bar or a lollipop (`mark`). |
| `udp-pbi-dot-plot` | Ranking · Change | Two values per category: dumbbell (before → after, plan → actual) or slope. |
| `udp-pbi-bullet-bars` | Magnitude | On target per category? |
| `udp-pbi-column-chart` | Magnitude · Change over time · Distribution | Columns: single, grouped, stacked, 100 %, histogram; reference lines. |
| `udp-pbi-diverging-bars` | Deviation | Signed imbalance, both ends visible. |
| `udp-pbi-ibcs-variance` | Deviation | How far above / below PY, plan, forecast, budget (IBCS). |
| `udp-pbi-stacked-bars` | Part-to-whole · Deviation | Horizontal stacked, 100 %, diverging (Likert), grouped. |
| `udp-pbi-donut` | Part-to-whole | How a real total splits (2–6 parts). |
| `udp-pbi-treemap` | Part-to-whole | How a large total splits across a two-level hierarchy (group › item). |
| `udp-pbi-trend-chart` | Change over time | One series and an optional comparison over time; the gap shaded by meaning, reference lines. |
| `udp-pbi-calendar-heatmap` | Change over time | Daily values over weeks and months; a clicked day filters as a date. |
| `udp-pbi-timeline` | Change over time | Items from start to end in lanes (warranties, contracts, projects), today marked. |
| `udp-pbi-waterfall` | Flow · Deviation | How a level moved from one value to another (IBCS bridge); vertical or horizontal. |
| `udp-pbi-boxplot` | Distribution | The spread per category: quartiles, whiskers, mean, outliers (engine statistics or raw values). |
| `udp-pbi-scatter` | Correlation | How two measures relate; bubble size; quadrants. |
| `udp-pbi-matrix` | Correlation · Exact values | Pivot with expandable rows and heatmap; totals from the engine. |
| `udp-pbi-data-table` | Exact values | Which rows: sortable, paginated, chips and meters. |
| `udp-pbi-point-map` | Spatial | Where exactly? Locations at their WGS 84 coordinates: dots, bubbles, spikes (2.5D), hexagonal bins, density contours; flat or on a globe. |
| `udp-pbi-choropleth` | Spatial | How does a rate vary by region? Classed or continuous fills, diverging around a centre, an equal-area tile map, or a globe. |

Each component's props, events and slots are in its `readme.md`, generated from the source on every
build (`src/components/<family>/<tag>/readme.md`); `docs/components.json` holds the same as JSON.

## Contract

| Kind | Details |
| :--- | :--- |
| Common props | `visualId`, `heading`, `subheading`, `label` (accessible name), `info` + `calc` (curtain), `format`, `loading`, `error`, `stale`, `emptyMessage`, `index`, `theme`, `testIdPrefix`, export (`exportable`, `exportFormats`, `exportFileName`, `exportRows`), `focusable`, `tableToggle` |
| Selection | `selectedValue` (+ `selectedSeries` / `selectedColumn` where there is a second dimension), `crossFilterField` (+ `seriesField`, `columnField`, `rowFields`), `interactive` |
| `frame` | `card` (default): the template card with header, toolbar (Export · Table · Focus · ⓘ), curtain and focus view. `none`: the visual alone, states and interaction intact, for a host card (UDP: `udp-fluent-card`). Charts and tables only; KPI elements are cards by design. |
| `theme` | `neoglass` / `nocturne` pins one element to a template, whatever the page theme. |
| Events | `dataPointClick { visualId, field, value, label, filters? }` (`filters` lists every dimension of a multi-dimensional mark: matrix cell, stacked segment), `exportData`, `focusModeChange`, `viewChange` |

## Tokens: the bridge

`src/styles/tokens-bridge.css` declares every role once:

```css
:host, :root, [data-theme] {
  --pbi-title: var(--u-title, var(--colorNeutralForeground1));
  --pbi-seq-3: var(--u-seq-3, color-mix(in srgb, var(--colorBrandBackground) 40%, var(--colorNeutralBackground1)));
  /* … */
}
```

Components and shared styles read only `--pbi-*`. In PowerReact the `--u-*` values come from
`src/theme/tokens.css` (Neo-Glass / Nocturne); in UDP they are absent and the Fluent tokens of the
active platform theme apply. No colour literal exists in the package (`noRawColors.test.ts`), and
`src/theme/tokensBridge.test.ts` fails when a role is missing from the bridge or an element reads
`--u-*` directly. When an element needs a new role, add it to `tokens.css` (both themes), then to the
bridge with its Fluent fallback.

## Maps

- **Boundaries come from the host**: `geometry` takes a TopoJSON topology (with `geometryObject` /
  `contextObject`) or a GeoJSON FeatureCollection in WGS 84. The element never fetches; PowerReact
  serves public-domain Natural Earth sets from its own `/geo` folder (`public/geo`, built by
  `scripts/build-geo.mjs`). Regions match by ISO 3166 code, postal code or name; rows the boundaries
  do not know are listed under the map, never dropped silently.
- **Projections**: `auto` (Mercator for a city or region, conformal conic for a continent, Equal
  Earth for the world), or `mercator`, `conic`, `equal-earth`, `globe` (orthographic: drag to turn,
  the arrow keys walk the locations and turn the globe to them; never spins by itself).
- **Basemap**: vector by default (free, offline, themed by `--pbi-map-*`). A host may pass `tiles`
  (`{url, attribution}`, Web Mercator `{z}/{x}/{y}`): in UDP, its Azure Maps key.
- **Zoom**: the buttons, Ctrl + wheel or a pinch; the page keeps its scroll, and dragging pans only
  once zoomed in.

## Layout

```
src/
  components/
    kpi/      udp-pbi-kpi-card, udp-pbi-kpi-hero, udp-pbi-kpi-trend, udp-pbi-kpi-bullet, udp-pbi-kpi-variance
    charts/   udp-pbi-column-chart, udp-pbi-stacked-bars, udp-pbi-scatter, udp-pbi-waterfall, udp-pbi-treemap, udp-pbi-point-map, udp-pbi-choropleth, …
    tables/   udp-pbi-data-table, udp-pbi-matrix
  functional/ frame.tsx (card, toolbar, curtain, focus dialog), kpi-shell.tsx (the KPI cards' shared shell), chart-kit.tsx (grid, reference lines, legend, tooltip), map-kit.tsx (base layers, tiles, zoom / globe controllers, map legends), states, icons
  utils/      layout math (series, scales, matrix, scatter, bars, donut, ibcs, trend, waterfall, treemap, calendar, timeline, dot plot, boxplot, geo, kpi) with unit tests, palette, roving keyboard model, formats, export (CSV / XLSX), table model
  styles/     tokens-bridge.css, motion.css, shadow.css, surfaces.css, charts.css, kpi.css, maps.css
```

Build outputs (`npm run elements:build` from the repository root): `components/` (custom elements,
what the React wrappers import), `hydrate/` (server renderer for the SSR smoke tests), `docs/`
(`components.json`) and the per-component readmes.

## Tests

- Layout math: `src/utils/**/*.test.ts` (Vitest, run by the root `npm test`).
- Every element rendered full and empty through the hydrate renderer:
  `src/components/powerbi-visuals/elements.ssr.test.ts`.
- Token guards: `src/theme/{contrast,noRawColors,tokensBridge}.test.ts`.
- Behaviour in the browser: `e2e/gallery.spec.ts` (toolbar, keyboard, both themes) and the manifest specs.

Adding a component: the `powerreact-design-system` skill (§8) is the recipe.
