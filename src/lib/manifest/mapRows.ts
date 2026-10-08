import type {
  BarItem,
  BoxPlotItem,
  BulletItem,
  CalendarDay,
  ChartCategory,
  ChartSeries,
  DataPointValue,
  DotPlotItem,
  GeoPoint,
  KpiPoint,
  HeroMetric,
  IbcsItem,
  MatrixColumn,
  MatrixMeasure,
  MatrixNode,
  ScatterPoint,
  TableColumn,
  RegionValue,
  TableRow,
  TimelineTask,
  TooltipItem,
  TreemapNode,
  TrendSeries,
  WaterfallStep,
} from '@powerreact/udp-powerbi-visuals';
import { toLabel, toNumber } from '../dax/parse';
import type { DaxRow } from '../dax/types';
import type { ManifestComponentName, ManifestVisual, VisualOf } from './schema';

/**
 * executeQueries rows → the props of each Univerus element. Keys arrive as `table[Column]` for
 * columns and `[Name]` for the result columns the query defines; manifests may quote the table
 * (`'table'[Column]`), so both sides are normalised before reading.
 */

/** `'Table'[Column]` → `Table[Column]` (executeQueries' spelling); `[Measure]` unchanged. */
export function normalizeKey(key: string): string {
  return key.trim().replace(/^'((?:[^']|'')+)'(?=\[)/, (_, table: string) => table.replace(/''/g, "'"));
}

/** Header text for a result column: `table[Column]` → Column, `[Measure]` → Measure. */
export function keyLabel(key: string): string {
  const bracket = /\[([^\]]+)\]\s*$/.exec(key);
  return (bracket?.[1] ?? key).replace(/_/g, ' ').trim();
}

/** A row with normalised keys. */
export function normalizeRow(row: DaxRow): DaxRow {
  const out: DaxRow = {};
  for (const [key, value] of Object.entries(row)) out[normalizeKey(key)] = value;
  return out;
}

const reader = (row: DaxRow | undefined) => {
  const normalized = row ? normalizeRow(row) : {};
  return (field: string): unknown => normalized[normalizeKey(field)];
};

/** Like toNumber, but a blank stays blank (a KPI shows "—", not 0). */
export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

const toRaw = (value: unknown): DataPointValue | undefined =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : undefined;

/** Category text: numbers and booleans as written, blank as "(Blank)". */
export function categoryLabel(value: unknown): string {
  if (value === null || value === undefined || value === '') return '(Blank)';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return toLabel(value);
}

export interface KpiData {
  value: number | null;
  comparisonValue: number | null;
  meterValue: number | null;
}
export interface HeroData extends KpiData {
  metrics: HeroMetric[];
}
export interface BarsData {
  data: BarItem[];
}
export interface BulletData {
  data: BulletItem[];
}
export interface TrendData {
  categories: string[];
  series: TrendSeries[];
  /** Tooltip measures per period (empty without `fields.tooltips`). */
  categoryTooltips: TooltipItem[][];
}
export interface IbcsData {
  data: IbcsItem[];
}
export interface TableData {
  columns: TableColumn[];
  rows: TableRow[];
  rowKey: string;
}

export interface SeriesData {
  categories: ChartCategory[];
  series: ChartSeries[];
}
export interface ScatterData {
  points: ScatterPoint[];
}
export interface MatrixData {
  nodes: MatrixNode[];
  columns: MatrixColumn[];
  measures: MatrixMeasure[];
  grandTotal?: MatrixNode;
}
export interface WaterfallData {
  steps: WaterfallStep[];
}
export interface TreemapData {
  nodes: TreemapNode[];
}
export interface CalendarData {
  days: CalendarDay[];
}
export interface DotPlotData {
  items: DotPlotItem[];
}
export interface TimelineData {
  tasks: TimelineTask[];
}
export interface BoxPlotData {
  items: BoxPlotItem[];
}
export interface KpiTrendData {
  series: KpiPoint[];
  /** The latest period with a value (the headline). */
  value: number | null;
  /** The comparison on that period's row (undefined without `fields.comparison`: the element compares with the previous period). */
  comparisonValue?: number | null;
  target: number | null;
}
export interface KpiBulletData {
  value: number | null;
  target: number | null;
  forecast: number | null;
}
export interface KpiVarianceData {
  actual: number | null;
  comparison: number | null;
}
export interface PointMapData {
  points: GeoPoint[];
}
export interface ChoroplethData {
  regions: RegionValue[];
}
export interface SlicerOption {
  id: string;
  label: string;
  raw: DataPointValue | null;
  count: number | null;
}
export interface SlicerData {
  options: SlicerOption[];
}

