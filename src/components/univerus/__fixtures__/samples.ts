/**
 * Sample data for the design gallery, the SSR smoke tests and the skills' examples.
 * Shapes match the element props; values echo the Univerus-Lens mockups.
 */
import type { BarItem, BulletItem, DonutItem, IbcsItem, TrendSeries } from '@powerreact/univerus-elements';

const bar = (label: string, value: number): BarItem => ({ id: label, label, value });

export const WORK_ORDERS_BY_DEPARTMENT: BarItem[] = [
  bar('Water', 412),
  bar('Roads', 336),
  bar('Parks', 198),
  bar('Waste', 174),
  bar('Permits', 164),
  bar('Fleet', 120),
  bar('Lighting', 96),
  bar('Drainage', 71),
];

export const EFFICIENCY_VS_TARGET: BulletItem[] = [
  { id: 'North', label: 'North', actual: 92, target: 85 },
  { id: 'Central', label: 'Central', actual: 87, target: 88 },
  { id: 'West', label: 'West', actual: 81, target: 80 },
  { id: 'East', label: 'East', actual: 76, target: 82 },
  { id: 'South', label: 'South', actual: 68, target: 75 },
];

export const NET_FLOW_BY_SITE: BarItem[] = [
  bar('E104 · Metro', -41),
  bar('E201 · Metro', -33),
  bar('E108 · Parque', -21),
  bar('E203 · Ovalo', -9),
  bar('E110 · Plaza', 4),
  bar('E206 · Malecon', 18),
  bar('E102 · Costa', 29),
  bar('E205 · Centro', 44),
];

export const REQUESTS_BY_CHANNEL: DonutItem[] = [
  { id: 'web', label: 'Web portal', value: 1270 },
  { id: 'phone', label: 'Phone', value: 773 },
  { id: 'email', label: 'Email', value: 488 },
  { id: 'walk-in', label: 'Walk-in', value: 229 },
];

export const MONTHS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

export const SERVICE_REQUESTS: TrendSeries[] = [
  {
    id: 'received',
    label: 'Received',
    role: 'primary',
    values: [2140, 2260, 2010, 2380, 2520, 2470, 2690, 2810, 2760, 3105, 2940, 2880],
  },
  {
    id: 'resolved',
    label: 'Resolved',
    role: 'comparison',
    values: [2050, 2190, 2080, 2240, 2410, 2450, 2560, 2700, 2730, 2860, 2900, 2840],
  },
];

/** Asset classes, renewals this year (AC) vs prior year (PY). Roads triples: shows the Δ% cap. */
export const RENEWALS_AC_VS_PY: IbcsItem[] = [
  { id: 'water', label: 'Water_Pipes', actual: 1979, comparison: 1820 },
  { id: 'sanitary', label: 'Sanitary_Pipes', actual: 2100, comparison: 2230 },
  { id: 'storm', label: 'Stormwater_Pipes', actual: 1372, comparison: 1290 },
  { id: 'hydrants', label: 'Hydrants', actual: 1549, comparison: 1500 },
  { id: 'valves', label: 'Valves', actual: 1000, comparison: 1100 },
  { id: 'buildings', label: 'Buildings', actual: 1200, comparison: 1180 },
  { id: 'bridges', label: 'Bridges', actual: 500, comparison: 420 },
  { id: 'roads', label: 'Roads', actual: 300, comparison: 90 },
];

/** Maintenance cost per month, actual vs plan (lower is better). Values in dollars: unit K. */
export const COST_AC_VS_PLAN: IbcsItem[] = MONTHS.map((m, i) => ({
  id: m,
  label: m,
  actual: [128400, 119800, 141200, 133900, 125100, 118700, 136500, 129900, 147300, 151800, 139200, 131600][i] ?? null,
  comparison: [125000, 125000, 130000, 130000, 130000, 125000, 135000, 135000, 140000, 140000, 140000, 135000][i] ?? null,
}));

/** Asset classes for the data table sample (12 rows: two pages of 10). */
export const ASSET_CLASSES = [
  ['Water_Pipes', 1979, 1840, 637],
  ['Sanitary_Pipes', 2100, 1500, 0],
  ['Stormwater_Pipes', 1372, 900, 0],
  ['Hydrants', 1549, 1200, 0],
  ['Valves', 1000, 400, 12],
  ['Buildings', 1200, 1000, 50],
  ['Bridges', 500, 450, 0],
  ['Roads', 300, 100, 0],
  ['Footpaths', 860, 610, 24],
  ['Streetlights', 1420, 1310, 0],
  ['Culverts', 240, 96, 8],
  ['Pump_Stations', 64, 64, 2],
].map(([className, count, assessed, due]) => ({
  className: className as string,
  count: count as number,
  assessed: assessed as number,
  pctAssessed: (assessed as number) / (count as number),
  due: due as number,
}));
