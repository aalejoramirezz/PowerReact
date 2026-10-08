import { quantileSorted } from 'd3-array';
import type { Categorised } from '../data';
import type { TooltipItem } from '../events';

/**
 * Box plot (FT "distribution"): per category, the median, the quartiles and the whiskers (Tukey:
 * the most extreme values within 1.5 × IQR), with the values beyond drawn as outliers. Summary
 * statistics usually come from the engine (PERCENTILEX.INC); raw values (≤ 5,000) are summarised here.
 */

export interface BoxStats {
  min: number | null;
  q1: number | null;
  median: number | null;
  q3: number | null;
  max: number | null;
  mean?: number | null;
  outliers?: number[];
  /** Number of observations. */
  count?: number | null;
}

export interface BoxPlotItem extends Categorised, Partial<BoxStats> {
  id: string;
  label: string;
  /** Raw observations: summarised with Tukey whiskers when the statistics are not given. */
  values?: number[];
  tooltips?: TooltipItem[];
}

export const MAX_RAW_VALUES = 5000;

/** Tukey summary of raw values (null statistics when there are none). */
export function boxStats(values: readonly number[]): BoxStats {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return { min: null, q1: null, median: null, q3: null, max: null, mean: null, outliers: [], count: 0 };
  const q1 = quantileSorted(sorted, 0.25) as number;
  const median = quantileSorted(sorted, 0.5) as number;
  const q3 = quantileSorted(sorted, 0.75) as number;
  const lowFence = q1 - 1.5 * (q3 - q1);
  const highFence = q3 + 1.5 * (q3 - q1);
  const inside = sorted.filter((v) => v >= lowFence && v <= highFence);
  return {
    min: inside[0] ?? q1,
    q1,
    median,
    q3,
    max: inside[inside.length - 1] ?? q3,
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    outliers: sorted.filter((v) => v < lowFence || v > highFence),
    count: sorted.length,
  };
}

/** An item's statistics: given ones win; raw values fill in the rest. */
export function itemStats(item: BoxPlotItem): BoxStats {
  const given = item.median !== undefined && item.median !== null;
  if (given || !item.values?.length) {
    return { min: item.min ?? null, q1: item.q1 ?? null, median: item.median ?? null, q3: item.q3 ?? null, max: item.max ?? null, mean: item.mean ?? null, outliers: item.outliers ?? [], count: item.count ?? null };
  }
  return boxStats(item.values.slice(0, MAX_RAW_VALUES));
}