export interface MappedDataMap {
  UniverusKpiCard: KpiData;
  UniverusKpiHero: HeroData;
  UniverusSpotlightBars: BarsData;
  UniverusRankingBars: BarsData;
  UniverusDivergingBars: BarsData;
  UniverusDonut: BarsData;
  UniverusBulletBars: BulletData;
  UniverusTrendChart: TrendData;
  UniverusIbcsVariance: IbcsData;
  UniverusDataTable: TableData;
  UniverusColumnChart: SeriesData;
  UniverusStackedBars: SeriesData;
  UniverusScatter: ScatterData;
  UniverusMatrix: MatrixData;
  UniverusWaterfall: WaterfallData;
  UniverusTreemap: TreemapData;
  UniverusCalendarHeatmap: CalendarData;
  UniverusDotPlot: DotPlotData;
  UniverusTimeline: TimelineData;
  UniverusBoxplot: BoxPlotData;
  UniverusKpiTrend: KpiTrendData;
  UniverusKpiBullet: KpiBulletData;
  UniverusKpiVariance: KpiVarianceData;
  UniverusPointMap: PointMapData;
  UniverusChoropleth: ChoroplethData;
  UniverusSlicer: SlicerData;
}
export type MappedData<C extends ManifestComponentName = ManifestComponentName> = MappedDataMap[C];

function bars(rows: DaxRow[], fields: { category: string; value: string }): BarsData {
  return {
    data: rows.map((row) => {
      const read = reader(row);
      const category = read(fields.category);
      return { id: categoryLabel(category), label: categoryLabel(category), value: toNumber(read(fields.value)), raw: toRaw(category) };
    }),
  };
}

function kpi(rows: DaxRow[], fields: { value: string; comparison?: string; meter?: string }): KpiData {
  const read = reader(rows[0]);
  return {
    value: toNullableNumber(read(fields.value)),
    comparisonValue: fields.comparison ? toNullableNumber(read(fields.comparison)) : null,
    meterValue: fields.meter ? toNullableNumber(read(fields.meter)) : null,
  };
}

function table(rows: DaxRow[], visual: VisualOf<'UniverusDataTable'>): TableData {
  const columns: TableColumn[] = visual.fields.columns.map((c) => ({
    key: normalizeKey(c.field),
    label: c.label,
    kind: c.kind ?? (c.field.startsWith('[') ? 'number' : 'text'),
    format: c.format,
    ratioKey: c.ratioField ? normalizeKey(c.ratioField) : undefined,
    suffix: c.suffix,
    tone: c.tone,
    emptyLabel: c.emptyLabel,
  }));
  const rowKey = normalizeKey(visual.fields.rowKey ?? visual.fields.columns[0]?.field ?? '');
  return { columns, rows: rows.map(normalizeRow), rowKey };
}

type TooltipField = { field: string; label: string; format?: TooltipItem['format'] };

const tooltipsOf = (read: (field: string) => unknown, fields: readonly TooltipField[] | undefined): TooltipItem[] | undefined =>
  fields?.length
    ? fields.map((t) => {
        const v = read(t.field);
        return { label: t.label, value: typeof v === 'string' && toNullableNumber(v) === null ? v : toNullableNumber(v), format: t.format };
      })
    : undefined;

