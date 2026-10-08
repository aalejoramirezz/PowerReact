import { scaleLinear } from 'd3-scale';
import type { Categorised } from '../data';
import type { TooltipItem } from '../events';
import { niceDomain } from './series';

/**
 * Waterfall (IBCS bridge, FT "flow"): a starting level, the movements that change it and the levels
 * they reach. Levels (start, subtotal, end) are solid bars from zero in the actual colour; movements
 * float from the running level and are coloured by business meaning (`goodWhen`), never by sign.
 */

export type WaterfallKind = 'start' | 'delta' | 'subtotal' | 'end';

export interface WaterfallStep extends Categorised {
  id: string;
  label: string;
  /** A movement (delta) or a level (start, subtotal, end). */
  value: number | null;
  /** Default: the first step starts, the last ends, the rest are movements. */
  kind?: WaterfallKind;
  tooltips?: TooltipItem[];
}

export interface WaterfallBar {
  step: WaterfallStep;
  kind: WaterfallKind;
  /** Extent on the value axis. */
  from: number;
  to: number;
  /** The level after this step (where the connector to the next step sits). */
  level: number;
  /** Movements only: favourable by `goodWhen`; null for levels. */
  good: boolean | null;
}

const num = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function stepKind(step: WaterfallStep, index: number, count: number): WaterfallKind {
  if (step.kind) return step.kind;
  if (count > 1 && index === 0) return 'start';
  if (count > 1 && index === count - 1) return 'end';
  return 'delta';
}

/**
 * Bars and domain. A subtotal or end with a value takes it (the engine's figure); without one it
 * closes the running level. With `baseline: 'zero'` the domain contains zero (bars start at zero);
 * with `'auto'` it starts just below the lowest level when every level is positive, so small movements
 * against large levels stay visible — the level bars are then drawn broken (`broken`, IBCS scaling).
 */
export function waterfallLayout(
  steps: readonly WaterfallStep[],
  { goodWhen = 'higher', baseline = 'zero' }: { goodWhen?: 'higher' | 'lower'; baseline?: 'zero' | 'auto' } = {}
): { bars: WaterfallBar[]; domain: [number, number]; broken: boolean } {
  let level = 0;
  let lo = 0;
  let hi = 0;
  const bars = steps.map((step, i) => {
    const kind = stepKind(step, i, steps.length);
    let from: number;
    let to: number;
    let good: boolean | null = null;
    if (kind === 'delta') {
      const v = num(step.value);
      from = level;
      to = level + v;
      level = to;
      good = goodWhen === 'higher' ? v >= 0 : v <= 0;
    } else {
      const v = kind === 'start' || step.value !== null ? num(step.value) : level;
      from = 0;
      to = v;
      level = v;
    }
    lo = Math.min(lo, from, to);
    hi = Math.max(hi, from, to);
    return { step, kind, from, to, level, good };
  });
  if (baseline === 'auto' && bars.length) {
    // Every level and every movement end, but not the zero the levels stand on
    const ends = bars.flatMap((b) => (b.kind === 'delta' ? [b.from, b.to] : [b.to]));
    const min = Math.min(...ends);
    const max = Math.max(...ends);
    if (min > 0) {
      const pad = (max - min || max) * 0.25;
      const [a, b] = scaleLinear().domain([Math.max(0, min - pad), max + pad * 0.4]).nice(4).domain();
      const domain: [number, number] = [a ?? 0, b ?? max];
      return { bars, domain, broken: domain[0] > 0 };
    }
  }
  return { bars, domain: niceDomain(lo, hi), broken: false };
}
