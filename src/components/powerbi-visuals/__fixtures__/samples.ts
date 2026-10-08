/**
 * Sample data for the design gallery, the SSR smoke tests and the skills' examples.
 * Shapes match the element props; values echo the Univerus-Lens mockups.
 */
import type {
  BarItem,
  BoxPlotItem,
  BulletItem,
  CalendarDay,
  DotPlotItem,
  TimelineTask,
  TreemapNode,
  WaterfallStep,
  ChartCategory,
  ChartSeries,
  DonutItem,
  IbcsItem,
  MatrixColumn,
  MatrixMeasure,
  MatrixNode,
  ScatterPoint,
  TrendSeries,
} from '@powerreact/udp-powerbi-visuals';

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

const categories = (labels: readonly string[]): ChartCategory[] => labels.map((label) => ({ id: label, label }));

/** Column chart, grouped: renewal need against budget by year (Lens "Renewal Funding"). */
export const RENEWAL_YEARS: ChartCategory[] = Array.from({ length: 12 }, (_, i) => {
  const year = 2026 + i;
  return { id: String(year), label: String(year), raw: year };
});
export const RENEWAL_NEED_VS_BUDGET: ChartSeries[] = [
  { id: 'need', label: 'Renewal need', values: [4.2, 3.1, 5.8, 2.6, 6.4, 3.9, 4.8, 7.2, 3.3, 5.1, 4.4, 6.0].map((v) => v * 1e6) },
  { id: 'budget', label: 'Budget', values: [3.8, 3.8, 4.0, 4.0, 4.2, 4.2, 4.4, 4.4, 4.6, 4.6, 4.8, 4.8].map((v) => v * 1e6) },
];

/** Column chart, stacked by status, with an extra tooltip measure per month. */
const SLA_MET = [0.91, 0.88, 0.93, 0.9, 0.86, 0.92, 0.94, 0.89, 0.9, 0.95, 0.91, 0.93];
export const MONTH_CATEGORIES: ChartCategory[] = MONTHS.map((m, i) => ({
  id: m,
  label: m,
  tooltips: [{ label: 'Within SLA', value: SLA_MET[i] ?? null, format: { style: 'percent', decimals: 0 } }],
}));
export const WORK_REQUESTS_BY_STATUS: ChartSeries[] = [
  { id: 'Closed', label: 'Closed', values: [22, 25, 19, 28, 30, 27, 31, 26, 29, 33, 30, 28] },
  { id: 'In progress', label: 'In progress', values: [6, 5, 7, 4, 6, 8, 5, 7, 6, 5, 7, 6] },
  { id: 'Open', label: 'Open', values: [3, 4, 2, 5, 3, 4, 6, 3, 4, 2, 5, 4] },
];

/** Histogram: open work requests by age band (bins from DAX, in order). */
export const AGEING_BINS = categories(['0–7 d', '8–14 d', '15–30 d', '31–60 d', '61–90 d', '91–180 d', '> 180 d']);
export const OPEN_REQUESTS_AGEING: ChartSeries[] = [{ id: 'open', label: 'Open requests', values: [48, 36, 41, 29, 17, 15, 11] }];

/** Stacked bars, diverging (Likert): condition grades by asset group, worst → best. */
export const ASSET_GROUPS = categories(['Utility_Line', 'Utility_Point', 'Core', 'Transport', 'rd_line']);
export const CONDITION_BY_GROUP: ChartSeries[] = [
  { id: 'Very Poor', label: 'Very poor', values: [210, 95, 60, 40, 30] },
  { id: 'Poor', label: 'Poor', values: [640, 280, 150, 70, 45] },
  { id: 'Fair', label: 'Fair', values: [1450, 700, 300, 120, 80] },
  { id: 'Good', label: 'Good', values: [2100, 980, 420, 170, 95] },
  { id: 'Very Good', label: 'Very good', values: [1051, 494, 270, 100, 50] },
];

/** Stacked bars, 100 %: status mix by priority. */
export const PRIORITIES = categories(['P1 Emergency', 'P2 Urgent', 'P3 Routine', 'P4 Planned']);
export const STATUS_BY_PRIORITY: ChartSeries[] = [
  { id: 'Closed', label: 'Closed', values: [42, 88, 120, 61] },
  { id: 'In progress', label: 'In progress', values: [5, 14, 36, 22] },
  { id: 'Open', label: 'Open', values: [2, 9, 28, 30] },
];

