import type { EventEmitter } from '@stencil/core';
import { clickValue, type Categorised } from './data';
import type { DataPointClickDetail, DataPointFilter, DataPointValue, TooltipItem } from './events';
import { sameValue } from './events';
import { foldSeries } from './layout/series';
import { OTHER_FILL, seriesColour, type PaletteKind, type SeriesColour } from './palette';

/**
 * Data shared by the category × series charts (column chart, stacked bars): categories on one axis,
 * one value per category per series. Shapes stay JSON-friendly so containers pass query rows through.
 */

export interface ChartCategory extends Categorised {
  id: string;
  label: string;
  /** Extra measures shown in this category's tooltip (Lens `tooltips`). */
  tooltips?: TooltipItem[];
}

export interface ChartSeries extends Categorised {
  id: string;
  label: string;
  /** One value per category, in category order (null = no value). */
  values: Array<number | null>;
}

/** A target, average or threshold drawn across a plot. */
export interface ReferenceLineSpec {
  value: number;
  label?: string;
}

/** none keeps the order received (time, ordinal bands); desc / asc rank by category total. */
export type CategorySort = 'none' | 'desc' | 'asc';

/** The folded rest: "Other (n)". Context, not data: it is never clickable. */
export const OTHER_ID = '__other__';

export interface SeriesChartOptions {
  sort?: CategorySort;
  /** Keep the N largest categories; the rest fold into "Other" so totals stay true. */
  topN?: number;
  palette?: PaletteKind;
  /** Nominal series beyond this fold into "Other" (ordinal palettes never fold). */
  maxSeries?: number;
}

export interface SeriesChartModel {
  categories: ChartCategory[];
  series: ChartSeries[];
  colours: SeriesColour[];
  /** Categories folded into "Other" by `topN`. */
  hiddenCategories: number;
  /** Series folded into "Other". */
  foldedSeries: number;
}

const num = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Sorting, top N and series folding, then a colour per series from its palette. */
export function seriesChartModel(
  categories: readonly ChartCategory[],
  series: readonly ChartSeries[],
  { sort = 'none', topN, palette = 'categorical', maxSeries = 6 }: SeriesChartOptions = {}
): SeriesChartModel {
  const total = (c: number) => series.reduce((t, s) => t + num(s.values[c]), 0);
  let order = categories.map((_, i) => i);
  if (sort !== 'none') order.sort((a, b) => (sort === 'desc' ? total(b) - total(a) : total(a) - total(b)));

  let hiddenCategories = 0;
  let other: number[] = [];
  if (topN && topN > 0 && order.length > topN) {
    const ranked = [...order].sort((a, b) => total(b) - total(a));
    const keep = new Set(ranked.slice(0, topN));
    other = order.filter((i) => !keep.has(i));
    order = order.filter((i) => keep.has(i));
    hiddenCategories = other.length;
  }

  const cats: ChartCategory[] = order.map((i) => categories[i] as ChartCategory);
  if (other.length) cats.push({ id: OTHER_ID, label: `Other (${other.length})` });
  const reorder = (s: ChartSeries): ChartSeries => ({
    ...s,
    values: [
      ...order.map((i) => s.values[i] ?? null),
      ...(other.length ? [other.reduce((t, i) => t + num(s.values[i]), 0)] : []),
    ],
  });

  const shaped = series.map(reorder);
  const folded = palette === 'categorical' ? foldSeries(shaped, cats.length, maxSeries) : { series: shaped, folded: 0 };
  const out = folded.series as ChartSeries[];
  const colours = out.map((s, i) => (s.id === OTHER_ID ? { fill: OTHER_FILL, text: 'var(--pbi-title)' } : seriesColour(i, out.length, palette)));
  return { categories: cats, series: out, colours, hiddenCategories, foldedSeries: folded.folded };
}

/** The props a category × series chart uses to report a click. */
export interface SeriesClickable {
  visualId?: string;
  crossFilterField?: string;
  /** Column reference of the series dimension, e.g. 'condition'[Grade]. */
  seriesField?: string;
  interactive?: boolean;
  dataPointClick: EventEmitter<DataPointClickDetail>;
}

/** Clicks are reported when asked to, or when either dimension has a field. */
export const seriesInteractive = (c: Pick<SeriesClickable, 'interactive' | 'crossFilterField' | 'seriesField'>): boolean =>
  c.interactive ?? Boolean(c.crossFilterField || c.seriesField);

/**
 * Reports a click on a category (and, on a segment, its series): `value` is the category, `filters`
 * lists every dimension that has a field, so a container applies them together. "Other" is skipped.
 */
export function emitSeriesClick(c: SeriesClickable, category: ChartCategory, series?: ChartSeries): void {
  const onCategory = category.id !== OTHER_ID;
  const onSeries = Boolean(series && series.id !== OTHER_ID && c.seriesField);
  if (!onCategory && !onSeries) return;
  const filters: DataPointFilter[] = [];
  if (onCategory && c.crossFilterField) filters.push({ field: c.crossFilterField, value: clickValue(category), label: category.label });
  if (onSeries && series && c.seriesField) filters.push({ field: c.seriesField, value: clickValue(series), label: series.label });
  c.dataPointClick.emit({
    visualId: c.visualId ?? null,
    field: onCategory ? (c.crossFilterField ?? null) : (c.seriesField ?? null),
    value: onCategory ? clickValue(category) : series ? clickValue(series) : null,
    label: onCategory ? category.label : (series?.label ?? ''),
    ...(c.seriesField ? { filters } : {}),
  });
}

/** Dimmed when another category or another series is selected. */
export function isDimmed(
  category: ChartCategory,
  series: ChartSeries | undefined,
  selectedValue: DataPointValue | null | undefined,
  selectedSeries: DataPointValue | null | undefined
): boolean {
  const offCategory = selectedValue !== null && selectedValue !== undefined && !sameValue(clickValue(category), selectedValue);
  const offSeries = selectedSeries !== null && selectedSeries !== undefined && (!series || !sameValue(clickValue(series), selectedSeries));
  return offCategory || offSeries;
}
