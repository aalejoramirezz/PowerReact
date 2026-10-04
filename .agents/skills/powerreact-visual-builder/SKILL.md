---
name: powerreact-visual-builder
description: End-to-end recipe for adding or changing a data visual in PowerReact — from the business question to DAX against the Power BI semantic model (daxBuilder), row parsing, the TanStack Query layer keyed by DAX text, cross-filtering through the shared Zustand filter store, the themed chart component, the hover-curtain text, the voice briefing, and the Vitest / Playwright tests (with the in-browser fake DAX engine). Use when a task adds a KPI, chart, table or filter to the React semantic visuals, changes a query, or touches cross-filter behaviour. Always pair it with powerreact-design-system for the look, and apply the vendored better-ui and emil-design-eng skills for UI polish and motion within the precedence rules it defines.
---

# PowerReact Visual Builder

A PowerReact visual is a **question answered by DAX**, rendered by a **themed component**, wired into **one shared filter state**. Nothing is hardcoded: numbers, shares and narration all come from the query results.

```
question ─► daxBuilder.ts ─► POST /api/powerbi/query ─► parse.ts ─► TanStack Query (key = DAX text)
                ▲                                                         │
                └──────────── useFilterStore (group, class, focus, search) ◄── component onSelect / clicks
```

## Sources of truth

| Concern | File |
| :--- | :--- |
| DAX text builders (filters, search, TOPN), string escaping | `src/lib/dax/daxBuilder.ts` (+ `daxBuilder.test.ts`) |
| Row parsing (`toNumber`, column keys, sorting, shares) | `src/lib/dax/parse.ts` (+ `parse.test.ts`), types in `src/lib/dax/types.ts` |
| Query layer: `executeDax`, `semanticQueryOptions`, `useSemanticQuery`, `DAX_QUERY_KEY` | `src/hooks/useSemanticQuery.ts` |
| Dashboard bundle + awaitable loader for the briefing | `src/hooks/useDashboardData.ts` (`useDashboardData`, `loadDashboard`) |
| Shared filters and composite actions | `src/store/filters.ts` (`useFilterStore`, `selectFilters`, `focus`) |
| Page composition | `src/components/visuals/SemanticModelVisuals.tsx` |
| Curtain texts (measure descriptions) | `src/components/visuals/kpiDefinitions.ts` |
| Voice briefing script (narration from data) | `src/components/briefing/briefingScript.ts` |
| BFF endpoint | `server/routes/powerbi.ts` → `server/services/powerbi.ts` (`executeDaxQuery`) |
| Fake DAX engine for E2E | `e2e/support/mockApi.ts` (`REGISTER`, `mockApi`) |

## Companion skills: better-ui and emil-design-eng

Two third-party skills are vendored in `.agents/skills/` (mirrored to `.claude/skills/`, pinned in `skills-lock.json`; update with `npx skills update`, then `npm run skills:sync`):

| Skill | Source | Use it for |
| :--- | :--- | :--- |
| [`better-ui`](../better-ui/SKILL.md) | jakubkrehel/skills (MIT) | Exact polish values: concentric radii, optical alignment, press feedback, interruptible transitions, naming transition properties, icon stroke vs text weight, theme-switch handling, `will-change`. |
| [`emil-design-eng`](../emil-design-eng/SKILL.md) | emilkowalski/skills (MIT) | The animation decision framework (should it animate, purpose, easing, duration), interruptibility, origin-aware popovers, hover on touch devices, perceived performance, the Before/After review table. |

Load both whenever a visual adds or changes interaction, motion or component polish, and review the result against their checklists. They sharpen the work; they never replace the templates.

**Precedence when they disagree:**
1. **Univerus contract** (`powerreact-design-system`): tokens, surfaces, both templates, the 41 dashboard principles, IBCS. Always wins.
2. **better-ui**: its exact values for UI polish.
3. **emil-design-eng**: philosophy and the decision framework; where it gives a range and better-ui an exact value, use better-ui's.

**Resolved conflicts (apply as written):**

