# PowerReact ⚡

> **Headless Power BI / Fabric Semantic Model Analytics with Native React & Voice-Guided Scrollytelling**

PowerReact is an ultra-efficient architectural proof-of-concept demonstrating how to build modern, native, responsive **React 19 + Vite** dashboards powered directly by **Microsoft Power BI / Microsoft Fabric Semantic Models** via the **Service Principal `executeQueries` REST API**—without the heavy overhead of traditional iframe embedding.

---

## 🌟 Key Features

* **⚡ Ultra-Low Latency (~200ms round-trip):** Queries run directly against the cloud VertiPaq tabular engine in memory, returning clean JSON payloads (< 5 KB) instead of loading a ~20MB iframe runtime.
* **🎯 Single Source of Truth:** Business logic, relationships, and DAX measures (`[Asset Count]`, `[Assets Due For Renewal]`, `[% Assessed For Condition]`) stay securely in the Power BI Semantic Model.
* **🔄 Interactive Cross-Filtering:** Clicking any group bar, table row, or KPI card dynamically injects `TREATAS()` DAX clauses, recalculating the entire dashboard in real-time.
* **🎙️ Executive AI Voice Briefing (Inspired by Gus Bavia):** Interactive glowing audio orb with cinema captions and synchronized cross-filtering that automatically shifts screen focus as the narration progresses. Every figure it reads is computed from the DAX results of that chapter ($0 cost via Web Speech API).
* **🔍 DAX Inspector & Live Playground:** Built-in terminal to inspect live DAX queries, execution latency (ms), and execute custom DAX queries on the fly.
* **📊 Dual Mode:** Seamlessly switch between native React visuals and traditional Power BI Embed / Paginated Report (RDL) view.
* **🌗 Univerus Design System:** The Neo-Glass (light) and Nocturne (dark) templates from Univerus-Lens, switched app-wide with the dark-mode button, with a themed chart library (spotlight / ranking / bullet / diverging bars, donut, trend, IBCS variance) and KPI cards that drop a "What it means" curtain on hover.

---

## 🚀 Quickstart

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/aalejoramirezz/PowerReact.git
cd PowerReact
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and configure your Azure Entra ID Service Principal:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Azure Entra ID / Microsoft Fabric Service Principal
AZURE_TENANT_ID=your-azure-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret

# API Gateway & Ports
UNITY_DOMAIN=https://gateway.unitystage.net
PORT=5000
```

> **Note:** The Service Principal must have at least *Viewer* or *Build* permissions on the target Power BI Workspace, and "Allow service principals to use Power BI APIs" must be enabled in the Power BI Admin Portal.

### 3. Run the Development Server

```bash
npm run dev
```

* **Frontend Web (Vite + React):** [http://localhost:3000](http://localhost:3000) — `/visuals` (React DAX visuals), `/report` (Power BI embed) and `/gallery` (design system gallery)
* **Backend API (Express + Entra ID):** [http://localhost:5000](http://localhost:5000)

### 4. Production Build

```bash
npm run build   # client (dist/) + server (dist-server/)
npm start       # Express serves the API and the built SPA on $PORT
```

---

## 🧰 Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | API (`tsx watch`) + Vite client with `/api` proxy |
| `npm run build` | `build:client` (typecheck + Vite) and `build:server` (`tsc` → `dist-server/`) |
| `npm start` | Runs the compiled server |
| `npm run lint` | oxlint (rules of hooks, `exhaustive-deps`, no explicit `any`) |
| `npm run typecheck` | `tsc -b` over client, unit tests, tooling, server (strict) and e2e projects |
| `npm test` | Vitest: DAX builder, row parsing, briefing script, stores, chart layout, SSR smoke, token contrast and no-raw-colour guards, API endpoints (Supertest, axios mocked) |
| `npm run test:e2e` | Playwright (cross-filter flow, themes, curtains, gallery) against the production build with a mocked API |
| `npm run skills:sync` / `skills:check` | Mirror `.agents/skills` → `.claude/skills` and regenerate the token reference / verify they are current |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, build and the Playwright suite on every push and PR; Dependabot keeps npm packages and GitHub Actions up to date.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│   React 19 Client (Tailwind CSS + Lucide Icons)        │
│   • Native KPI Cards & Progress Bars                   │
│   • Interactive Distribution Bar Chart                 │
│   • Hierarchical Asset Table with Slicers              │
│   • Floating Audio Briefing Orb & Cinema Captions      │
└───────────────────────────┬────────────────────────────┘
                            │ POST /api/powerbi/query
                            ▼
┌────────────────────────────────────────────────────────┐
│   Express Backend (BFF - Backend for Frontend)         │
│   • Entra ID OAuth2 Token Cache (In-Memory ~200ms)     │
│   • Execution Latency Telemetry                        │
└───────────────────────────┬────────────────────────────┘
                            │ executeQueries REST API
                            ▼
┌────────────────────────────────────────────────────────┐
│   Power BI / Microsoft Fabric Semantic Model           │
│   • VertiPaq Tabular Engine in Memory                  │
│   • Direct Lake / Import Mode                          │
└────────────────────────────────────────────────────────┘
```