/** A category's identity: its raw value (TREATAS needs the column's own type) and its text. */
const categoryOf = (value: unknown) => ({ id: categoryLabel(value), label: categoryLabel(value), raw: toRaw(value) });

/**
 * Category × series data. Categories keep the query's order (ORDER BY decides time and bands);
 * long-shaped rows (`series` + `value`) pivot into one series per series value — `seriesOrder`
 * first, then in order of appearance; wide rows give one series per measure in `values`.
 */
function seriesData(rows: DaxRow[], visual: VisualOf<'UniverusColumnChart'> | VisualOf<'UniverusStackedBars'>): SeriesData {
  const { category, series, value, values, tooltips } = visual.fields;
  const categories = new Map<string, ChartCategory>();
  const index = new Map<string, number>();
  for (const row of rows) {
    const read = reader(row);
    const c = categoryOf(read(category));
    if (!categories.has(c.id)) {
      index.set(c.id, categories.size);
      categories.set(c.id, { ...c, ...(tooltips ? { tooltips: tooltipsOf(read, tooltips) } : {}) });
    }
  }
  const n = categories.size;
  const at = (row: DaxRow) => index.get(categoryLabel(reader(row)(category))) ?? 0;

  let out: ChartSeries[];
  if (values) {
    out = values.map((v) => {
      const s: ChartSeries = { id: v.label, label: v.label, values: Array.from({ length: n }, () => null) };
      for (const row of rows) s.values[at(row)] = toNullableNumber(reader(row)(v.field));
      return s;
    });
  } else if (series && value) {
    const bySeries = new Map<string, ChartSeries>();
    for (const row of rows) {
      const read = reader(row);
      const s = categoryOf(read(series));
      let entry = bySeries.get(s.id);
      if (!entry) {
        entry = { ...s, values: Array.from({ length: n }, () => null) };
        bySeries.set(s.id, entry);
      }
      entry.values[at(row)] = toNullableNumber(read(value));
    }
    out = byOrder([...bySeries.values()], visual.props.seriesOrder);
  } else {
    const measure = value ?? '';
    const s: ChartSeries = { id: 'value', label: keyLabel(measure), values: Array.from({ length: n }, () => null) };
    for (const row of rows) s.values[at(row)] = toNullableNumber(reader(row)(measure));
    out = [s];
  }
  return { categories: [...categories.values()], series: out };
}

function scatterData(rows: DaxRow[], visual: VisualOf<'UniverusScatter'>): ScatterData {
  const { category, x, y, size, group, tooltips } = visual.fields;
  return {
    points: rows.map((row) => {
      const read = reader(row);
      return {
        ...categoryOf(read(category)),
        x: toNullableNumber(read(x)),
        y: toNullableNumber(read(y)),
        ...(size ? { size: toNullableNumber(read(size)) } : {}),
        ...(group ? { group: categoryLabel(read(group)) } : {}),
        ...(tooltips ? { tooltips: tooltipsOf(read, tooltips) } : {}),
      };
    }),
  };
}

const isTrue = (v: unknown) => v === true || v === 1 || v === 'True' || v === 'true';

/**
 * Matrix rows → a tree. With ROLLUPADDISSUBTOTAL flags (`rowTotals`, top level first), a row whose
 * first true flag is at level k belongs to the node at depth k−1 (its subtotal) or, at k = 0, to
 * the grand total; rows without a true flag are leaves. `columnTotal` marks the row totals. Every
 * value is the engine's: nothing is summed or averaged here.
 */
