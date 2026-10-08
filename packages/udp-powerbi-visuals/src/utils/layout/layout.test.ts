import { describe, expect, it } from 'vitest';
import { bulletRows, divergingRows, rankedRows, type BarDatum } from './bars';
import { donutLayout, MAX_DONUT_PARTS } from './donut';
import { formatSigned, scaleUnit } from './format';
import { ibcsRows, ibcsScales, pctMarker, type IbcsDatum } from './ibcs';
import { nearestIndex, trendDomain, validateTrendSeries, type TrendSeries } from './trend';

const bar = (label: string, value: number): BarDatum => ({ id: label, label, value });

describe('rankedRows (spotlight / ranking)', () => {
  const data = [bar('B', 300), bar('A', 300), bar('C', 100), bar('D', 300), bar('E', 0)];

  it('sorts high → low with a stable tie-break by label', () => {
    expect(rankedRows(data).rows.map((r) => r.datum.label)).toEqual(['A', 'B', 'D', 'C', 'E']);
  });

  it('computes shares over every category, before top N', () => {
    const { rows, total, hidden } = rankedRows(data, { topN: 2 });
    expect(total).toBe(1000);
    expect(hidden).toBe(3);
    expect(rows.map((r) => r.share)).toEqual([0.3, 0.3]);
  });

  it('a bottom-N list stays relative to the overall leader', () => {
    const { rows } = rankedRows(data, { order: 'asc', topN: 2 });
    expect(rows.map((r) => [r.datum.label, r.ratio])).toEqual([
      ['E', 0],
      ['C', 1 / 3],
    ]);
  });

  it('ignores non-finite values', () => {
    expect(rankedRows([bar('x', Number.NaN), bar('y', 5)]).rows).toHaveLength(1);
  });
});

describe('bulletRows', () => {
  it('shares one scale (max of actual / target × 1.08) and colours by business meaning', () => {
    const rows = bulletRows(
      [
        { id: 'a', label: 'a', actual: 92, target: 100 },
        { id: 'b', label: 'b', actual: 50, target: 40 },
      ],
      { goodWhen: 'below' }
    );
    expect(rows[0]?.targetRatio).toBeCloseTo(100 / 108);
    expect(rows[0]?.variance).toBeCloseTo(-0.08);
    expect(rows[0]?.favourable).toBe(true); // under target is good when lower is better
    expect(rows[1]?.favourable).toBe(false);
  });

  it('has no variance without a usable target', () => {
    const [row] = bulletRows([{ id: 'a', label: 'a', actual: 5, target: null }]);
    expect(row?.variance).toBeNull();
    expect(row?.favourable).toBeNull();
  });
});

describe('divergingRows', () => {
  const data = [-50, -40, -30, -20, -10, 5, 10, 20, 30, 40].map((v) => bar(`s${v}`, v));

  it('keeps the strongest ends of both sides when trimming', () => {
    const rows = divergingRows(data, 4);
    expect(rows.map((r) => r.datum.value)).toEqual([-50, -40, 30, 40]);
  });

  it('sorts most negative first and scales by the largest magnitude', () => {
    const rows = divergingRows(data, 20);
    expect(rows[0]?.datum.value).toBe(-50);
    expect(rows[0]?.ratio).toBe(1);
    expect(rows.at(-1)?.ratio).toBeCloseTo(0.8);
    expect(rows.at(-1)?.side).toBe('positive');
  });
});

describe('donutLayout', () => {
  it('orders parts largest first and closes the circle', () => {
    const layout = donutLayout([bar('small', 10), bar('big', 30)], 50);
    expect(layout.segments.map((s) => s.label)).toEqual(['big', 'small']);
    expect(layout.segments.map((s) => s.share)).toEqual([0.75, 0.25]);
    expect(layout.segments[1]?.offset).toBeCloseTo(-0.75 * layout.circumference);
  });

  it(`folds the tail into "Other" beyond ${MAX_DONUT_PARTS} parts`, () => {
    const layout = donutLayout(Array.from({ length: 9 }, (_, i) => bar(`c${i}`, 10 - i)), 50);
    expect(layout.segments).toHaveLength(MAX_DONUT_PARTS);
    expect(layout.collapsed).toBe(4);
    expect(layout.segments.at(-1)?.label).toBe('Other (4)');
  });

  it('excludes values a composition cannot show', () => {
    expect(donutLayout([bar('a', 5), bar('b', -2), bar('c', 0)], 50).excluded).toBe(2);
  });
});

