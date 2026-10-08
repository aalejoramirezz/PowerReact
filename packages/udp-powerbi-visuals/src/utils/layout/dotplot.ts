import type { Categorised } from '../data';
import type { TooltipItem } from '../events';
import { extent } from './scales';

/**
 * Dot plot (FT "ranking" / "change"): two values per category — before and after, plan and actual,
 * min and max — as a dumbbell on one axis, or as a slope between two vertical axes. The connector
 * is coloured by business meaning (`goodWhen`), and a dot plot needs no zero baseline.
 */

export interface DotPlotItem extends Categorised {
  id: string;
  label: string;
  /** The first value (e.g. PY, plan, 7 days ago). */
  from: number | null;
  /** The second value (e.g. AC, actual, now). */
  to: number | null;
  tooltips?: TooltipItem[];
}

export type DotPlotSort = 'none' | 'to' | 'change';

/** Rows in display order: as received, by the second value (desc) or by the change (largest first). */
export function dotPlotRows(items: readonly DotPlotItem[], sort: DotPlotSort = 'none'): DotPlotItem[] {
  const rows = [...items];
  const change = (d: DotPlotItem) => Math.abs((d.to ?? 0) - (d.from ?? 0));
  if (sort === 'to') rows.sort((a, b) => (b.to ?? -Infinity) - (a.to ?? -Infinity));
  if (sort === 'change') rows.sort((a, b) => change(b) - change(a));
  return rows;
}

/** Whether the move from → to is favourable (null without both values or without a move). */
export function moveGood(d: DotPlotItem, goodWhen: 'higher' | 'lower'): boolean | null {
  if (d.from === null || d.to === null || d.from === d.to) return null;
  return goodWhen === 'higher' ? d.to > d.from : d.to < d.from;
}

/** A value domain around every value with 6 % room each side (no forced zero, but never below zero for values that cannot be negative). */
export function dotDomain(items: readonly DotPlotItem[]): [number, number] {
  const range = extent(items.flatMap((d) => [d.from, d.to]));
  if (!range) return [0, 1];
  const [lo, hi] = range;
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.06;
  return [lo >= 0 ? Math.max(0, lo - pad) : lo - pad, hi + pad];
}

/**
 * Vertical label positions for a slope chart: each label at its value, nudged apart so none overlap
 * (`gap` px), keeping the input order of values.
 */
export function spreadLabels(ys: readonly number[], gap: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const out = new Array<number>(ys.length);
  let prev = -Infinity;
  for (const { y, i } of order) {
    const placed = Math.max(y, prev + gap);
    out[i] = placed;
    prev = placed;
  }
  return out;
}
