import { scaleLinear } from 'd3-scale';

/** Trend (line / area) rules: one primary series, at most one comparison (principle 14). */

export interface TrendSeries {
  id: string;
  label: string;
  role: 'primary' | 'comparison';
  /** One value per category of `categories` (null = gap). */
  values: Array<number | null>;
}

export function validateTrendSeries(series: readonly TrendSeries[]): string[] {
  const problems: string[] = [];
  const primary = series.filter((s) => s.role === 'primary').length;
  const comparison = series.filter((s) => s.role === 'comparison').length;
  if (primary !== 1) problems.push(`a trend needs exactly one primary series (got ${primary})`);
  if (comparison > 1) problems.push(`a trend shows at most one comparison series (got ${comparison})`);
  return problems;
}

/**
 * Nice value domain. With an area the domain starts at zero: the area is the visual extension of
 * the line down to the baseline and would lie about magnitude otherwise (principle 15).
 */
export function trendDomain(series: readonly TrendSeries[], { zero = true }: { zero?: boolean } = {}): [number, number] {
  const values = series.flatMap((s) => s.values).filter((v): v is number => v !== null && Number.isFinite(v));
  if (values.length === 0) return [0, 1];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (zero) {
    lo = Math.min(0, lo);
    hi = Math.max(0, hi);
  }
  if (lo === hi) {
    hi = lo + 1;
  }
  const [a, b] = scaleLinear().domain([lo, hi]).nice(5).domain();
  return [a ?? lo, b ?? hi];
}

/** Index of the category closest to an x position (pointer / keyboard crosshair). */
export function nearestIndex(positions: readonly number[], x: number): number {
  let best = 0;
  for (let i = 1; i < positions.length; i++) {
    if (Math.abs((positions[i] ?? 0) - x) < Math.abs((positions[best] ?? 0) - x)) best = i;
  }
  return best;
}
