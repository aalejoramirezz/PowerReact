/** Donut composition layout (principle 17: a real total split into 2–6 parts). */

export interface DonutDatum {
  id: string;
  label: string;
  value: number;
}

export interface DonutSegment {
  id: string;
  label: string;
  value: number;
  share: number;
  /** Stroke-dash geometry on a circle of circumference `circumference`. */
  length: number;
  offset: number;
  /** Colour slot 1..6 (theme --u-series-n). */
  slot: number;
}

export interface DonutLayout {
  segments: DonutSegment[];
  total: number;
  circumference: number;
  /** Categories folded into "Other" because a donut must not exceed `maxParts`. */
  collapsed: number;
  /** Zero / negative / invalid values a composition cannot show. */
  excluded: number;
}

export const MAX_DONUT_PARTS = 6;
const GAP = 4;

/**
 * Sorted largest first (the largest part takes the strongest colour). Beyond `maxParts` the tail is
 * folded into "Other": a donut with more parts is a ranking (use SpotlightBars instead).
 */
export function donutLayout(data: readonly DonutDatum[], radius: number, maxParts = MAX_DONUT_PARTS): DonutLayout {
  const positive = data.filter((d) => Number.isFinite(d.value) && d.value > 0);
  const sorted = [...positive].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const total = sorted.reduce((sum, d) => sum + d.value, 0);

  let parts: DonutDatum[] = sorted;
  let collapsed = 0;
  if (sorted.length > maxParts) {
    const head = sorted.slice(0, maxParts - 1);
    const tail = sorted.slice(maxParts - 1);
    collapsed = tail.length;
    parts = [...head, { id: '__other__', label: `Other (${tail.length})`, value: tail.reduce((s, d) => s + d.value, 0) }];
  }

  const circumference = 2 * Math.PI * radius;
  const gap = parts.length > 1 ? GAP : 0;
  let cursor = 0;
  const segments = parts.map((d, i) => {
    const share = total > 0 ? d.value / total : 0;
    const full = share * circumference;
    const segment: DonutSegment = {
      id: d.id,
      label: d.label,
      value: d.value,
      share,
      length: Math.max(0, full - gap),
      offset: -cursor,
      slot: Math.min(i, MAX_DONUT_PARTS - 1) + 1,
    };
    cursor += full;
    return segment;
  });

  return { segments, total, circumference, collapsed, excluded: data.length - positive.length };
}
