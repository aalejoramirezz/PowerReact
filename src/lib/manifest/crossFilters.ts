import type { DataPointValue } from '@powerreact/udp-powerbi-visuals';
import type { DaxRow } from '../dax/types';
import { sameColumn } from './daxInjection';
import { normalizeKey, normalizeRow, toNullableNumber } from './mapRows';
import type { ManifestVisual } from './schema';

/**
 * Where a filter came from, which decides how visuals on its own column react (as in Power BI):
 * - `select`: a click on a mark. Visuals on that column keep every category and highlight it.
 * - `slicer`: a slicer or report filter. It filters every visual but its source.
 * A column holds at most one filter of each origin; they intersect.
 */
export type CrossFilterOrigin = 'select' | 'slicer';

/** A dashboard filter (kept per dashboard in the filter store). */
export interface CrossFilter {
  /** Column reference, as the source visual's `crossFilter.field`. */
  field: string;
  /** The column is one of these (never empty; a click holds exactly one). */
  values: DataPointValue[];
  /** Display texts of the values, same order (chips). */
  labels?: string[];
  sourceVisualId: string;
  origin: CrossFilterOrigin;
}

/** One dimension of a click: a matrix cell or a stacked segment carries several. */
export interface CrossFilterPoint {
  field: string;
  value: DataPointValue;
  label?: string;
}

/** The columns a visual selects on (its click filters), so it highlights them instead of filtering. */
export function ownColumns(visual: ManifestVisual): string[] {
  if (visual.component === 'UniverusSlicer') return [visual.fields.value];
  const cf = visual.crossFilter;
  if (!cf) return [];
  switch (visual.component) {
    // A segment also selects its series; a matrix cell its row level and column member
    case 'UniverusColumnChart':
    case 'UniverusStackedBars':
      return [cf.field, ...(visual.fields.series ? [visual.fields.series] : [])];
    case 'UniverusMatrix':
      return [cf.field, ...visual.fields.rows, ...(visual.fields.column ? [visual.fields.column] : [])].filter((c, i, all) => all.findIndex((o) => sameColumn(o, c)) === i);
    // A tile reports its group and itself
    case 'UniverusTreemap':
      return [cf.field, ...visual.fields.levels].filter((c, i, all) => all.findIndex((o) => sameColumn(o, c)) === i);
    default:
      return [cf.field];
  }
}

const onColumns = (f: CrossFilter, columns: readonly string[]) => columns.some((c) => sameColumn(f.field, c));

/** The selection (a click) on one column, e.g. a stacked chart's series or a matrix's column dimension. */
export function selectionOn(filters: readonly CrossFilter[], field: string | undefined): DataPointValue | null {
  if (!field) return null;
  return filters.find((f) => f.origin === 'select' && sameColumn(f.field, field))?.values[0] ?? null;
}

/**
 * The filters a visual's query obeys: never its own; never a selection on one of its own columns
 * (it keeps every category and highlights it, Power BI's default interaction); every slicer.
 * `crossFilter.respect: false` opts out of every filter.
 */
export function appliedFilters(visual: ManifestVisual, filters: readonly CrossFilter[]): CrossFilter[] {
  if (visual.crossFilter?.respect === false) return [];
  const own = ownColumns(visual);
  return filters.filter((f) => f.sourceVisualId !== visual.id && !(f.origin === 'select' && onColumns(f, own)));
}

/** The value this visual highlights: the selection on its own column. */
export function selectionOf(visual: ManifestVisual, filters: readonly CrossFilter[]): DataPointValue | null {
  const own = ownColumns(visual);
  return filters.find((f) => f.origin === 'select' && onColumns(f, own))?.values[0] ?? null;
}

/** A slicer's current selection on its own column (empty: everything). */
export function slicerValuesOf(visual: ManifestVisual, filters: readonly CrossFilter[]): DataPointValue[] {
  const own = ownColumns(visual);
  return filters.find((f) => f.origin === 'slicer' && onColumns(f, own))?.values ?? [];
}

/* ─────────────────────────── Sample mode ─────────────────────────── */

interface Aggregation {
  /** Result columns the rows are grouped by (none: everything into one row). */
  groupBy: string[];
  sum: string[];
  /** Ratios cannot be summed: averaged instead (an approximation; Live mode is the truth). */
  mean: string[];
}

const isPercent = (format?: { style: string }) => format?.style === 'percent';