describe('trend', () => {
  const series = (role: TrendSeries['role'], values: Array<number | null>): TrendSeries => ({ id: role, label: role, role, values });

  it('allows one primary and at most one comparison', () => {
    expect(validateTrendSeries([series('primary', [1])])).toEqual([]);
    expect(validateTrendSeries([series('comparison', [1])])).toHaveLength(1);
    expect(validateTrendSeries([series('primary', [1]), series('comparison', [1]), series('comparison', [2])])).toHaveLength(1);
  });

  it('includes zero when the area extends to the baseline', () => {
    expect(trendDomain([series('primary', [2100, 3105, null])])).toEqual([0, 3500]);
    const [lo] = trendDomain([series('primary', [2100, 3105])], { zero: false });
    expect(lo).toBeGreaterThan(0);
  });

  it('finds the nearest category to the pointer', () => {
    expect(nearestIndex([0, 100, 200], 130)).toBe(1);
    expect(nearestIndex([0, 100, 200], 180)).toBe(2);
  });
});

describe('IBCS variance', () => {
  const d = (id: string, actual: number | null, comparison: number | null): IbcsDatum => ({ id, label: id, actual, comparison });

  it('computes ΔAbs and Δ% like the Vega spec (negative comparisons included)', () => {
    const [a, b] = ibcsRows([d('a', 120, 100), d('b', -50, -100)], { sort: 'natural' });
    expect(a?.dabs).toBe(20);
    expect(a?.dpct).toBeCloseTo(0.2);
    expect(b?.dpct).toBeCloseTo(0.5); // -50 / |-100| - (-1)
  });

  it('colours by business meaning, not by sign', () => {
    const [cost] = ibcsRows([d('cost', 120, 100)], { goodWhen: 'lower' });
    expect(cost?.good).toBe(false);
  });

  it('has no Δ% when the comparison is missing or zero', () => {
    const rows = ibcsRows([d('x', 10, 0), d('y', 10, null)], { sort: 'natural' });
    expect(rows.map((r) => r.dpct)).toEqual([null, null]);
  });

  it('uses one unit for the whole chart and clamps Δ% to the cap', () => {
    const rows = ibcsRows([d('a', 128400, 125000), d('b', 300, 90)], { sort: 'natural' });
    const scales = ibcsScales(rows, 2);
    expect(scales.unit).toEqual({ divisor: 1e3, suffix: 'K' });
    expect(scales.pctDomain[1]).toBe(2);
    expect(pctMarker(rows[1]?.dpct ?? null, 2)).toEqual({ value: 2, shape: 'triangle-out', capped: true });
  });

  it('sorts structures by actual and keeps time in its natural order', () => {
    const data = [d('Jan', 1, 1), d('Feb', 3, 1), d('Mar', 2, 1)];
    expect(ibcsRows(data).map((r) => r.datum.id)).toEqual(['Feb', 'Mar', 'Jan']);
    expect(ibcsRows(data, { sort: 'natural' }).map((r) => r.datum.id)).toEqual(['Jan', 'Feb', 'Mar']);
  });
});

describe('format', () => {
  it('K only from 10,000 so small counts stay exact', () => {
    expect(scaleUnit(9999).suffix).toBe('');
    expect(scaleUnit(12_000).suffix).toBe('K');
    expect(scaleUnit(3e6).suffix).toBe('M');
    expect(scaleUnit(2e9).suffix).toBe('bn');
  });

  it('signs with a true minus', () => {
    expect(formatSigned(-5, String)).toBe('−5');
    expect(formatSigned(5, String)).toBe('+5');
    expect(formatSigned(0, String)).toBe('0');
  });
});
