import { scaleLinear } from 'd3-scale';

/**
 * Category × series layout for the column chart and the stacked bars (FT "magnitude" and
 * "part-to-whole"): one value per category per series, laid out side by side or stacked.
 */

export type SeriesLayoutMode = 'single' | 'grouped' | 'stacked' | 'percent' | 'diverging';

export interface SeriesInput {
  id: string;
  label: string;
  /** One value per category (null = no value). */
  values: ReadonlyArray<number | null>;
}

export interface Segment {
  seriesIndex: number;
  categoryIndex: number;
  /** The value as received (for labels and tooltips). */
  value: number;
  /** Extent on the value axis (stacked / percent / diverging) or the bar (grouped / single). */
  start: number;
  end: number;
  /** value / category total (0 when the total is 0). */
  share: number;
}

export interface SeriesLayout {
  mode: SeriesLayoutMode;
  /** segments[categoryIndex] = the category's segments in series order. */
  segments: Segment[][];
  /** Sum of the category's values (absolute values for the diverging split). */
  totals: number[];
  /** Value-axis domain, always containing 0. */
  domain: [number, number];
}

const finite = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

export interface SeriesLayoutOptions {
  mode: SeriesLayoutMode;
  /** diverging: series drawn left of zero (e.g. Poor, Very poor), in the order given. */
  negativeSeries?: readonly string[];
  /** diverging: series split in half across zero (e.g. Fair). */
  neutralSeries?: readonly string[];
}

/**
 * Stacked: positives stack up from 0 and negatives down from 0 (never mixed in one run).
 * Percent: each category's absolute total becomes 100 %. Grouped / single: bars from 0.
 * Diverging (Likert): negative series extend left of 0 — the one listed first is innermost —,
 * neutral series straddle 0, the rest extend right; extents are shares of the category total and the
 * domain hugs the longest bars on each side (the zero line need not be centred).
 */
export function seriesLayout(categoryCount: number, series: readonly SeriesInput[], options: SeriesLayoutOptions): SeriesLayout {
  const { mode } = options;
  const segments: Segment[][] = [];
  const totals: number[] = [];
  let lo = 0;
  let hi = 0;

  for (let c = 0; c < categoryCount; c++) {
    const values = series.map((s) => (finite(s.values[c]) ? (s.values[c] as number) : 0));
    const total = values.reduce((sum, v) => sum + Math.abs(v), 0);
    totals.push(total);
    const share = (v: number) => (total > 0 ? Math.abs(v) / total : 0);
    const row: Segment[] = [];

    if (mode === 'grouped' || mode === 'single') {
      values.forEach((v, i) => {
        row.push({ seriesIndex: i, categoryIndex: c, value: v, start: Math.min(0, v), end: Math.max(0, v), share: share(v) });
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      });
    } else if (mode === 'diverging') {
      const { negative, neutral, positive } = divergingGroups(series, options);
      const neutralShare = neutral.reduce((sum, i) => sum + share(values[i] as number), 0);
      let left = -neutralShare / 2;
      let right = neutralShare / 2;
      let middle = -neutralShare / 2;
      const push = (i: number, start: number, w: number) =>
        row.push({ seriesIndex: i, categoryIndex: c, value: values[i] as number, start, end: start + w, share: w });
      for (const i of neutral) {
        const w = share(values[i] as number);
        push(i, middle, w);
        middle += w;
      }
      // Innermost first: the grade next to the neutral middle sits at the axis, the extreme ones outside
      for (const i of negative) {
        const w = share(values[i] as number);
        push(i, left - w, w);
        left -= w;
      }
      for (const i of positive) {
        const w = share(values[i] as number);
        push(i, right, w);
        right += w;
      }
      row.sort((a, b) => a.seriesIndex - b.seriesIndex);
      lo = Math.min(lo, left);
      hi = Math.max(hi, right);
    } else {
      let up = 0;
      let down = 0;
      values.forEach((v, i) => {
        const size = mode === 'percent' ? (total > 0 ? v / total : 0) : v;
        if (size >= 0) {
          row.push({ seriesIndex: i, categoryIndex: c, value: v, start: up, end: up + size, share: share(v) });
          up += size;
        } else {
          row.push({ seriesIndex: i, categoryIndex: c, value: v, start: down + size, end: down, share: share(v) });
          down += size;
        }
      });
      lo = Math.min(lo, down);
      hi = Math.max(hi, up);
    }
    segments.push(row);
  }

  if (mode === 'percent') return { mode, segments, totals, domain: [Math.min(0, lo), Math.max(1, hi)] };
  if (mode === 'diverging') return { mode, segments, totals, domain: [Math.min(lo, -0.05), Math.max(hi, 0.05)] };
  return { mode, segments, totals, domain: niceDomain(lo, hi) };
}

