import { RAMP_STEPS } from '../palette';

/**
 * Small scale helpers shared by the charts: which category labels fit, and which ramp step a value
 * takes in a heatmap or treemap.
 */

/** Show every n-th category label so labels are at least `minPx` apart (first and last always fit). */
export function labelStep(count: number, available: number, minPx = 44): number {
  if (count <= 1 || available <= 0) return 1;
  return Math.max(1, Math.ceil((count * minPx) / available));
}

/** Text clipped to `max` characters with an ellipsis (SVG text does not wrap). */
export function clipLabel(text: string, max: number): string {
  if (max <= 1) return '…';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Sequential step 1..7 of a value within [min, max] (equal-width classes). Null or non-finite → 0,
 * which callers draw as "no data" (track colour), never as the lowest class.
 */
export function sequentialStep(value: number | null | undefined, [min, max]: readonly [number, number], steps = RAMP_STEPS): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  if (max <= min) return steps;
  const t = (value - min) / (max - min);
  return Math.min(steps, Math.max(1, Math.floor(t * steps) + 1));
}

/**
 * Diverging step around a reference (target, zero, average): 4 at the reference, 1..3 on the
 * unfavourable side, 5..7 on the favourable side, scaled by the largest distance. `goodWhen`
 * decides which side is favourable — colour follows business meaning, never the sign alone.
 */
export function divergingStep(
  value: number | null | undefined,
  { center = 0, maxDistance, goodWhen = 'higher' }: { center?: number; maxDistance: number; goodWhen?: 'higher' | 'lower' }
): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  if (maxDistance <= 0) return 4;
  const signed = (goodWhen === 'higher' ? value - center : center - value) / maxDistance;
  const k = Math.round(Math.max(-1, Math.min(1, signed)) * 3);
  return 4 + k;
}

/** [min, max] of the finite values (null when there are none). */
export function extent(values: Iterable<number | null | undefined>): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return lo <= hi ? [lo, hi] : null;
}