/** How Sample mode reduces a visual's rows to its grain; null keeps every row (one mark per row). */
function aggregation(visual: ManifestVisual): Aggregation | null {
  const ratio = (field: string | undefined, percent: boolean): Partial<Aggregation> =>
    !field ? {} : percent ? { mean: [field] } : { sum: [field] };
  const merge = (...parts: Array<Partial<Aggregation>>): Aggregation => ({
    groupBy: parts.flatMap((p) => p.groupBy ?? []),
    sum: parts.flatMap((p) => p.sum ?? []),
    mean: parts.flatMap((p) => p.mean ?? []),
  });
  switch (visual.component) {
    case 'UniverusKpiCard': {
      const pct = isPercent(visual.props.format);
      return merge(ratio(visual.fields.value, pct), ratio(visual.fields.comparison, pct), ratio(visual.fields.meter, true));
    }
    case 'UniverusKpiHero': {
      const pct = isPercent(visual.props.format);
      return merge(
        ratio(visual.fields.value, pct),
        ratio(visual.fields.comparison, pct),
        ratio(visual.fields.meter, true),
        ...(visual.fields.metrics ?? []).map((m) => ratio(m.field, isPercent(m.format)))
      );
    }
    case 'UniverusBulletBars':
      return { groupBy: [visual.fields.category], sum: [visual.fields.actual, visual.fields.target], mean: [] };
    case 'UniverusIbcsVariance':
      return { groupBy: [visual.fields.category], sum: [visual.fields.actual, visual.fields.comparison], mean: [] };
    case 'UniverusTrendChart':
      return { groupBy: [visual.fields.category], sum: [visual.fields.value, ...(visual.fields.comparison ? [visual.fields.comparison] : [])], mean: [] };
    case 'UniverusDataTable': {
      const columns = visual.fields.columns;
      const numeric = columns.filter((c) => (c.kind ?? (c.field.startsWith('[') ? 'number' : 'text')) !== 'text');
      return {
        groupBy: [visual.fields.rowKey ?? columns[0]?.field].filter((k): k is string => !!k),
        sum: numeric.filter((c) => !isPercent(c.format)).map((c) => c.field),
        mean: [...numeric.filter((c) => isPercent(c.format)).map((c) => c.field), ...columns.flatMap((c) => (c.ratioField ? [c.ratioField] : []))],
      };
    }
    case 'UniverusColumnChart':
    case 'UniverusStackedBars': {
      const { category, series, value, values, tooltips } = visual.fields;
      return merge(
        { groupBy: [category, ...(series ? [series] : [])] },
        { sum: value ? [value] : (values ?? []).map((v) => v.field) },
        ...(tooltips ?? []).map((t) => ratio(t.field, isPercent(t.format)))
      );
    }
    case 'UniverusScatter': {
      // x / y are usually averages or rates: averaged; the bubble size is a quantity: summed
      const { category, group, x, y, size, tooltips } = visual.fields;
      return merge(
        { groupBy: [category, ...(group ? [group] : [])], mean: [x, y] },
        ratio(size, false),
        ...(tooltips ?? []).map((t) => ratio(t.field, isPercent(t.format)))
      );
    }
    case 'UniverusMatrix': {
      // Sample rows keep the engine's subtotal rows: grouped by every level, column and flag
      const { rows, column, values, rowTotals, columnTotal } = visual.fields;
      return merge(
        { groupBy: [...rows, ...(column ? [column] : []), ...(rowTotals ?? []), ...(columnTotal ? [columnTotal] : [])] },
        ...values.map((v) => ratio(v.field, isPercent(v.format)))
      );
    }
    case 'UniverusSlicer':
      return merge({ groupBy: [visual.fields.value] }, ratio(visual.fields.count, false));
    case 'UniverusWaterfall': {
      const { category, value, kind, tooltips } = visual.fields;
      return merge({ groupBy: [category, ...(kind ? [kind] : [])], sum: [value] }, ...(tooltips ?? []).map((t) => ratio(t.field, isPercent(t.format))));
    }
    case 'UniverusTreemap': {
      // The colour measure is usually a rate or an average: averaged
      const { levels, value, color, tooltips } = visual.fields;
      return merge({ groupBy: levels, sum: [value] }, ratio(color, true), ...(tooltips ?? []).map((t) => ratio(t.field, isPercent(t.format))));
    }
    case 'UniverusCalendarHeatmap': {
      const { date, value, tooltips } = visual.fields;
      return merge({ groupBy: [date], sum: [value] }, ...(tooltips ?? []).map((t) => ratio(t.field, isPercent(t.format))));
    }
    case 'UniverusDotPlot': {
      const { category, from, to, tooltips } = visual.fields;
      return merge({ groupBy: [category], sum: [from, to] }, ...(tooltips ?? []).map((t) => ratio(t.field, isPercent(t.format))));
    }
    case 'UniverusTimeline':
      return null;
    case 'UniverusBoxplot': {
      // Raw observations stay one per row; engine statistics are averaged per category
      const f = visual.fields;
      if (f.value) return null;
      const stats = [f.min, f.q1, f.median, f.q3, f.max, f.mean].filter((k): k is string => !!k);
      return merge({ groupBy: [f.category], mean: stats }, ratio(f.count, false), ...(f.tooltips ?? []).map((t) => ratio(t.field, isPercent(t.format))));
    }
    default:
      return { groupBy: [visual.fields.category], sum: [visual.fields.value], mean: [] };
  }
}