function matrixData(rows: DaxRow[], visual: VisualOf<'UniverusMatrix'>): MatrixData {
  const { rows: levels, column, values, rowTotals, columnTotal } = visual.fields;
  const measures: MatrixMeasure[] = values.map((v) => ({
    id: normalizeKey(v.field),
    label: v.label,
    format: v.format,
    heatmap: v.heatmap,
    goodWhen: v.goodWhen,
    center: v.center,
  }));
  let columns: MatrixColumn[] = [];
  if (column) {
    const seen = new Map<string, MatrixColumn>();
    for (const row of rows) {
      const read = reader(row);
      if (columnTotal && isTrue(read(columnTotal))) continue;
      const c = categoryOf(read(column));
      if (!seen.has(c.id)) seen.set(c.id, c);
    }
    columns = byOrder([...seen.values()], visual.props.columnOrder);
  }
  const columnIndex = new Map(columns.map((c, i) => [c.id, i]));
  const width = column ? columns.length : 1;
  const blank = (): MatrixNode['cells'] => Object.fromEntries(measures.map((m) => [m.id, Array.from({ length: width }, () => null)]));

  const roots: MatrixNode[] = [];
  const byPath = new Map<string, MatrixNode>();
  let grandTotal: MatrixNode | undefined;
  const nodeAt = (path: unknown[]): MatrixNode => {
    let siblings = roots;
    let key = '';
    let node: MatrixNode | undefined;
    for (const value of path) {
      const c = categoryOf(value);
      key = `${key}/${c.id}`;
      node = byPath.get(key);
      if (!node) {
        node = { ...c, cells: blank() };
        byPath.set(key, node);
        siblings.push(node);
      }
      node.children ??= [];
      siblings = node.children;
    }
    return node as MatrixNode;
  };

  for (const row of rows) {
    const read = reader(row);
    const flagged = rowTotals ? rowTotals.findIndex((f) => isTrue(read(f))) : -1;
    const depth = flagged < 0 ? levels.length : flagged;
    const node = depth === 0 ? (grandTotal ??= { id: '__total__', label: 'Total', cells: blank() }) : nodeAt(levels.slice(0, depth).map((l) => read(l)));
    const rowTotal = column && columnTotal ? isTrue(read(columnTotal)) : false;
    const ci = column && !rowTotal ? (columnIndex.get(categoryLabel(read(column))) ?? -1) : 0;
    for (const m of measures) {
      const v = toNullableNumber(read(m.id));
      if (rowTotal) (node.total ??= {})[m.id] = v;
      else if (ci >= 0) (node.cells[m.id] as Array<number | null>)[ci] = v;
    }
  }
  // Leaves carry no empty children array
  for (const node of byPath.values()) if (node.children?.length === 0) delete node.children;
  return { nodes: byOrder(roots, visual.props.rowOrder), columns, measures, ...(grandTotal ? { grandTotal } : {}) };
}

/** Items named in `order` first, in that order; the rest keep their query order (a stable sort). */
function byOrder<T extends { id: string }>(items: T[], order: readonly string[] | undefined): T[] {
  if (!order?.length) return items;
  const rank = (t: T) => {
    const i = order.indexOf(t.id);
    return i < 0 ? order.length : i;
  };
  return items.map((t, i) => ({ t, i })).sort((a, b) => rank(a.t) - rank(b.t) || a.i - b.i).map(({ t }) => t);
}

const KINDS = new Set(['start', 'delta', 'subtotal', 'end']);

/** Bridge steps in query order; a `kind` column names the levels (start / delta / subtotal / end). */
function waterfallData(rows: DaxRow[], visual: VisualOf<'UniverusWaterfall'>): WaterfallData {
  const { category, value, kind, tooltips } = visual.fields;
  return {
    steps: rows.map((row) => {
      const read = reader(row);
      const k = kind ? String(read(kind) ?? '').trim().toLowerCase() : '';
      return {
        ...categoryOf(read(category)),
        value: toNullableNumber(read(value)),
        ...(KINDS.has(k) ? { kind: k as WaterfallStep['kind'] } : {}),
        ...(tooltips ? { tooltips: tooltipsOf(read, tooltips) } : {}),
      };
    }),
  };
}

