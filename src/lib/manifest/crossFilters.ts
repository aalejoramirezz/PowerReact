import type { DataPointValue } from '@powerreact/univerus-elements';
import type { DaxRow } from '../dax/types';
import { sameColumn } from './daxInjection';
import { normalizeKey, normalizeRow, toNullableNumber } from './mapRows';
import type { ManifestVisual } from './schema';

/** A filter set by a click on a manifest visual (kept per dashboard in the filter store). */
export interface CrossFilter {
  /** Column reference, as the source visual's `crossFilter.field`. */
  field: string;
  value: DataPointValue;
  /** Display text of the value (chips). */
  label?: string;
  sourceVisualId: string;
}

/**
 * The filters a visual's query obeys. A visual is never filtered on its own column: like Power BI's
 * default interaction, it keeps every category and highlights the selection (`selectedValue`).
 * `crossFilter.respect: false` opts out of every filter.
 */
export function appliedFilters(visual: ManifestVisual, filters: readonly CrossFilter[]): CrossFilter[] {
  if (visual.crossFilter?.respect === false) return [];
  const own = visual.crossFilter?.field;
  return filters.filter((f) => f.sourceVisualId !== visual.id && !(own && sameColumn(f.field, own)));
}

/** The value this visual highlights: the active filter on its own column. */
export function selectionOf(visual: ManifestVisual, filters: readonly CrossFilter[]): DataPointValue | null {
  const own = visual.crossFilter?.field;
  if (!own) return null;
  return filters.find((f) => sameColumn(f.field, own))?.value ?? null;
}

/* ─────────────────────────── Sample mode ─────────────────────────── */

interface Aggregation {
  /** Result column the rows are grouped by (null: everything into one row). */
  groupBy: string | null;
  sum: string[];
  /** Ratios cannot be summed: averaged instead (an approximation; Live mode is the truth). */
  mean: string[];
}

const isPercent = (format?: { style: string }) => format?.style === 'percent';

function aggregation(visual: ManifestVisual): Aggregation {
  const ratio = (field: string | undefined, percent: boolean): Partial<Aggregation> =>
    !field ? {} : percent ? { mean: [field] } : { sum: [field] };
  const merge = (...parts: Array<Partial<Aggregation>>): Aggregation => ({
    groupBy: null,
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
      return { groupBy: visual.fields.category, sum: [visual.fields.actual, visual.fields.target], mean: [] };
    case 'UniverusIbcsVariance':
      return { groupBy: visual.fields.category, sum: [visual.fields.actual, visual.fields.comparison], mean: [] };
    case 'UniverusTrendChart':
      return { groupBy: visual.fields.category, sum: [visual.fields.value, ...(visual.fields.comparison ? [visual.fields.comparison] : [])], mean: [] };
    case 'UniverusDataTable': {
      const columns = visual.fields.columns;
      const numeric = columns.filter((c) => (c.kind ?? (c.field.startsWith('[') ? 'number' : 'text')) !== 'text');
      return {
        groupBy: visual.fields.rowKey ?? columns[0]?.field ?? null,
        sum: numeric.filter((c) => !isPercent(c.format)).map((c) => c.field),
        mean: [...numeric.filter((c) => isPercent(c.format)).map((c) => c.field), ...columns.flatMap((c) => (c.ratioField ? [c.ratioField] : []))],
      };
    }
    default:
      return { groupBy: visual.fields.category, sum: [visual.fields.value], mean: [] };
  }
}

function aggregate(rows: DaxRow[], { groupBy, sum, mean }: Aggregation): DaxRow[] {
  const sumKeys = sum.map(normalizeKey);
  const meanKeys = mean.map(normalizeKey).filter((k) => !sumKeys.includes(k));
  const groupKey = groupBy ? normalizeKey(groupBy) : null;
  const groups = new Map<string, DaxRow[]>();
  for (const row of rows) {
    const id = groupKey ? String(row[groupKey]) : '*';
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
    rows = rows.filter((r) => String(r[key]) === String(filter.value));
  }
  return aggregate(rows, aggregation(visual));
}
