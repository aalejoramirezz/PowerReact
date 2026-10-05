# AGENTS.md — PowerReact

> Instructions for **any AI coding agent** (Claude Code, OpenAI Codex, Google Gemini / Antigravity, Cursor, Copilot…) working in this repository. They are tool-neutral: plain Markdown contracts, npm scripts and tests.

## 1. What this repository is

PowerReact renders **native React visuals** on top of a **Power BI / Microsoft Fabric semantic model**, queried live with DAX through the Service Principal `executeQueries` API, instead of embedding Power BI iframes. It also embeds a classic Power BI report for comparison, a Fabric Data Agent chat and an AI voice briefing that cross-filters the visuals as it speaks.

The UI follows the **Univerus design system** ported from the sibling repo Univerus-Lens: two templates, **Neo-Glass** (light) and **Nocturne** (dark), switched app-wide with the dark-mode button.

## 2. Architecture

```
server/                         Express BFF (strict TypeScript)
  config.ts                     env + preconfigured reports
  auth/tokenCache.ts            Entra ID client-credentials tokens (cached, de-duplicated)
  services/powerbi.ts           embed config / tokens, executeQueries
  services/fabric.ts            workspaces, Data Agent cascade
  routes/*.ts                   thin routers;  app.ts (factory, used by Supertest) · index.ts (listen)
src/
  theme/                        tokens.css (all colours) · base.css · surfaces.css · ThemeToggle
  lib/dax/                      daxBuilder.ts (DAX text) · parse.ts (rows → typed data)
  hooks/                        useSemanticQuery (TanStack Query, key = DAX text) · useDashboardData
  store/                        Zustand: filters (shared cross-filter state) · theme · daxLog · embedLog
  components/template/          ReportTemplate (Univerus scene, plane, header, rule) · UniverusLogo
  components/ui/                Card / ChartCard · KpiCard · KpiHero · InfoCurtain · primitives
  components/charts/            SpotlightBars · RankingBars · BulletBars · DivergingBars · Donut · TrendChart · IbcsVariance
  components/visuals/           the semantic-model page (KPIs, group distribution, class table, DAX inspector)
  components/{briefing,chat,embed,layout}/
  pages/Gallery.tsx             /gallery: every component, both themes, sample data
e2e/                            Playwright specs + in-browser fake DAX engine (support/mockApi.ts)
.agents/skills/                 canonical agent skills (see §5)
```

Routes: `/visuals` (React visuals), `/report` (Power BI embed), `/gallery` (design gallery). Views stay mounted once visited.

## 3. Commands

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | API (`tsx watch`, port 5000) + Vite client (port 3000, `/api` proxied) |
| `npm run lint` | oxlint: rules of hooks, `exhaustive-deps`, no explicit `any` |
| `npm run typecheck` | `tsc -b` over app, unit tests, tooling, server (strict) and e2e |
| `npm test` | Vitest: DAX builder, parsing, stores, chart layout, SSR smoke, token contrast + no-raw-colour guards, API (Supertest) |
| `npm run test:e2e` | Playwright against the production build (`vite preview`), `/api` mocked in the browser |
| `npm run build` / `npm start` | Client + server build; Express serves API and SPA |
| `npm run skills:sync` / `skills:check` | Regenerate / verify the skill mirrors and the generated token reference |

## 4. Hard rules

1. **Read the matching skill before working** (§5) and follow it. Update the skill in `.agents/skills/` when you change what it documents, then run `npm run skills:sync`. Never edit `.claude/skills/` (generated).
2. **Colours only from design tokens** (`src/theme/tokens.css` → `bg-u-*`, `text-u-*`, `var(--u-*)`). The stock Tailwind palette is disabled and a test fails on raw colours. Both themes must keep working.
3. **DAX is built, never concatenated by hand**: `daxString` / `treatAs` / `containsFilter`; filters and search run in the engine before `TOPN`.
4. **Data fetching goes through `useSemanticQuery` / `semanticQueryOptions`**; cross-filtering goes through the composite actions of `useFilterStore`.
5. **No functional regressions**: keep `data-testid`s, roles and accessible names that tests use; extend tests with every behaviour change; all four checks (lint, typecheck, unit, E2E) green before hand-over.
6. **No secrets in the repository.** Credentials live only in `.env` (ignored). Never print or commit tokens.
7. **Language**: the conversation may be in the user's language (often Spanish); code, identifiers, UI copy, comments, docs and commit messages are in English.

## 5. Skills

| Skill | Use when |
| :--- | :--- |
| [`powerreact-design-system`](.agents/skills/powerreact-design-system/SKILL.md) | Any UI, colour, card, chart, layout, motion or theme change. Contract for Neo-Glass / Nocturne, tokens, components, hover curtain, principles, IBCS. |
| [`powerreact-visual-builder`](.agents/skills/powerreact-visual-builder/SKILL.md) | Adding or changing a data visual: DAX builder → parse → query → filter store → component → curtain → tests. |
| [`better-ui`](.agents/skills/better-ui/SKILL.md) *(vendored)* | UI polish with exact values (radii, alignment, press feedback, transitions, icons). |
| [`emil-design-eng`](.agents/skills/emil-design-eng/SKILL.md) *(vendored)* | Animation decisions (whether, why, easing, duration), interruptibility, motion review. |

Vendored skills come from `npx skills add … --copy` and are pinned in `skills-lock.json`: never edit them; update with `npx skills update`, then `npm run skills:sync`. When they disagree with the Univerus contract, **the Univerus contract wins**; the resolved conflicts are listed in `powerreact-visual-builder` ("Companion skills").

## 6. Hand-over checklist

- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e` pass
- [ ] Checked in **Neo-Glass and Nocturne** (toggle in the header) and on `/gallery`
- [ ] Skills updated and `npm run skills:check` passes
- [ ] No `.env`, tokens or build output staged