/** Items under their group (two levels) or a flat list (one level); sizes and colours from the engine. */
function treemapData(rows: DaxRow[], visual: VisualOf<'UniverusTreemap'>): TreemapData {
  const { levels, value, color, tooltips } = visual.fields;
  const leaf = (read: (field: string) => unknown, column: string): TreemapNode => ({
    ...categoryOf(read(column)),
    value: toNullableNumber(read(value)),
    ...(color ? { colorValue: toNullableNumber(read(color)) } : {}),
    ...(tooltips ? { tooltips: tooltipsOf(read, tooltips) } : {}),
  });
  const [top, item] = levels;
  if (!item) return { nodes: rows.map((row) => leaf(reader(row), top as string)) };
  const groups = new Map<string, TreemapNode>();
  for (const row of rows) {
    const read = reader(row);
    const g = categoryOf(read(top as string));
    let group = groups.get(g.id);
    if (!group) {
      group = { ...g, children: [] };
      groups.set(g.id, group);
    }
    group.children?.push(leaf(read, item));
  }
  return { nodes: [...groups.values()] };
}

const dateText = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? ''));

/** One day per row: the date as the engine returned it (a click reports it back as a DATE). */
function calendarData(rows: DaxRow[], visual: VisualOf<'UniverusCalendarHeatmap'>): CalendarData {
  const { date, value, tooltips } = visual.fields;
  return {
    days: rows
      .map((row) => {
        const read = reader(row);
        const d = read(date);
        return {
          date: dateText(d),
          value: toNullableNumber(read(value)),
          ...(typeof d === 'string' || typeof d === 'number' ? { raw: d } : {}),
          ...(tooltips ? { tooltips: tooltipsOf(read, tooltips) } : {}),
        };
      })
      .filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d.date)),
  };
}

function dotPlotData(rows: DaxRow[], visual: VisualOf<'UniverusDotPlot'>): DotPlotData {
  const { category, from, to, tooltips } = visual.fields;
  return {
    items: rows.map((row) => {
      const read = reader(row);
      return {
        ...categoryOf(read(category)),
        from: toNullableNumber(read(from)),
        to: toNullableNumber(read(to)),
        ...(tooltips ? { tooltips: tooltipsOf(read, tooltips) } : {}),
      };
    }),
  };
}

const TONES = new Set(['ok', 'warn', 'bad', 'accent', 'neutral']);

/** One item per row; rows without a start date are dropped (nothing to place). */
function timelineData(rows: DaxRow[], visual: VisualOf<'UniverusTimeline'>): TimelineData {
  const { item, start, end, lane, tone, tooltips } = visual.fields;
  return {
    tasks: rows.flatMap((row, i) => {
      const read = reader(row);
      const s = read(start);
      if (s === null || s === undefined || s === '') return [];
      const e = end ? read(end) : null;
      const t = tone ? String(read(tone) ?? '').trim().toLowerCase() : '';
      const c = categoryOf(read(item));
      return [
        {
          ...c,
          // Several items may share a name: keep the ids unique
          id: `${c.id}#${i}`,
          start: dateText(s),
          end: e === null || e === undefined || e === '' ? null : dateText(e),
          ...(lane ? { lane: categoryLabel(read(lane)) } : {}),
          ...(TONES.has(t) ? { tone: t as TimelineTask['tone'] } : {}),
          ...(tooltips ? { tooltips: tooltipsOf(read, tooltips) } : {}),
        },
      ];
    }),
  };
}

/** Engine statistics per row, or raw observations gathered per category (summarised by the element). */
function boxPlotData(rows: DaxRow[], visual: VisualOf<'UniverusBoxplot'>): BoxPlotData {
  const f = visual.fields;
  if (f.value) {
    const byCategory = new Map<string, BoxPlotItem & { values: number[] }>();
    for (const row of rows) {
      const read = reader(row);
      const c = categoryOf(read(f.category));
      let entry = byCategory.get(c.id);
      if (!entry) {
        entry = { ...c, values: [] };
        byCategory.set(c.id, entry);
      }
      const v = toNullableNumber(read(f.value));
      if (v !== null) entry.values.push(v);
    }
    return { items: [...byCategory.values()] };
  }
  return {
    items: rows.map((row) => {
      const read = reader(row);
      const stat = (field: string | undefined) => (field ? toNullableNumber(read(field)) : null);
      return {
        ...categoryOf(read(f.category)),
        min: stat(f.min),
        q1: stat(f.q1),
        median: stat(f.median),
        q3: stat(f.q3),
        max: stat(f.max),
        mean: stat(f.mean),
        count: stat(f.count),
        ...(f.tooltips ? { tooltips: tooltipsOf(read, f.tooltips) } : {}),
      };
    }),
  };
}

