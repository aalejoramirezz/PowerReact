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

* **Frontend Web (Vite + React):** [http://localhost:3000](http://localhost:3000) — `/visuals` (React DAX visuals) and `/report` (Power BI embed)
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
| `npm run typecheck` | `tsc -b` over client, tooling, server (strict) and e2e projects |
| `npm test` | Vitest: DAX builder, row parsing, briefing script, stores, API endpoints (Supertest, axios mocked) |
| `npm run test:e2e` | Playwright cross-filter flow against the Vite client with a mocked API |

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
  lib/dax/               daxBuilder.ts (DAX text) + parse.ts (rows → typed data)
  hooks/                 useSemanticQuery (TanStack Query per DAX), useDashboardData
  store/                 Zustand: shared filters, DAX log, embed diagnostics
  components/visuals/    KpiCard, GroupDistribution, ClassTable, DaxInspector, FilterBar
  components/briefing/   voice briefing (script from queried data, speech, orb)
  components/embed/      Power BI embed (single Service, token renewal)
  components/chat/       Data Agent chat (Markdown answers)
e2e/                     Playwright specs + in-browser API mock
```

### How the pieces cooperate

* **Filters live in one store** (`src/store/filters.ts`) shared by the visuals, the voice briefing and (later) the chat.
* **Every DAX query is a TanStack Query entry keyed by its text**, so each filter combination is cached separately, superseded requests are aborted, and a slow response can never overwrite a newer one.
* **The voice briefing awaits the data** for each chapter (`loadDashboard`) and builds the narration from it; chapters such as "primary exposure" pick the group/class from the previous chapter's results.
* **The embedded report** is created once per report; pane toggles call `updateSettings`, and tokens are renewed before expiry (or on a `TokenExpired` error) with `setAccessToken`.

---

## 🛡️ Security

This project never commits sensitive Service Principal credentials or tenant secrets to source control. All secrets are loaded strictly from `.env` via environment variables.

---

## 📄 License

MIT
