import type {
  BarItem,
  BulletItem,
  DataPointValue,
  HeroMetric,
  IbcsItem,
  TableColumn,
  TableRow,
  TrendSeries,
} from '@powerreact/univerus-elements';
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
}
export interface IbcsData {
  data: IbcsItem[];
}
export interface TableData {
  columns: TableColumn[];
  rows: TableRow[];
  rowKey: string;
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
      return { categories: read.map((r) => categoryLabel(r(category))), series };
    }
    case 'UniverusDataTable':
      return table(rows, visual);
  }
}