/** Periods in query order (ORDER BY); the headline is the latest period that has a value. */
function kpiTrendData(rows: DaxRow[], visual: VisualOf<'UniverusKpiTrend'>): KpiTrendData {
  const { category, value, comparison, target } = visual.fields;
  const read = rows.map(reader);
  const series = read.map((r) => ({ label: categoryLabel(r(category)), value: toNullableNumber(r(value)) }));
  let last = -1;
  series.forEach((p, i) => p.value !== null && (last = i));
  const lastRow = last >= 0 ? read[last] : undefined;
  return {
    series,
    value: last >= 0 ? (series[last]?.value ?? null) : null,
    ...(comparison ? { comparisonValue: lastRow ? toNullableNumber(lastRow(comparison)) : null } : {}),
    target: target && lastRow ? toNullableNumber(lastRow(target)) : null,
  };
}

const MAX_LAT = 90;
const MAX_LON = 180;

/**
 * One point per row with valid WGS 84 coordinates (rows without them are skipped: nothing to
 * place). Ids stay unique when names repeat; a click still reports the row's own category value.
 */
function pointMapData(rows: DaxRow[], visual: VisualOf<'UniverusPointMap'>): PointMapData {
  const { latitude, longitude, category, value, group, tooltips } = visual.fields;
  const seen = new Set<string>();
  return {
    points: rows.flatMap((row) => {
      const read = reader(row);
      const lat = toNullableNumber(read(latitude));
      const lon = toNullableNumber(read(longitude));
      if (lat === null || lon === null || Math.abs(lat) > MAX_LAT || Math.abs(lon) > MAX_LON || (lat === 0 && lon === 0)) return [];
      const c = categoryOf(read(category));
      let id = c.id;
      for (let k = 2; seen.has(id); k++) id = `${c.id} (${k})`;
      seen.add(id);
      return [
        {
          ...c,
          id,
          lat,
          lon,
          ...(value ? { value: toNullableNumber(read(value)) } : {}),
          ...(group ? { group: categoryLabel(read(group)) } : {}),
          ...(tooltips ? { tooltips: tooltipsOf(read, tooltips) } : {}),
        },
      ];
    }),
  };
}

/** One region per row: its key as the model returns it (the click reports it back), value and name. */
function choroplethData(rows: DaxRow[], visual: VisualOf<'UniverusChoropleth'>): ChoroplethData {
  const { region, value, label, tooltips } = visual.fields;
  return {
    regions: rows.flatMap((row) => {
      const read = reader(row);
      const key = read(region);
      if (key === null || key === undefined || key === '') return [];
      return [
        {
          key: String(key),
          ...(toRaw(key) !== undefined ? { raw: toRaw(key) } : {}),
          ...(label ? { label: categoryLabel(read(label)) } : {}),
          value: toNullableNumber(read(value)),
          ...(tooltips ? { tooltips: tooltipsOf(read, tooltips) } : {}),
        },
      ];
    }),
  };
}

function slicerData(rows: DaxRow[], visual: VisualOf<'UniverusSlicer'>): SlicerData {
  const { value, count } = visual.fields;
  return {
    options: rows.map((row) => {
      const read = reader(row);
      const v = read(value);
      return { id: categoryLabel(v), label: categoryLabel(v), raw: toRaw(v) ?? null, count: count ? toNullableNumber(read(count)) : null };
    }),
  };
}