function aggregate(rows: DaxRow[], spec: Aggregation | null): DaxRow[] {
  if (!spec) return rows;
  const { groupBy, sum, mean } = spec;
  const sumKeys = sum.map(normalizeKey);
  const meanKeys = mean.map(normalizeKey).filter((k) => !sumKeys.includes(k));
  const groupKeys = groupBy.map(normalizeKey);
  const groups = new Map<string, DaxRow[]>();
  for (const row of rows) {
    const id = JSON.stringify(groupKeys.map((k) => row[k]));
    groups.set(id, [...(groups.get(id) ?? []), row]);
  }
  return [...groups.values()].map((members) => {
    const out: DaxRow = { ...members[0] };
    for (const key of sumKeys) {
      const values = members.map((m) => toNullableNumber(m[key])).filter((v): v is number => v !== null);
      out[key] = values.length ? values.reduce((a, b) => a + b, 0) : null;
    }
    for (const key of meanKeys) {
      const values = members.map((m) => toNullableNumber(m[key])).filter((v): v is number => v !== null);
      out[key] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    }
    return out;
  });
}

/**
 * Sample mode (no network): the visual's `sample` rows with the cross-filters applied in the
 * browser — only filters on a column the rows carry — then aggregated to the visual's grain
 * (single-value visuals sum their measures; ratios are averaged). An approximation for UI checks.
 */
export function sampleRows(visual: ManifestVisual, filters: readonly CrossFilter[]): DaxRow[] {
  let rows = (visual.sample ?? []).map(normalizeRow);
  for (const filter of filters) {
    const key = normalizeKey(filter.field);
    if (!rows.some((r) => key in r)) continue;
    rows = rows.filter((r) => filter.values.some((v) => String(r[key]) === String(v)));
  }
  return aggregate(rows, aggregation(visual));
}

/* ─────────────────────────── Report filters ─────────────────────────── */

/** The source id of a report filter (the manifest's root `filters`, drawn in the toolbar). */
export const reportFilterId = (index: number): string => `@filters/${index}`;

/** A report filter's options obey every other filter, never one on its own column. */
export function optionFilters(field: string, filters: readonly CrossFilter[]): CrossFilter[] {
  return filters.filter((f) => !sameColumn(f.field, field));
}

/** The values a report filter currently keeps (empty: everything). */
export function reportFilterValues(index: number, filters: readonly CrossFilter[]): DataPointValue[] {
  return filters.find((f) => f.origin === 'slicer' && f.sourceVisualId === reportFilterId(index))?.values ?? [];
}

/**
 * Sample mode: a report filter's options are the column's distinct values across every visual's
 * sample rows that survive the other filters (no query needed offline).
 */
export function sampleColumnValues(visuals: readonly ManifestVisual[], field: string, filters: readonly CrossFilter[]): unknown[] {
  const key = normalizeKey(field);
  const seen = new Map<string, unknown>();
  for (const visual of visuals) {
    let rows = (visual.sample ?? []).map(normalizeRow).filter((r) => key in r);
    for (const filter of optionFilters(field, filters)) {
      const k = normalizeKey(filter.field);
      if (!rows.some((r) => k in r)) continue;
      rows = rows.filter((r) => filter.values.some((v) => String(r[k]) === String(v)));
    }
    for (const r of rows) if (!seen.has(String(r[key]))) seen.set(String(r[key]), r[key]);
  }
  return [...seen.values()].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
}
