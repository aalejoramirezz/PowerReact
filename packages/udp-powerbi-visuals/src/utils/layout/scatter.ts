import { scaleLinear } from 'd3-scale';
import type { Categorised } from '../data';
import type { TooltipItem } from '../events';
import { extent } from './scales';

/**
 * Scatter / bubble (FT "correlation"): one point per category, x and y from two measures, an
 * optional third as the bubble's area, an optional group as its colour.
 */

export interface ScatterPoint extends Categorised {
  id: string;
  label: string;
  x: number | null;
  y: number | null;
  /** Third measure: the bubble's area (sqrt scale), never its radius. */
  size?: number | null;
  /** Colour group (a nominal attribute, e.g. asset group). */
  group?: string;
  /** Extra measures for the tooltip. */
  tooltips?: TooltipItem[];
}

export const MIN_RADIUS = 4;
export const MAX_RADIUS = 22;

const plotted = (p: ScatterPoint): p is ScatterPoint & { x: number; y: number } =>
  typeof p.x === 'number' && Number.isFinite(p.x) && typeof p.y === 'number' && Number.isFinite(p.y);

/** Points with both coordinates, ordered by x then y (the keyboard order). */
export function plottable(points: readonly ScatterPoint[]): Array<ScatterPoint & { x: number; y: number }> {
  return points.filter(plotted).sort((a, b) => a.x - b.x || a.y - b.y);
}

/**
 * A nice axis domain around the values (and the reference line, so a quadrant is never off-plot);
 * `zero` forces the axis to include 0. A single value gets a ±1 (or ±10 %) window.
 */
export function axisDomain(values: ReadonlyArray<number | null | undefined>, { zero = false, include = [] as number[] } = {}): [number, number] {
  const range = extent([...values, ...include, ...(zero ? [0] : [])]);
  if (!range) return [0, 1];
  let [lo, hi] = range;
  if (lo === hi) {
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.1;
    lo -= pad;
    hi += pad;
  }
  const [a, b] = scaleLinear().domain([lo, hi]).nice(5).domain();
  return [a ?? lo, b ?? hi];
}

/** Bubble radius by area: r ∝ √size, between MIN_RADIUS and MAX_RADIUS (constant without sizes). */
export function radiusScale(points: readonly ScatterPoint[], max = MAX_RADIUS): (size: number | null | undefined) => number {
  const sizes = points.map((p) => p.size).filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
  if (!sizes.length) return () => 5;
  const top = Math.max(...sizes);
  return (size) => (typeof size === 'number' && size > 0 ? Math.max(MIN_RADIUS, Math.sqrt(size / top) * max) : MIN_RADIUS);
}

/** Index of the point nearest to (px, py) within `reach` pixels (null when none is close). */
export function nearestPoint(positions: ReadonlyArray<{ x: number; y: number; r: number }>, px: number, py: number, reach = 24): number | null {
  let best: number | null = null;
  let bestD = Infinity;
  positions.forEach((p, i) => {
    const d = Math.hypot(p.x - px, p.y - py) - p.r;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return bestD <= reach ? best : null;
}

/**
 * Which points get a direct label: the selected ones first, then the `top` largest (by size, else
 * y), skipping any whose label box would overlap one already placed.
 */
export function labelledPoints(
  positions: ReadonlyArray<{ x: number; y: number; r: number; label: string; rank: number; selected: boolean }>,
  top: number,
  charWidth = 6.2
): Set<number> {
  const order = positions.map((_, i) => i).sort((a, b) => Number(positions[b]?.selected) - Number(positions[a]?.selected) || (positions[a]?.rank ?? 0) - (positions[b]?.rank ?? 0));
  const boxes: Array<[number, number, number, number]> = [];
  const out = new Set<number>();
  for (const i of order) {
    const p = positions[i];
    if (!p || (!p.selected && p.rank >= top)) continue;
    const box: [number, number, number, number] = [p.x + p.r + 4, p.y - 7, p.x + p.r + 4 + p.label.length * charWidth, p.y + 7];
    if (boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
    boxes.push(box);
    out.add(i);
  }
  return out;
}