### Project layout

```
server/
  config.ts              env + preconfigured reports
  auth/tokenCache.ts     Entra ID client-credentials tokens (cached, de-duplicated)
  services/powerbi.ts    embed config / embed tokens, executeQueries
  services/fabric.ts     workspaces, items, Data Agent cascade
  routes/                thin Express routers
  app.ts / index.ts      app factory (used by Supertest) / listener
src/
  theme/                 tokens.css (all colours, both themes) · base.css · surfaces.css · ThemeToggle
  lib/dax/               daxBuilder.ts (DAX text) + parse.ts (rows → typed data)
  hooks/                 useSemanticQuery (TanStack Query per DAX), useDashboardData
  store/                 Zustand: shared filters, theme, DAX log, embed diagnostics
  components/template/   ReportTemplate (Univerus scene, plane, header) · UniverusLogo
  components/ui/         Card / ChartCard · KpiCard · KpiHero · InfoCurtain · primitives
  components/charts/     SpotlightBars · RankingBars · BulletBars · DivergingBars · Donut · TrendChart · IbcsVariance
  components/visuals/    the semantic-model page: GroupDistribution, ClassTable, DaxInspector, FilterBar
  components/briefing/   voice briefing (script from queried data, speech, orb)
  components/embed/      Power BI embed (single Service, token renewal)
  components/chat/       Data Agent chat (Markdown answers)
  pages/Gallery.tsx      /gallery (design system gallery)
e2e/                     Playwright specs + in-browser API mock
.agents/skills/          canonical agent skills (mirrored to .claude/skills)
```

### How the pieces cooperate

* **Filters live in one store** (`src/store/filters.ts`) shared by the visuals, the voice briefing and (later) the chat.
* **Every DAX query is a TanStack Query entry keyed by its text**, so each filter combination is cached separately, superseded requests are aborted, and a slow response can never overwrite a newer one.
* **The voice briefing awaits the data** for each chapter (`loadDashboard`) and builds the narration from it; chapters such as "primary exposure" pick the group/class from the previous chapter's results.
* **The embedded report** is created once per report; pane toggles call `updateSettings`, and tokens are renewed before expiry (or on a `TokenExpired` error) with `setAccessToken`.

---

## 🌗 Design system: Neo-Glass ↔ Nocturne

The UI is the **Univerus design system** from Univerus-Lens, ported to responsive React:

| Template | Look | Typical use |
| :--- | :--- | :--- |
| **Neo-Glass** (light) | Quiet technical backdrop, one frosted-glass plane, teal rule, translucent white glass cards | Executive, audit, print |
| **Nocturne** (dark) | Obsidian window on a navy/teal backdrop with a teal glow rising from its base, dark glass cards | Operations, wall displays |

* **One source of colour:** `src/theme/tokens.css` defines every role (primary, secondary, grid, track, interaction, status, surfaces…) for both themes. Components use `bg-u-*` / `text-u-*` utilities or `var(--u-*)`; the stock Tailwind palette is disabled and a test rejects raw colours.
* **Dark-mode button** in the header switches the whole app; the choice is remembered and the first visit follows the OS preference (applied before first paint, no flash).
* **Visual principles enforced in code:** one question per card, the main insight gets the most space, colour by business meaning, motion that explains (and disappears under reduced motion), contrast checked by tests, context on demand through the hover curtain.
* **`/gallery`** shows every component in the active theme with sample data.

## 🤖 Agent skills

Agent instructions live in [AGENTS.md](AGENTS.md) (tool-neutral) with pointers in `CLAUDE.md` and `GEMINI.md`. Skills are written once in `.agents/skills/` and mirrored to `.claude/skills/` by `npm run skills:sync` (CI runs `skills:check`):

* **`powerreact-design-system`** — the Neo-Glass / Nocturne contract: tokens, surfaces, typography, layout, components, hover curtain, motion, the 41 dashboard principles and IBCS.
* **`powerreact-visual-builder`** — adding a data visual end to end: DAX builder → parsing → query layer → shared filters → component → curtain → tests.
* **`better-ui`** *(vendored, [jakubkrehel/skills](https://github.com/jakubkrehel/skills), MIT)* and **`emil-design-eng`** *(vendored, [emilkowalski/skills](https://github.com/emilkowalski/skills), MIT)* — UI polish and motion practices. Installed with `npx skills add … --copy`, pinned in `skills-lock.json`, updated with `npx skills update` + `npm run skills:sync`. The Univerus contract takes precedence; the resolved conflicts live in `powerreact-visual-builder`.

---

## 🛡️ Security

This project never commits sensitive Service Principal credentials or tenant secrets to source control. All secrets are loaded strictly from `.env` via environment variables.

---

## 📄 License

MIT
