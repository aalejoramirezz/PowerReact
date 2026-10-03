# PowerReact ⚡

> **Headless Power BI / Fabric Semantic Model Analytics with Native React & Voice-Guided Scrollytelling**

PowerReact is an ultra-efficient architectural proof-of-concept demonstrating how to build modern, native, responsive **React 19 + Vite** dashboards powered directly by **Microsoft Power BI / Microsoft Fabric Semantic Models** via the **Service Principal `executeQueries` REST API**—without the heavy overhead of traditional iframe embedding.

---

## 🌟 Key Features

* **⚡ Ultra-Low Latency (~200ms round-trip):** Queries run directly against the cloud VertiPaq tabular engine in memory, returning clean JSON payloads (< 5 KB) instead of loading a ~20MB iframe runtime.
* **🎯 Single Source of Truth:** Business logic, relationships, and DAX measures (`[Asset Count]`, `[Assets Due For Renewal]`, `[% Assessed For Condition]`) stay securely in the Power BI Semantic Model.
* **🔄 Interactive Cross-Filtering:** Clicking any group bar, table row, or KPI card dynamically injects `TREATAS()` DAX clauses, recalculating the entire dashboard in real-time.
* **🎙️ Executive AI Voice Briefing (Inspired by Gus Bavia):** Interactive glowing audio orb with cinema captions and synchronized cross-filtering that automatically shifts screen focus as the narration progresses ($0 cost via Web Speech API).
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

* **Frontend Web (Vite + React):** [http://localhost:3000](http://localhost:3000)
* **Backend API (Express + Entra ID):** [http://localhost:5000](http://localhost:5000)

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

---

## 🛡️ Security

This project never commits sensitive Service Principal credentials or tenant secrets to source control. All secrets are loaded strictly from `.env` via environment variables.

---

## 📄 License

MIT