/** Matrix, risk heatmap: assets by criticality (rows, highest first) × condition grade, totals from the engine. */
export const CONDITION_GRADES: MatrixColumn[] = ['Very good', 'Good', 'Fair', 'Poor', 'Very poor'].map((label, i) => ({ id: String(i + 1), label, raw: i + 1 }));
const RISK_COUNTS: Array<[string, number[]]> = [
  ['5 · Very high', [120, 210, 160, 70, 34]],
  ['4 · High', [260, 480, 390, 150, 61]],
  ['3 · Medium', [610, 1150, 890, 330, 118]],
  ['2 · Low', [540, 1020, 760, 260, 90]],
  ['1 · Very low', [300, 640, 420, 120, 37]],
];
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
export const RISK_MEASURES: MatrixMeasure[] = [{ id: 'assets', label: 'Assets', heatmap: 'sequential' }];
export const RISK_MATRIX: MatrixNode[] = RISK_COUNTS.map(([label, counts], i) => ({
  id: String(5 - i),
  label,
  raw: 5 - i,
  cells: { assets: counts },
  total: { assets: sum(counts) },
}));
export const RISK_TOTAL: MatrixNode = {
  id: 'total',
  label: 'Total',
  cells: { assets: CONDITION_GRADES.map((_, c) => sum(RISK_COUNTS.map(([, counts]) => counts[c] ?? 0))) },
  total: { assets: sum(RISK_COUNTS.flatMap(([, counts]) => counts)) },
};

/** Matrix, hierarchy: group → class with the assessed share heat-mapped around the 80 % target (subtotals as the engine returns them). */
const CLASS_GROUP: Record<string, string> = {
  Water_Pipes: 'Utility_Line',
  Sanitary_Pipes: 'Utility_Line',
  Stormwater_Pipes: 'Utility_Line',
  Hydrants: 'Utility_Point',
  Valves: 'Utility_Point',
  Pump_Stations: 'Utility_Point',
  Buildings: 'Core',
  Streetlights: 'Core',
  Bridges: 'Transport',
  Culverts: 'Transport',
  Roads: 'rd_line',
  Footpaths: 'rd_line',
};
export const PORTFOLIO_MEASURES: MatrixMeasure[] = [
  { id: 'assets', label: 'Assets' },
  { id: 'assessed', label: 'Assessed', format: { style: 'percent', decimals: 0 }, heatmap: 'diverging', center: 0.8 },
  { id: 'due', label: 'Due for renewal' },
];
const node = (id: string, rows: typeof ASSET_CLASSES, children?: MatrixNode[]): MatrixNode => {
  const count = sum(rows.map((r) => r.count));
  return {
    id,
    label: id,
    cells: { assets: [count], assessed: [count ? sum(rows.map((r) => r.assessed)) / count : null], due: [sum(rows.map((r) => r.due))] },
    ...(children ? { children } : {}),
  };
};
export const PORTFOLIO_TREE: MatrixNode[] = [...new Set(Object.values(CLASS_GROUP))].map((group) => {
  const rows = ASSET_CLASSES.filter((r) => CLASS_GROUP[r.className] === group);
  return node(
    group,
    rows,
    rows.map((r) => node(r.className, [r]))
  );
});
export const PORTFOLIO_TOTAL: MatrixNode = { ...node('Total', ASSET_CLASSES) };

/** Scatter: condition against criticality by class, bubble = inventory, colour = group (quadrants at the mid grade). */
const CLASS_RISK: Record<string, [number, number]> = {
  Water_Pipes: [3.6, 4.1],
  Sanitary_Pipes: [3.1, 3.8],
  Stormwater_Pipes: [2.9, 3.2],
  Hydrants: [2.4, 3.6],
  Valves: [3.4, 2.7],
  Pump_Stations: [2.2, 4.6],
  Buildings: [2.6, 3.1],
  Streetlights: [2.1, 1.9],
  Bridges: [3.8, 4.4],
  Culverts: [3.3, 2.4],
  Roads: [3.0, 2.8],
  Footpaths: [2.7, 1.6],
};
export const CLASS_RISK_POINTS: ScatterPoint[] = ASSET_CLASSES.map((r) => {
  const [condition, criticality] = CLASS_RISK[r.className] ?? [3, 3];
  return {
    id: r.className,
    label: r.className,
    x: condition,
    y: criticality,
    size: r.count,
    group: CLASS_GROUP[r.className],
    tooltips: [{ label: 'Due for renewal', value: r.due }],
  };
});

/** Waterfall: the work-request backlog over the last 30 days (opening level, movements, closing level). */
export const BACKLOG_BRIDGE: WaterfallStep[] = [
  { id: 'open-30', label: 'Open 30 days ago', value: 182, kind: 'start' },
  { id: 'raised', label: 'Raised', value: 48 },
  { id: 'merged', label: 'Merged', value: -3 },
  { id: 'closed', label: 'Closed', value: -30 },
  { id: 'open', label: 'Open now', value: 197, kind: 'end' },
];