/**
 * Splits series for a diverging (Likert) stack and orders each side innermost first: the series
 * closest, in the order given, to the neutral middle (or to the negative / positive boundary).
 * Works whether the grades run best → worst or worst → best.
 */
export function divergingGroups(
  series: readonly SeriesInput[],
  { negativeSeries = [], neutralSeries = [] }: Pick<SeriesLayoutOptions, 'negativeSeries' | 'neutralSeries'>
): { negative: number[]; neutral: number[]; positive: number[] } {
  const neg = new Set(negativeSeries);
  const neu = new Set(neutralSeries);
  const all = series.map((_, i) => i);
  const negative = all.filter((i) => neg.has((series[i] as SeriesInput).id));
  const neutral = all.filter((i) => neu.has((series[i] as SeriesInput).id));
  const positive = all.filter((i) => !neg.has((series[i] as SeriesInput).id) && !neu.has((series[i] as SeriesInput).id));
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  let pivot = 0;
  if (neutral.length) pivot = mean(neutral);
  else if (negative.length && positive.length) {
    pivot = Math.max(...negative) < Math.min(...positive) ? (Math.max(...negative) + Math.min(...positive)) / 2 : (Math.max(...positive) + Math.min(...negative)) / 2;
  }
  const byDistance = (a: number, b: number) => Math.abs(a - pivot) - Math.abs(b - pivot);
  return { negative: negative.sort(byDistance), neutral, positive: positive.sort(byDistance) };
}

/** A "nice" domain that always contains zero (bars start at zero: FT magnitude rule). */
export function niceDomain(lo: number, hi: number, ticks = 5): [number, number] {
  const a = Math.min(0, lo);
  const b = Math.max(0, hi);
  if (a === b) return [0, 1];
  const [x, y] = scaleLinear().domain([a, b]).nice(ticks).domain();
  return [x ?? a, y ?? b];
}

export interface FoldedSeries<T extends SeriesInput> {
  series: Array<T | SeriesInput>;
  /** Number of series folded into "Other". */
  folded: number;
}

/**
 * More than `max` nominal series do not read: the smallest (by total) fold into "Other", which
 * keeps every category's total intact. Ordinal series (condition grades) are never folded.
 */
export function foldSeries<T extends SeriesInput>(series: readonly T[], categoryCount: number, max = 6): FoldedSeries<T> {
  if (series.length <= max) return { series: [...series], folded: 0 };
  const sum = (s: SeriesInput) => s.values.reduce<number>((t, v) => t + (finite(v) ? Math.abs(v) : 0), 0);
  const ranked = [...series].sort((a, b) => sum(b) - sum(a));
  const keep = new Set(ranked.slice(0, max - 1));
  const rest = series.filter((s) => !keep.has(s));
  const other: SeriesInput = {
    id: '__other__',
    label: `Other (${rest.length})`,
    values: Array.from({ length: categoryCount }, (_, c) => rest.reduce((t, s) => t + (finite(s.values[c]) ? (s.values[c] as number) : 0), 0)),
  };
  return { series: [...series.filter((s) => keep.has(s)), other], folded: rest.length };
}
