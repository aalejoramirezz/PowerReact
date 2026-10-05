/** Pure layout for the bar family (spotlight / ranking, bullet, diverging). Ported from Lens. */

export interface BarDatum {
  id: string;
  label: string;
  value: number;
}

export interface RankedRow<T extends BarDatum> {
  datum: T;
  /** 1-based position after sorting. */
  rank: number;
  /** value / total of ALL data received (before top N): never depends on how the rows were cut. */
  share: number;
  /** Bar length 0..1, relative to the overall leader so a bottom-N list never looks "full". */
  ratio: number;
}

export interface RankedLayout<T extends BarDatum> {
  rows: RankedRow<T>[];
  total: number;
  /** Rows dropped by topN. */
  hidden: number;
}

const byValue = (order: 'desc' | 'asc') => (a: BarDatum, b: BarDatum) =>
  (order === 'desc' ? b.value - a.value : a.value - b.value) || a.label.localeCompare(b.label);

/** Spotlight / ranking rows: sorted (stable tie-break by label), shares over every category. */
export function rankedRows<T extends BarDatum>(
  data: readonly T[],
  { topN = 0, order = 'desc' }: { topN?: number; order?: 'desc' | 'asc' } = {}
): RankedLayout<T> {
  const valid = data.filter((d) => Number.isFinite(d.value));
  const total = valid.reduce((sum, d) => sum + d.value, 0);
  const leader = valid.reduce((max, d) => Math.max(max, d.value), 0);
  const sorted = [...valid].sort(byValue(order));
  const shown = topN > 0 ? sorted.slice(0, topN) : sorted;

  return {
    rows: shown.map((datum, i) => ({
      datum,
      rank: i + 1,
      share: total > 0 ? datum.value / total : 0,
      ratio: leader > 0 ? Math.max(0, datum.value) / leader : 0,
    })),
    total,
    hidden: sorted.length - shown.length,
  };
}

export interface BulletDatum {
  id: string;
  label: string;
  actual: number;
  target: number | null;
}

export interface BulletRow<T extends BulletDatum> {
  datum: T;
  actualRatio: number;
  targetRatio: number | null;
  /** (actual − target) / target; null without a usable target. */
  variance: number | null;
  /** Colour follows the business meaning of the gap, not its sign. */
  favourable: boolean | null;
}

/** Actual vs target per category. Shared scale: the largest of actual/target × 1.08 (room for the tick). */
export function bulletRows<T extends BulletDatum>(
  data: readonly T[],
  { goodWhen = 'above', topN = 0 }: { goodWhen?: 'above' | 'below'; topN?: number } = {}
): BulletRow<T>[] {
  const valid = data.filter((d) => Number.isFinite(d.actual));
  const sorted = [...valid].sort((a, b) => b.actual - a.actual || a.label.localeCompare(b.label));
  const shown = topN > 0 ? sorted.slice(0, topN) : sorted;
  const scale = shown.reduce((max, d) => Math.max(max, d.actual, d.target ?? 0), 0) * 1.08 || 1;

  return shown.map((datum) => {
    const hasTarget = datum.target !== null && Number.isFinite(datum.target) && datum.target !== 0;
    return {
      datum,
      actualRatio: Math.max(0, datum.actual) / scale,
      targetRatio: datum.target !== null && Number.isFinite(datum.target) ? Math.max(0, datum.target) / scale : null,
      variance: hasTarget ? (datum.actual - (datum.target as number)) / (datum.target as number) : null,
      favourable: hasTarget
        ? goodWhen === 'above'
          ? datum.actual >= (datum.target as number)
          : datum.actual <= (datum.target as number)
        : null,
    };
  });
}

export interface DivergingRow<T extends BarDatum> {
  datum: T;
  /** |value| / largest |value| of ALL data. */
  ratio: number;
  side: 'negative' | 'positive' | 'zero';
}

/**
 * Signed values around a centre axis, most negative first. With more members than `maxRows`,
 * the strongest ends are kept (half from each side) so both ends of the imbalance stay visible.
 */
export function divergingRows<T extends BarDatum>(data: readonly T[], maxRows = 16): DivergingRow<T>[] {
  const valid = data.filter((d) => Number.isFinite(d.value));
  const maxAbs = valid.reduce((max, d) => Math.max(max, Math.abs(d.value)), 0);
  const asc = [...valid].sort((a, b) => a.value - b.value || a.label.localeCompare(b.label));

  let kept = asc;
  if (asc.length > maxRows) {
    const half = Math.max(1, Math.floor(maxRows / 2));
    const low = new Set(asc.slice(0, half));
    const high = new Set(asc.slice(asc.length - (maxRows - half)));
    kept = asc.filter((d) => low.has(d) || high.has(d));
  }

  return kept.map((datum) => ({
    datum,
    ratio: maxAbs > 0 ? Math.abs(datum.value) / maxAbs : 0,
    side: datum.value < 0 ? 'negative' : datum.value > 0 ? 'positive' : 'zero',
  }));
}
