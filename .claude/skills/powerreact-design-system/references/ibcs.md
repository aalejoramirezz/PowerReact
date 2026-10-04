# IBCS variance in PowerReact (`IbcsVariance`)

Port of Univerus-Lens `templates/deneb/ibcs_variance_{horizontal,vertical}.vg.json` (derived from the variance designs of Juan Bohórquez), rendered as React SVG with theme roles.

## When to use it

The question is **"how far above / below the prior year, plan, forecast or budget — and where?"** for several categories. One comparison per chart. For a single number, use a `KpiCard` with a delta; for actual vs a per-category target without a scenario, `BulletBars` is lighter.

## Anatomy

Three aligned panels per category:

1. **AC vs comparison**: AC (actual) as a solid bar in `--u-ac` (ink in Neo-Glass, white in Nocturne), the comparison behind it in its scenario notation, with the AC value at the end of the bar.
2. **ΔAbs**: AC − comparison, as bars from a zero axis coloured `--u-ok` / `--u-bad` by business meaning, labelled with an explicit sign (true minus `−`).
3. **Δ%**: AC ÷ |comparison| − sign(comparison), as pins with a dot head. Values beyond `pctCap` (default 2 = ±200 %) are drawn at the cap as a triangle pointing outwards, labelled with the **real** value. Missing or zero comparison gives `n/a`.

Panel titles carry the scenario and the unit: `AC vs PY · K`, `ΔPY · K`, `ΔPY%`.

## Scenario notation (`scenario`)

| Scenario | Meaning | Look |
| :--- | :--- | :--- |
| `PY` | Prior year | Solid grey (`--u-secondary`) |
| `PL` | Plan | Outlined |
| `FC` | Forecast | Dashed outline, light fill |
| `BU` | Budget | Dotted outline |

Never colour scenarios with the brand palette: brand colour is reserved for good/bad.

## Props

| Prop | Default | Notes |
| :--- | :--- | :--- |
| `data` | — | `{ id, label, actual, comparison }[]` (nulls allowed) |
| `orientation` | `'horizontal'` | Horizontal for **structures** (regions, asset classes, accounts; long names). Vertical for **time** (months, quarters) running left to right. |
| `scenario` | `'PY'` | Notation of the comparison. `comparisonLabel` overrides the text. |
| `goodWhen` | `'higher'` | `'higher'` for revenue, availability, completed work; `'lower'` for cost, backlog, response time. A cost overrun is unfavourable even though positive. |
| `sort` | `actual` (horizontal) / `natural` (vertical) | `'variance'` sorts by ΔAbs. Time keeps its natural order. |
| `topN` | 0 (all) | |
| `pctCap` | 2 | ±200 % |
| `decimals` | 1 | Used when the unit is K / M / bn or values have fractions |
| `selectedId`, `onSelect` | — | Click selects a row/column (cross-filter); the others dim to 35 %. Hover highlights with the track colour. |
| `height` | 420 | Vertical only (≥ 420 recommended) |

Units: one unit for the whole chart from the largest magnitude (`scaleUnit`): K from 10,000, M from 1,000,000, bn from 1,000,000,000.

## Example

```tsx
<ChartCard title="Maintenance cost by month" subtitle="IBCS · time · lower is better"
           info="Monthly cost against plan; spending above plan is unfavourable." calc="ΔPL = AC − PL · ΔPL% = AC ÷ |PL| − 1">
  <IbcsVariance data={costByMonth} label="Maintenance cost by month" orientation="vertical" scenario="PL" goodWhen="lower" />
</ChartCard>
```

The comparison is a measure: write it in DAX (e.g. `CALCULATE ( [Cost], DATEADD ( 'Date'[Date], -1, YEAR ) )` for PY) and return `actual` and `comparison` per category from one `SUMMARIZECOLUMNS` query (see powerreact-visual-builder).