| Topic | Companion skill says | PowerReact rule |
| :--- | :--- | :--- |
| Card depth | better-ui: shadows instead of borders | Keep the Univerus card: 1 px token border + token shadow (Lens surface spec, DESIGN.md "crisp outline"). Shadow-as-border only for new surfaces the templates do not define. |
| Colours in examples (`oklch`, `zinc-*`, `black/10`) | Use the literal values | Token roles only (`bg-u-*`, `var(--u-*)`); `noRawColors.test.ts` rejects literals. Map a needed value to a new role in `tokens.css`. |
| Data-reveal entrances | emil: UI animations under 300 ms | Univerus timing stays: card rise .7 s, bar grow 1.1 s, line wipe 1.6 s. They run once per load and explain the data (principle 32). |
| Interaction feedback (hover, press, tabs, dialogs, toggles) | 150–300 ms, ease-out | Adopted: controls transition named properties at 150 ms ease-out; dialogs enter in 250 ms from `scale(0.95)` (`.u-anim-pop`). |
| KPI curtain timing | emil: hover feedback should be short | Kept at .55 s: it is the Lens template's signature interaction and drops only on intent (hover / focus) or the ⓘ button. |
| Easing | emil `cubic-bezier(.23,1,.32,1)`; better-ui `cubic-bezier(.2,0,0,1)` | `var(--u-ease)` = `cubic-bezier(.16,1,.3,1)` (same strong ease-out family). better-ui's curve only for icon cross-fades. |
| Press feedback | better-ui `scale(0.96)`; emil `0.97` | `scale: 0.96` on `.u-btn`, `.u-btn-ghost`, `.u-icon-btn`, `.u-tab` (in `surfaces.css`). Not on cards, chart rows or bars: a scaling chart reads as data changing. |
| Theme switch | better-ui: suppress transitions, no cross-fade | Adopted in `src/store/theme.ts` (`applyTheme`). |
| Hover on touch | emil: gate behind `(hover: hover) and (pointer: fine)` | Adopted for card lift and the KPI curtain; keyboard focus still opens the curtain. |
| `transition: all` / `transition-all` | Never | Adopted: name the properties (`transition-[width]`, `transition-[opacity,background-color]`). |
| Reduced motion | emil: fewer and gentler, keep opacity fades | Univerus is stricter: everything renders in its final state (`base.css`). Never depend on an animation finishing. |
| Motion libraries (`motion` / `framer-motion`) | Recipes assume them | Not installed. CSS transitions / keyframes only; do not add a dependency for polish. |
| emil-design-eng "Initial Response" | Reply with a canned sentence when invoked without a question | Skip it when loaded during a task; apply the guidance directly. |
| Review output | Before/After/Why table, severity, Block/Approve | Use it when asked to review UI or motion. |

## Hard rules

1. **Never interpolate user or data values into DAX by hand.** Use `daxString()` / `treatAs()` / `containsFilter()`; they double embedded quotes.
2. **Filter in the engine, before truncation.** Search (`CONTAINSSTRING`) and focus conditions (`FILTER(SUMMARIZECOLUMNS(…), [X] > 0)`) wrap the table *inside* `TOPN`, never on the rows the client already received.
3. **One cache entry per DAX text.** Build queries with `semanticQueryOptions({ kind, title, dax, parse })`; the DAX string is the key, so filter combinations never overwrite each other, and superseded requests are aborted through the `AbortSignal`.
4. **Cross-filter only through the store's composite actions** (`toggleGroup` clears the class picked under the previous group; `focus(target)` applies a whole target atomically). Never `setState` filter fields from components.
5. **Shares are computed over every category the visual receives** (`parseGroups`, `rankedRows`), never over a filtered KPI total or the rows left after top N.
6. **No hardcoded figures** in labels, narration or curtains: derive them from the parsed rows.
7. **Loading, error and empty states** for every query: `isPending` → `LoadingState`, `error` → `ErrorNote` (keep stale data visible with `isPlaceholderData` dimming), empty → `EmptyState` with a message that names the active filter.
8. **Tests**: builder + parser unit tests; extend the fake engine and add an E2E assertion for any new cross-filter path.

## Recipe

### 1. Name the question and pick the component

Write the question the visual answers ("Which asset class carries most renewals this year vs last?") and map it to a component with the selection policy in powerreact-design-system §2 (`IbcsVariance`, horizontal, `scenario="PY"`, `goodWhen="lower"` here). One question per card.

### 2. Build the DAX (`daxBuilder.ts`)

Add a pure builder that takes the slice of `DashboardFilters` it depends on. Use the `call()` / `evaluate()` helpers so the text stays readable in the DAX Inspector.

```ts
export function buildRenewalsVsPyQuery({ group }: Pick<DashboardFilters, 'group'>): string {
  return evaluate(
    call('SUMMARIZECOLUMNS', [
      CLASS_COLUMN,
      ...(group ? [treatAs(group, GROUP_COLUMN)] : []),
      '"AC", [Assets Due For Renewal]',
      '"PY", [Assets Due For Renewal PY]',
    ])
  );
}
```

Decide per filter whether the visual **respects** it (KPIs respect group and class), **highlights** it (groups are not filtered by group, so the selected one can stand out) or **ignores** it, and say so in the docstring. Measures must exist in the model; read their descriptions with `EVALUATE INFO.VIEW.MEASURES()` (read-only) for the curtain text.

Test it in `daxBuilder.test.ts`: exact text for the base case, filters present/absent, escaping.

### 3. Parse the rows (`parse.ts`)

`executeQueries` returns measures as `"[Name]"` keys and columns as `"table[Column]"`. Use `toNumber()` (nulls and numeric strings arrive) and return typed rows already shaped for the component (`{ id, label, actual, comparison }` for `IbcsVariance`, `{ id, label, value }` for bars). Sort deterministically. Test with missing values and empty results.

