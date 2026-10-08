import { scaleLinear } from 'd3-scale';
import { area, curveMonotoneX, line } from 'd3-shape';

/**
 * Layout math of the KPI variants (trend sparkline, bullet against target, IBCS variance).
 * Pure functions: no DOM, no colours.
 */

/** One period of a KPI's recent history. */
export interface KpiPoint {
  label: string;
  value: number | null;
}

export interface SparkPoint {
  i: number;
  x: number;
  y: number;
  value: number;
  label: string;
}

export interface Sparkline {
  line: string;
  area: string;
  points: SparkPoint[];
  /** Indices (into `points`) of the lowest, the highest and the latest value. */
  min: number | null;
  max: number | null;
  last: number | null;
  /** The target's y, when a target is set. */
  targetY: number | null;
  domain: [number, number];
}

/**
 * A sparkline in a `width × height` box. The value axis spans the data and the target (the target
 * must stay visible) with a little headroom; blanks break the line instead of dropping to zero.
 */
export function sparkline(series: readonly KpiPoint[], width: number, height: number, { target, pad = 4 }: { target?: number | null; pad?: number } = {}): Sparkline {
  const values = series.map((p) => p.value).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const withTarget = typeof target === 'number' && Number.isFinite(target) ? [...values, target] : values;
  let lo = withTarget.length ? Math.min(...withTarget) : 0;
  let hi = withTarget.length ? Math.max(...withTarget) : 1;
  if (hi === lo) {
    lo -= Math.abs(lo) * 0.1 || 1;
    hi += Math.abs(hi) * 0.1 || 1;
  }
  const head = (hi - lo) * 0.08;
  const domain: [number, number] = [lo - head, hi + head];
  const x = scaleLinear()
    .domain([0, Math.max(1, series.length - 1)])
    .range([pad, Math.max(pad + 1, width - pad)]);
  const y = scaleLinear()
    .domain(domain)
    .range([Math.max(pad + 1, height - pad), pad]);
  const points: SparkPoint[] = [];
  series.forEach((p, i) => {
    if (typeof p.value === 'number' && Number.isFinite(p.value)) points.push({ i, x: x(i), y: y(p.value), value: p.value, label: p.label });
  });
  const defined = (p: KpiPoint) => typeof p.value === 'number' && Number.isFinite(p.value);
  const lineGen = line<KpiPoint>()
    .defined(defined)
    .x((_, i) => x(i))
    .y((p) => y(p.value as number))
    .curve(curveMonotoneX);
  const areaGen = area<KpiPoint>()
    .defined(defined)
    .x((_, i) => x(i))
    .y0(y(domain[0]))
    .y1((p) => y(p.value as number))
    .curve(curveMonotoneX);
  let min: number | null = null;
  let max: number | null = null;
  points.forEach((p, k) => {
    if (min === null || p.value < (points[min] as SparkPoint).value) min = k;
    if (max === null || p.value > (points[max] as SparkPoint).value) max = k;
  });
  return {
    line: lineGen([...series]) ?? '',
    area: areaGen([...series]) ?? '',
    points,
    min,
    max,
    last: points.length ? points.length - 1 : null,
    targetY: typeof target === 'number' && Number.isFinite(target) ? y(target) : null,
    domain,
  };
}

export type BandQuality = 'poor' | 'fair' | 'good';
export type KpiStatus = 'ok' | 'warn' | 'bad';

export interface BulletBand {
  from: number;
  to: number;
  quality: BandQuality;
}

export interface BulletModel {
  /** Scale end (0..max), a nice number above every value drawn. */
  max: number;
  ticks: number[];
  bands: BulletBand[];
  /** Status of the value: its band's quality (never better than "warn" while the target is missed), or against the target alone. */
  status: KpiStatus | null;
  /** value − target (null without both). */
  gap: number | null;
}

const QUALITY_STATUS: Record<BandQuality, KpiStatus> = { poor: 'bad', fair: 'warn', good: 'ok' };

/**
 * Bullet graph (Stephen Few) for one measure: qualitative bands from `thresholds` (ascending; two
 * thresholds give poor / fair / good when higher is better, the reverse when lower is better), the
 * value bar, the target tick and an optional forecast marker, on a scale from zero.
 */
export function bulletModel({
  value,
  target,
  thresholds = [],
  max,
  forecast,
  goodWhen = 'higher',
  ratio = false,
}: {
  value: number | null | undefined;
  target?: number | null;
  thresholds?: readonly number[];
  max?: number | null;
  forecast?: number | null;
  goodWhen?: 'higher' | 'lower';
  /** The values are shares (0..1): the scale ends at 100 % when nothing exceeds it. */
  ratio?: boolean;
}): BulletModel {
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const cuts = [...thresholds].filter(finite).sort((a, b) => a - b);
  const largest = Math.max(1e-9, ...[value, target, forecast, ...cuts].filter(finite).map((v) => Math.abs(v)));
  const top = finite(max) && max > 0 ? max : ratio && largest <= 1 ? 1 : largest * 1.1;
  const scale = scaleLinear().domain([0, top]);
  if (!finite(max) && !(ratio && largest <= 1)) scale.nice(3);
  const end = scale.domain()[1] as number;
  const edges = [0, ...cuts.filter((c) => c > 0 && c < end), end];
  const order: BandQuality[] = edges.length - 1 >= 3 ? ['poor', 'fair', 'good'] : edges.length - 1 === 2 ? ['poor', 'good'] : ['good'];
  const qualities = goodWhen === 'higher' ? order : [...order].reverse();
  const bands = edges.slice(1).map((to, i) => ({ from: edges[i] as number, to, quality: qualities[Math.min(i, qualities.length - 1)] as BandQuality }));
  let status: KpiStatus | null = null;
  if (finite(value)) {
    const meets = finite(target) ? (goodWhen === 'higher' ? value >= target : value <= target) : null;
    if (cuts.length) {
      // Reaching a threshold counts as the better band, whichever direction is good
      const band = bands.find((b) => (goodWhen === 'higher' ? value < b.to : value <= b.to)) ?? bands[bands.length - 1];
      status = band ? QUALITY_STATUS[band.quality] : null;
      // A good band below the target is not "on target" yet
      if (status === 'ok' && meets === false) status = 'warn';
    } else if (meets !== null) {
      status = meets ? 'ok' : 'bad';
    }
  }
  return { max: end, ticks: scale.ticks(2), bands, status, gap: finite(value) && finite(target) ? value - target : null };
}

export interface KpiVariance {
  delta: number | null;
  /** Relative variance (fraction of |comparison|); null when the comparison is zero or missing. */
  deltaPct: number | null;
  favourable: boolean | null;
  /** Common scale end of the AC and comparison bars. */
  barMax: number;
}

/** Absolute and relative variance of actual vs a comparison scenario, judged by `goodWhen`. */
export function kpiVariance(actual: number | null | undefined, comparison: number | null | undefined, goodWhen: 'higher' | 'lower' = 'higher'): KpiVariance {
  const a = typeof actual === 'number' && Number.isFinite(actual) ? actual : null;
  const c = typeof comparison === 'number' && Number.isFinite(comparison) ? comparison : null;
  const delta = a !== null && c !== null ? a - c : null;
  const deltaPct = delta !== null && c !== null && c !== 0 ? delta / Math.abs(c) : null;
  const favourable = delta === null ? null : goodWhen === 'higher' ? delta >= 0 : delta <= 0;
  return { delta, deltaPct, favourable, barMax: Math.max(Math.abs(a ?? 0), Math.abs(c ?? 0)) || 1 };
}