/** Maps a visual's query rows to its element's data props. */
export function mapRows<V extends ManifestVisual>(visual: V, rows: DaxRow[]): MappedData<V['component']>;
export function mapRows(visual: ManifestVisual, rows: DaxRow[]): MappedData {
  switch (visual.component) {
    case 'UniverusKpiCard':
      return kpi(rows, visual.fields);
    case 'UniverusKpiHero': {
      const read = reader(rows[0]);
      return {
        ...kpi(rows, visual.fields),
        metrics: (visual.fields.metrics ?? []).map((m) => ({ label: m.label, value: toNullableNumber(read(m.field)), format: m.format })),
      };
    }
    case 'UniverusSpotlightBars':
    case 'UniverusRankingBars':
    case 'UniverusDivergingBars':
    case 'UniverusDonut':
      return bars(rows, visual.fields);
    case 'UniverusBulletBars':
      return {
        data: rows.map((row) => {
          const read = reader(row);
          const category = read(visual.fields.category);
          return {
            id: categoryLabel(category),
            label: categoryLabel(category),
            actual: toNumber(read(visual.fields.actual)),
            target: toNullableNumber(read(visual.fields.target)),
            raw: toRaw(category),
          };
        }),
      };
    case 'UniverusIbcsVariance':
      return {
        data: rows.map((row) => {
          const read = reader(row);
          const category = read(visual.fields.category);
          return {
            id: categoryLabel(category),
            label: categoryLabel(category),
            actual: toNullableNumber(read(visual.fields.actual)),
            comparison: toNullableNumber(read(visual.fields.comparison)),
            raw: toRaw(category),
          };
        }),
      };
    case 'UniverusTrendChart': {
      const { category, value, comparison } = visual.fields;
      const read = rows.map(reader);
      const series: TrendSeries[] = [
        { id: 'value', label: visual.props.seriesLabel ?? keyLabel(value), role: 'primary', values: read.map((r) => toNullableNumber(r(value))) },
      ];
      if (comparison) {
        series.push({
          id: 'comparison',
          label: visual.props.comparisonLabel ?? keyLabel(comparison),
          role: 'comparison',
          values: read.map((r) => toNullableNumber(r(comparison))),
        });
      }
      const tips = visual.fields.tooltips;
      return {
        categories: read.map((r) => categoryLabel(r(category))),
        series,
        categoryTooltips: tips ? read.map((r) => tooltipsOf(r, tips) ?? []) : [],
      };
    }
    case 'UniverusDataTable':
      return table(rows, visual);
    case 'UniverusColumnChart':
    case 'UniverusStackedBars':
      return seriesData(rows, visual);
    case 'UniverusScatter':
      return scatterData(rows, visual);
    case 'UniverusMatrix':
      return matrixData(rows, visual);
    case 'UniverusWaterfall':
      return waterfallData(rows, visual);
    case 'UniverusTreemap':
      return treemapData(rows, visual);
    case 'UniverusCalendarHeatmap':
      return calendarData(rows, visual);
    case 'UniverusDotPlot':
      return dotPlotData(rows, visual);
    case 'UniverusTimeline':
      return timelineData(rows, visual);
    case 'UniverusBoxplot':
      return boxPlotData(rows, visual);
    case 'UniverusKpiTrend':
      return kpiTrendData(rows, visual);
    case 'UniverusKpiBullet': {
      const read = reader(rows[0]);
      const f = visual.fields;
      return { value: toNullableNumber(read(f.value)), target: f.target ? toNullableNumber(read(f.target)) : null, forecast: f.forecast ? toNullableNumber(read(f.forecast)) : null };
    }
    case 'UniverusKpiVariance': {
      const read = reader(rows[0]);
      return { actual: toNullableNumber(read(visual.fields.actual)), comparison: toNullableNumber(read(visual.fields.comparison)) };
    }
    case 'UniverusPointMap':
      return pointMapData(rows, visual);
    case 'UniverusChoropleth':
      return choroplethData(rows, visual);
    case 'UniverusSlicer':
      return slicerData(rows, visual);
  }
}
