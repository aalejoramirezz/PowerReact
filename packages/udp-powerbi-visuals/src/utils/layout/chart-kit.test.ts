import { describe, expect, it } from 'vitest';
import { divergingSteps, rampSteps, seriesColour } from '../palette';
import { nextIndex } from '../roving';
import { clipLabel, divergingStep, extent, labelStep, sequentialStep } from './scales';
import { divergingGroups, foldSeries, niceDomain, seriesLayout, type SeriesInput } from './series';

const s = (id: string, values: Array<number | null>): SeriesInput => ({ id, label: id, values });

describe('seriesLayout', () => {
  const series = [s('a', [30, 10]), s('b', [10, -20]), s('c', [60, 30])];

  it('stacks positives up and negatives down from zero', () => {
    const { segments, totals, domain } = seriesLayout(2, series, { mode: 'stacked' });
    expect(segments[0]?.map((g) => [g.start, g.end])).toEqual([
      [0, 30],
      [30, 40],
      [40, 100],
    ]);
    expect(segments[1]?.find((g) => g.seriesIndex === 1)).toMatchObject({ start: -20, end: 0 });
    expect(totals).toEqual([100, 60]);
    expect(domain[0]).toBeLessThanOrEqual(-20);
    expect(domain[1]).toBeGreaterThanOrEqual(100);
  });

  it('percent makes every category 100 % and keeps shares', () => {
    const { segments, domain } = seriesLayout(1, [s('a', [1]), s('b', [3])], { mode: 'percent' });
    expect(segments[0]?.map((g) => [g.start, g.end, g.share])).toEqual([
      [0, 0.25, 0.25],
      [0.25, 1, 0.75],
    ]);
    expect(domain).toEqual([0, 1]);
  });

  it('grouped bars start at zero and the domain is nice and contains zero', () => {
    const { segments, domain } = seriesLayout(1, [s('a', [12]), s('b', [7])], { mode: 'grouped' });
    expect(segments[0]?.map((g) => [g.start, g.end])).toEqual([
      [0, 12],
      [0, 7],
    ]);
    expect(domain).toEqual([0, 12]);
    expect(niceDomain(3, 97)).toEqual([0, 100]);
    expect(niceDomain(0, 0)).toEqual([0, 1]);
  });

  it('diverging (Likert) puts the grade next to the neutral middle innermost, in either order', () => {
    const best = [s('Excellent', [10]), s('Good', [20]), s('Fair', [20]), s('Poor', [30]), s('Very poor', [20])];
    const opts = { mode: 'diverging' as const, negativeSeries: ['Poor', 'Very poor'], neutralSeries: ['Fair'] };
    const [row] = seriesLayout(1, best, opts).segments;
    const at = (id: string) => row?.find((g) => best[g.seriesIndex]?.id === id);
    expect(at('Fair')).toMatchObject({ start: -0.1, end: 0.1 });
    expect(at('Good')).toMatchObject({ start: 0.1 }); // innermost on the right
    expect(at('Excellent')?.start).toBeCloseTo(0.3);
    expect(at('Poor')?.end).toBeCloseTo(-0.1); // innermost on the left
    expect(at('Very poor')?.start).toBeCloseTo(-0.6);
    // Same answer when the grades come worst → best
    const worst = [...best].reverse();
    expect(divergingGroups(worst, opts)).toEqual({ negative: [1, 0], neutral: [2], positive: [3, 4] });
  });

  it('folds the smallest nominal series into Other, keeping totals', () => {
    const many = Array.from({ length: 8 }, (_, i) => s(`s${i}`, [i + 1, 1]));
    const { series: folded, folded: count } = foldSeries(many, 2, 6);
    expect(count).toBe(3);
    expect(folded).toHaveLength(6);
    expect(folded.at(-1)).toMatchObject({ id: '__other__', label: 'Other (3)', values: [1 + 2 + 3, 3] });
  });
});

describe('palette', () => {
  it('spreads ramp picks evenly and keeps both ends', () => {
    expect(rampSteps(3)).toEqual([1, 4, 7]);
    expect(rampSteps(1)).toEqual([7]);
    expect(divergingSteps(4)).toEqual([1, 2, 6, 7]);
    expect(divergingSteps(5)).toEqual([1, 2, 4, 6, 7]);
    expect(divergingSteps(7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(divergingSteps(3)).toEqual([1, 4, 7]);
    expect(divergingSteps(2)).toEqual([1, 7]);
  });

  it('returns token references, never colours', () => {
    expect(seriesColour(0, 3, 'categorical')).toEqual({ fill: 'var(--pbi-series-1)', text: 'var(--pbi-title)' });
    expect(seriesColour(6, 8, 'categorical').fill).toBe('var(--pbi-series-1)');
    expect(seriesColour(2, 3, 'sequential')).toEqual({ fill: 'var(--pbi-seq-7)', text: 'var(--pbi-seq-text-7)' });
    expect(seriesColour(0, 5, 'diverging').fill).toBe('var(--pbi-div-1)');
  });
});

describe('scales', () => {
  it('thins category labels to keep them apart', () => {
    expect(labelStep(12, 600)).toBe(1);
    expect(labelStep(20, 400)).toBe(3);
    expect(clipLabel('Stormwater_Pipes', 8)).toBe('Stormwa…');
  });

  it('quantises values into 7 sequential steps, blanks to 0', () => {
    expect(sequentialStep(0, [0, 70])).toBe(1);
    expect(sequentialStep(35, [0, 70])).toBe(4);
    expect(sequentialStep(70, [0, 70])).toBe(7);
    expect(sequentialStep(null, [0, 70])).toBe(0);
    expect(sequentialStep(5, [5, 5])).toBe(7);
  });

  it('diverging steps follow business meaning around the reference', () => {
    expect(divergingStep(0.9, { center: 0.9, maxDistance: 0.1 })).toBe(4);
    expect(divergingStep(1, { center: 0.9, maxDistance: 0.1 })).toBe(7);
    expect(divergingStep(1, { center: 0.9, maxDistance: 0.1, goodWhen: 'lower' })).toBe(1);
    expect(divergingStep(null, { maxDistance: 1 })).toBe(0);
  });

  it('finds the extent of finite values', () => {
    expect(extent([3, null, -1, Number.NaN, 7])).toEqual([-1, 7]);
    expect(extent([null])).toBeNull();
  });
});

describe('roving keyboard model', () => {
  it('moves through a list and wraps to the ends with Home / End', () => {
    expect(nextIndex('ArrowRight', null, 5)).toBe(0);
    expect(nextIndex('ArrowLeft', null, 5)).toBe(4);
    expect(nextIndex('ArrowRight', 4, 5)).toBe(4);
    expect(nextIndex('ArrowDown', 1, 5)).toBe(2);
    expect(nextIndex('End', 1, 5)).toBe(4);
    expect(nextIndex('Enter', 1, 5)).toBeUndefined();
  });

  it('moves by row and column in a grid without wrapping rows', () => {
    // 3 columns × 3 rows
    expect(nextIndex('ArrowDown', 1, 9, 3)).toBe(4);
    expect(nextIndex('ArrowUp', 1, 9, 3)).toBe(1);
    expect(nextIndex('ArrowRight', 2, 9, 3)).toBe(2);
    expect(nextIndex('ArrowLeft', 3, 9, 3)).toBe(3);
    expect(nextIndex('ArrowDown', 7, 8, 3)).toBe(7);
  });
});
