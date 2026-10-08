# AGENTS.md — PowerReact

> Instructions for **any AI coding agent** (Claude Code, OpenAI Codex, Google Gemini / Antigravity, Cursor, Copilot…) working in this repository. They are tool-neutral: plain Markdown contracts, npm scripts and tests.

## 1. What this repository is

PowerReact renders **native visuals** on top of a **Power BI / Microsoft Fabric semantic model**, queried live with DAX through the Service Principal `executeQueries` API, instead of embedding Power BI iframes. It also embeds a classic Power BI report for comparison, a Fabric Data Agent chat and an AI voice briefing that cross-filters the visuals as it speaks.

The visuals are **Stencil web components** (`packages/udp-powerbi-visuals`), 100 % presentational: props in, typed events out, no fetching and no DAX. The package follows the conventions of Univerus' official UDP component library (tags `udp-pbi-*`, one folder per component with its generated readme, Fluent-token fallback) so it can move there unchanged once approved (`packages/udp-powerbi-visuals/MIGRATION.md`); keep PowerReact-only logic out of it. The React 18 app wraps them (generated wrappers) and owns all data logic. A **manifest engine** renders a whole report from a `manifest.json` (produced by Univerus-Lens or written by hand) on `/manifest-preview`.

The UI follows the **Univerus design system** ported from the sibling repo Univerus-Lens: two templates, **Neo-Glass** (light) and **Nocturne** (dark), switched app-wide with the dark-mode button.

## 2. Architecture

```
packages/udp-powerbi-visuals/   Stencil web components (npm workspace), UDP layout, Shadow DOM, styled only with var(--pbi-*) · README.md · MIGRATION.md
  src/components/kpi/           udp-pbi-kpi-card · udp-pbi-kpi-hero · kpi-trend · kpi-bullet · kpi-variance
  src/components/charts/        udp-pbi-spotlight-bars · ranking-bars · bullet-bars · column-chart · diverging-bars · ibcs-variance ·
                                stacked-bars · donut · trend-chart · scatter · waterfall · treemap · calendar-heatmap ·
                                dot-plot · timeline · boxplot · point-map · choropleth
  src/components/tables/        udp-pbi-data-table · udp-pbi-matrix   (each folder: .tsx · .css · readme.md generated; src/components.d.ts generated, committed)
  src/functional/               frame.tsx (template card or frame="none"; toolbar Export · Table · Focus · ⓘ curtain, focus <dialog>) ·
                                kpi-shell.tsx (KPI card shell) · chart-kit.tsx (grid, reference lines, legend, tooltip) ·
                                map-kit.tsx (base layers, tiles, zoom / globe, map legends) · states · icon · meter
  src/styles/                   tokens-bridge.css (--pbi-<role> = var(--u-<role>, Fluent token)) · motion.css · surfaces.css (both shared with the app) · shadow.css · charts.css
  src/utils/                    layout/* (chart math, tested) · palette.ts · roving.ts · series-chart.ts · formats.ts · table/* · export/{csv,xlsx} · events.ts · icons.ts
  build output (ignored)        components/ (custom elements) · hydrate/ (SSR, tests) · docs/components.json · dist/types
server/                         Express BFF (strict TypeScript)
  config.ts                     env, preconfigured reports, PBI_ALLOWED_DATASETS
  auth/tokenCache.ts            Entra ID client-credentials tokens (cached, de-duplicated)
  services/powerbi.ts           embed config / tokens, executeQueries
  services/fabric.ts            workspaces, Data Agent cascade
  routes/*.ts                   thin routers;  app.ts (factory, used by Supertest) · index.ts (listen)
src/
  theme/                        tokens.css (all colours) · base.css · surfaces.css · ThemeToggle
  lib/dax/                      daxBuilder.ts (DAX text) · parse.ts (rows → typed data)
  lib/manifest/                 schema.ts (Zod) · daxInjection.ts (CALCULATETABLE + TREATAS) · mapRows.ts · crossFilters.ts · jsonSchema.ts
  hooks/                        useSemanticQuery (TanStack Query, key = dataset + DAX text) · useDashboardData
  store/                        Zustand: filters (/visuals filters + manifest cross-filters) · theme · daxLog · embedLog
  components/powerbi-visuals/   React 18 wrappers of the web components (generated/, ignored) · index.ts · fixtures · SSR test
  components/manifest/          ManifestDashboard · ManifestVisual (live / sample) · registry · manifest.css (12-column grid)
  components/template/          ReportTemplate (Univerus scene, plane, header, rule) · UniverusLogo
  components/ui/                Card / ChartCard · InfoCurtain · Popover · Sheet · primitives (React chrome)
  components/visuals/           the semantic-model page (KPIs, group distribution, class table, DAX inspector)
  components/{briefing,chat,embed,layout}/
  pages/                        Gallery.tsx (/gallery) · ManifestPreview.tsx (/manifest-preview)
public/manifests/               index.json · sample-manifest.json · condition-works.json · delivery-lifecycle.json · locations-performance.json · manifest.schema.json (generated)
public/geo/                     boundary sets for the maps (Natural Earth, public domain; built by scripts/build-geo.mjs) · index.json · README.md
e2e/                            Playwright specs + in-browser fake DAX engine (support/mockApi.ts)
.agents/skills/                 canonical agent skills (see §5)
```