### 4. Query it (`useSemanticQuery.ts` / `useDashboardData.ts`)

```ts
const renewals = useSemanticQuery({
  kind: 'renewals-vs-py',
  title: `Renewals vs PY (${filters.group ?? 'Global'})`,   // shown in the DAX Inspector log
  dax: buildRenewalsVsPyQuery(filters),
  parse: parseRenewalsVsPy,
});
```

`useSemanticQuery` keeps the previous result while the new filters load (`isPlaceholderData` → dim the card). If the voice briefing must narrate it, add it to `dashboardQuerySpecs` so `loadDashboard()` awaits it too. "Refresh" invalidates everything under `DAX_QUERY_KEY`.

### 5. Wire cross-filtering

- Read filters with `useFilterStore(useShallow(selectFilters))`.
- Clicks call composite actions: `toggleGroup(id)`, `toggleClass(id)`, `toggleKpiFocus('renewal')`, `setSearch(text)`, `resetAll()`. Add a new action to `src/store/filters.ts` (with a test in `filters.test.ts`) rather than writing fields from a component.
- New filter dimension? Add it to `DashboardFilters`, `INITIAL_FILTERS`, `selectFilters`, the builders that must respect it, the `FilterBar` chips, and `FocusTarget` if the briefing should drive it.

### 6. Render it

Place it on the 12-column grid in `SemanticModelVisuals.tsx` inside a `ChartCard` (title, subtitle, `info` + `calc` for the ⓘ curtain, `index` for the entrance stagger) and pass `selectedId` / `onSelect` so selection dims the rest. Keep stable `data-testid`s for anything E2E tests click (`testIdPrefix` on bar components).

Any new interaction, overlay or motion goes through the companion skills before it lands: decide whether it should animate at all (emil-design-eng framework), name the transitioned properties, give pressable controls the press feedback, gate hover effects for touch, and keep everything inside the Univerus tokens and timings. **Floating layers (dialogs, popovers, toasts, captions) render through a portal to `document.body`**: the report plane uses `backdrop-filter`, which turns it into the containing block of any `position: fixed` descendant, so an in-tree overlay is clipped to the plane and painted under its header (see `VoiceBriefingOrb` and `e2e/briefing.spec.ts`).

### 7. Narration (optional)

If the briefing mentions the visual, add a step to `briefingScript.ts` whose `target(history)` derives the filters from earlier snapshots and whose `narrate(data, history)` builds every number from `data`. Test the step in `briefingScript.test.ts`.

### 8. Test it

- **Unit** (`npm test`): builder text, parser, any new layout math, store actions.
- **SSR smoke**: if you created a component, add full + empty renders to `charts.ssr.test.tsx` and a gallery entry.
- **E2E** (`npm run test:e2e`): extend `evaluate()` in `e2e/support/mockApi.ts` so the fake engine answers the new DAX from `REGISTER` (detect the query by a distinctive measure name, read filters with the same regexes), then assert the cross-filter path in `e2e/cross-filter.spec.ts`. E2E runs against the production build (`vite preview`), with every `/api` call mocked in the browser.
- Validate new DAX shapes against the real model once (read-only) before relying on them.

### 9. Verify

`npm run lint` · `npm run typecheck` · `npm test` · `npm run test:e2e` · check the view in **both themes** and on `/gallery` · review interaction and motion against the better-ui "Before you finish" table and the emil-design-eng review checklist, within the precedence above.

## Common mistakes

| Mistake | Effect | Fix |
| :--- | :--- | :--- |
| `` `TREATAS({"${value}"}, …)` `` | DAX injection / broken query on quotes | `treatAs(value, COLUMN)` |
| Client-side filter on `TOPN` results | Matches beyond the top N are invisible | Filter inside `SUMMARIZECOLUMNS` / `FILTER` before `TOPN` |
| `useEffect` + `fetch` + `setState` | Races: a slow old response overwrites the new one | `useSemanticQuery` (key = DAX text, abort signal) |
| Share over the filtered KPI total | Percentages above 100 % or inconsistent | Share over the rows the visual received |
| `setSelectedGroup(x)` without clearing the class | Impossible group + class combination | `toggleGroup` / `focus` |
| Narration with literal numbers | Wrong as soon as data changes | Build text from the snapshot |
| Fake engine not updated | E2E throws "Unexpected DAX in e2e mock" | Extend `evaluate()` in `mockApi.ts` |
| Raw colours or a hand-made card | Breaks the other theme | powerreact-design-system |
| `position: fixed` overlay rendered inside the report | Clipped to the plane; header and filters paint above the blur | `createPortal(…, document.body)` |
| A companion-skill value that contradicts the templates | Drifts from Univerus (e.g. borders removed from cards) | Precedence table in "Companion skills": Univerus wins |