/** Treemap: inventory by group → class, coloured by the share condition-assessed. */
export const PORTFOLIO_TREEMAP: TreemapNode[] = [...new Set(Object.values(CLASS_GROUP))].map((group) => ({
  id: group,
  label: group,
  children: ASSET_CLASSES.filter((r) => CLASS_GROUP[r.className] === group).map((r) => ({
    id: r.className,
    label: r.className,
    value: r.count,
    colorValue: r.pctAssessed,
  })),
}));

/** Calendar heatmap: work requests raised per day, Feb–Sep 2026 (weekdays busier, a spike in April). */
export const REQUESTS_BY_DAY: CalendarDay[] = (() => {
  const out: CalendarDay[] = [];
  for (let d = new Date(2026, 1, 1); d <= new Date(2026, 8, 30); d.setDate(d.getDate() + 1)) {
    const weekday = d.getDay();
    const base = weekday === 0 || weekday === 6 ? 0 : 2;
    const wave = Math.round(Math.abs(Math.sin(d.getDate() * 1.7 + d.getMonth())) * 3);
    const spike = d.getMonth() === 3 && d.getDate() >= 13 && d.getDate() <= 17 ? 6 : 0;
    const value = base + wave + spike;
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (value > 0 || d.getDate() % 9 === 0) out.push({ date: `${iso}T00:00:00`, value });
  }
  return out;
})();

/** Dot plot: open work requests per crew, 30 days ago → now (a backlog: lower is better). */
export const BACKLOG_BY_CREW: DotPlotItem[] = [
  ['North crew', 61, 71],
  ['South crew', 64, 58],
  ['East crew', 35, 41],
  ['Facilities crew', 30, 27],
  ['Trails crew', 12, 4],
  ['Unassigned', 30, 36],
].map(([label, from, to]) => ({ id: String(label), label: String(label), from: Number(from), to: Number(to) }));

/** Timeline: equipment warranties by class, toned by how soon they end (today: 7 Oct 2026). */
export const WARRANTY_TODAY = '2026-10-07';
export const WARRANTIES: TimelineTask[] = [
  ['Pump station 4', 'Pump_Stations', '2024-03-01', '2026-11-30', 'warn'],
  ['Pump station 7', 'Pump_Stations', '2025-06-15', '2028-06-14', 'ok'],
  ['Streetlight LED batch A', 'Streetlights', '2023-01-10', '2026-08-31', 'bad'],
  ['Streetlight LED batch B', 'Streetlights', '2025-09-01', '2030-08-31', 'ok'],
  ['Valve actuators', 'Valves', '2024-11-01', '2026-12-20', 'warn'],
  ['Roof membrane, depot', 'Buildings', '2022-05-01', '2032-04-30', 'ok'],
  ['HVAC, civic centre', 'Buildings', '2025-02-01', '2027-01-31', 'ok'],
  ['Bridge bearings', 'Bridges', '2021-07-01', '2026-06-30', 'bad'],
].map(([label, lane, start, end, tone]) => ({
  id: String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  label: String(label),
  lane: String(lane),
  start: String(start),
  end: String(end),
  tone: tone as TimelineTask['tone'],
}));

/** Box plot: condition index distribution by group (engine statistics) and one class from raw values. */
export const CONDITION_DISTRIBUTION: BoxPlotItem[] = [
  { id: 'Core', label: 'Core', min: 12, q1: 38, median: 55, q3: 71, max: 96, mean: 54.2, count: 210, outliers: [2, 4] },
  { id: 'Transport', label: 'Transport', min: 4, q1: 8, median: 9.5, q3: 11, max: 15, mean: 9.6, count: 456, outliers: [28, 31] },
  { id: 'Utility_Line', label: 'Utility_Line', min: 3, q1: 7, median: 9.8, q3: 12, max: 19, mean: 9.9, count: 3020 },
  { id: 'Utility_Point', label: 'Utility_Point', min: 1, q1: 3, median: 6, q3: 10, max: 20, mean: 8.4, count: 2290, outliers: [28.9, 33, 41] },
  { id: 'rd_line', label: 'rd_line', values: [41, 55, 63, 66, 70, 72, 74, 80, 88] },
];

/** Waterfall, horizontal: the financial position over the year (long step names read across). */
export const FINANCIAL_BRIDGE: WaterfallStep[] = [
  { id: 'opening', label: 'Opening book value', value: 412.6e6, kind: 'start' },
  { id: 'additions', label: 'Capital additions', value: 18.4e6 },
  { id: 'revaluation', label: 'Revaluation', value: 9.1e6 },
  { id: 'disposals', label: 'Disposals', value: -2.7e6 },
  { id: 'depreciation', label: 'Depreciation', value: -14.9e6 },
  { id: 'closing', label: 'Closing book value', value: 422.5e6, kind: 'end' },
];