Routes: `/visuals` (semantic visuals), `/report` (Power BI embed), `/gallery` (design gallery), `/manifest-preview` (manifest harness). Views stay mounted once visited (the gallery only while open).

The app runs on **React 18.3** (with React Router 7, its last major for React 18). React 18 does not know the `inert` attribute: spread `{...(closed ? { inert: '' } : {})}` (typed in `src/types/react-inert.d.ts`).

## 3. Commands

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Builds the elements, then `stencil --watch` + API (`tsx watch`, port 5000) + Vite client (port 3000, `/api` proxied) |
| `npm run elements:build` / `elements:watch` | Stencil build of `packages/udp-powerbi-visuals` (custom elements, hydrate, docs, React wrappers) |
| `npm run lint` | oxlint: rules of hooks, `exhaustive-deps`, no explicit `any` (the Stencil package skips the React-hook rules) |
| `npm run typecheck` | Builds the elements, then `tsc -b` over app, unit tests + scripts, tooling, server (strict), e2e and the Stencil package |
| `npm test` | Builds the elements, then Vitest: DAX builder + injection, parsing, manifest schema / mapping, stores, chart layout, export, SSR smoke of every element (hydrate), token contrast + no-raw-colour guards (app and package), API (Supertest) |
| `npm run test:e2e` | Playwright against the production build (`vite preview`, elements built first), `/api` mocked in the browser |
| `npm run build` / `npm start` | Client + server build; Express serves API and SPA |
| `npm run manifest:schema` | Regenerates `public/manifests/manifest.schema.json` from the Zod schema (a test fails when it is stale) |
| `npm run skills:sync` / `skills:check` | Regenerate / verify the skill mirrors and the generated token reference |

## 4. Hard rules

1. **Read the matching skill before working** (§5) and follow it. Update the skill in `.agents/skills/` when you change what it documents, then run `npm run skills:sync`. Never edit `.claude/skills/` (generated).
2. **Colours only from design tokens** (`src/theme/tokens.css` → `bg-u-*`, `text-u-*`, `var(--u-*)`). The stock Tailwind palette is disabled and a test fails on raw colours, in `src/` and in `packages/udp-powerbi-visuals/src/`. Inside the web components only `var(--pbi-*)` is used: `packages/udp-powerbi-visuals/src/styles/tokens-bridge.css` maps each role to `var(--u-*)` with a Fluent fallback for UDP (`tokensBridge.test.ts` keeps it complete; Tailwind classes do not cross the shadow boundary). Both themes must keep working.
3. **DAX is built, never concatenated by hand**: `daxString` / `daxLiteral` / `treatAs` / `containsFilter`; filters and search run in the engine before `TOPN`. **Exception:** a manifest's DAX is trusted input (written by Univerus-Lens or the report author, like a model measure); what is never trusted is a clicked value, so manifest filters are applied **only** through `injectCrossFilters` (`src/lib/manifest/daxInjection.ts`).
4. **Data fetching goes through `useSemanticQuery` / `semanticQueryOptions`**; cross-filtering goes through the composite actions of `useFilterStore` (`toggleCrossFilter` & co. for manifests). **The web components never fetch, build DAX or call endpoints**: they take props and emit `dataPointClick`, `exportData`, `focusModeChange` and `viewChange`.
5. **No functional regressions**: keep `data-testid`s, roles and accessible names that tests use; extend tests with every behaviour change; all four checks (lint, typecheck, unit, E2E) green before hand-over.
6. **No secrets in the repository.** Credentials live only in `.env` (ignored). Never print or commit tokens.
7. **Language**: the conversation may be in the user's language (often Spanish); code, identifiers, UI copy, comments, docs and commit messages are in English.

## 5. Skills

| Skill | Use when |
| :--- | :--- |
| [`powerreact-design-system`](.agents/skills/powerreact-design-system/SKILL.md) | Any UI, colour, card, chart, layout, motion or theme change. Contract for Neo-Glass / Nocturne, tokens, components, hover curtain, principles, IBCS. |
| [`powerreact-visual-builder`](.agents/skills/powerreact-visual-builder/SKILL.md) | Adding or changing a data visual: DAX builder → parse → query → filter store → web component → curtain → tests. |
| [`powerreact-manifest`](.agents/skills/powerreact-manifest/SKILL.md) | Writing or changing manifests, the manifest schema, DAX injection, the component registry or `/manifest-preview`. |
| [`better-ui`](.agents/skills/better-ui/SKILL.md) *(vendored)* | UI polish with exact values (radii, alignment, press feedback, transitions, icons). |
| [`emil-design-eng`](.agents/skills/emil-design-eng/SKILL.md) *(vendored)* | Animation decisions (whether, why, easing, duration), interruptibility, motion review. |

Vendored skills come from `npx skills add … --copy` and are pinned in `skills-lock.json`: never edit them; update with `npx skills update`, then `npm run skills:sync`. When they disagree with the Univerus contract, **the Univerus contract wins**; the resolved conflicts are listed in `powerreact-visual-builder` ("Companion skills").

## 6. Hand-over checklist

- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e` pass
- [ ] Checked in **Neo-Glass and Nocturne** (toggle in the header), on `/gallery` and, for manifest work, on `/manifest-preview` (Live and Sample)
- [ ] Skills updated and `npm run skills:check` passes
- [ ] No `.env`, tokens or build output staged (Stencil output and `src/components/powerbi-visuals/generated` are ignored; `packages/udp-powerbi-visuals/src/components.d.ts` is committed)
