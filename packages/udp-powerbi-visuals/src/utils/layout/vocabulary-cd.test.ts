import { describe, expect, it } from 'vitest';
import { boxStats, itemStats } from './boxplot';
import { calendarLayout, isoDay, parseDay } from './calendar';
import { dotDomain, dotPlotRows, moveGood, spreadLabels } from './dotplot';
import { timelineLayout } from './timeline';
import { treemapLayout } from './treemap';
import { stepKind, waterfallLayout } from './waterfall';

describe('waterfall', () => {
  // Backlog bridge: open 7 days ago, raised, closed, open now
  const steps = [
    { id: 'open7', label: 'Open 7 days ago', value: 196 },
    { id: 'raised', label: 'Raised', value: 5 },
    { id: 'closed', label: 'Closed', value: -4 },
    { id: 'open', label: 'Open now', value: 197 },
  ];

  it('levels stand on zero, movements float from the running level', () => {
    const { bars, domain } = waterfallLayout(steps, { goodWhen: 'lower' });
    expect(bars.map((b) => [b.kind, b.from, b.to])).toEqual([
      ['start', 0, 196],
      ['delta', 196, 201],
      ['delta', 201, 197],
      ['end', 0, 197],
    ]);
    // A backlog is better lower: raised is unfavourable, closed favourable
    expect(bars.map((b) => b.good)).toEqual([null, false, true, null]);
    expect(domain[0]).toBe(0);
    expect(domain[1]).toBeGreaterThanOrEqual(201);
  });

  it('a subtotal without a value closes the running level; explicit kinds win', () => {
    const { bars } = waterfallLayout([
      { id: 'a', label: 'A', value: 10, kind: 'delta' },
      { id: 'b', label: 'B', value: 5 },
      { id: 's', label: 'Sub', value: null, kind: 'subtotal' },
      { id: 'c', label: 'C', value: -20, kind: 'delta' },
    ]);
    expect(bars.map((b) => [b.from, b.to])).toEqual([
      [0, 10],
      [10, 15],
      [0, 15],
      [15, -5],
    ]);
    expect(stepKind({ id: 'x', label: 'x', value: 1 }, 0, 1)).toBe('delta');
  });

  it('an auto baseline starts the axis near the lowest level so small movements show (levels drawn broken)', () => {
    const big = [
      { id: 'o', label: 'Opening', value: 412.6 },
      { id: 'a', label: 'Additions', value: 18.4 },
      { id: 'd', label: 'Depreciation', value: -14.9 },
      { id: 'c', label: 'Closing', value: 416.1 },
    ];
    const auto = waterfallLayout(big, { baseline: 'auto' });
    expect(auto.broken).toBe(true);
    expect(auto.domain[0]).toBeGreaterThan(300);
    expect(auto.domain[0]).toBeLessThan(412.6);
    expect(auto.domain[1]).toBeGreaterThanOrEqual(431);
    expect(waterfallLayout(big).broken).toBe(false);
    // A level at or below zero keeps the zero baseline
    expect(waterfallLayout([{ id: 'x', label: 'x', value: -5 }, { id: 'y', label: 'y', value: 10 }], { baseline: 'auto' }).broken).toBe(false);
  });
});

describe('treemap', () => {
  const nodes = [
    { id: 'Line', label: 'Line', children: [{ id: 'Pipes', label: 'Pipes', value: 60 }, { id: 'Mains', label: 'Mains', value: 20 }] },
    { id: 'Core', label: 'Core', children: [{ id: 'Buildings', label: 'Buildings', value: 20 }, { id: 'Empty', label: 'Empty', value: 0 }] },
  ];

  it('nests tiles inside their parent, under its header, with shares of the whole', () => {
    const tiles = treemapLayout(nodes, 400, 300);
    const byPath = new Map(tiles.map((t) => [t.path, t]));
    const line = byPath.get('Line');
    const pipes = byPath.get('Line/Pipes');
    expect(line?.share).toBeCloseTo(0.8);
    expect(pipes?.share).toBeCloseTo(0.6);
    expect(pipes?.leaf).toBe(true);
    expect(pipes?.parent?.id).toBe('Line');
    expect(pipes && line && pipes.y0 >= line.y0 + 20 && pipes.x1 <= line.x1).toBe(true);
    // Zero-size items are not drawn
    expect(byPath.has('Core/Empty')).toBe(false);
  });

  it('lays out a flat list without headers', () => {
    const tiles = treemapLayout([{ id: 'a', label: 'a', value: 3 }, { id: 'b', label: 'b', value: 1 }], 200, 100);
    expect(tiles.every((t) => t.leaf && t.depth === 0)).toBe(true);
    const area = (t: (typeof tiles)[number]) => (t.x1 - t.x0) * (t.y1 - t.y0);
    expect(area(tiles[0] as (typeof tiles)[number]) / area(tiles[1] as (typeof tiles)[number])).toBeCloseTo(3, 0);
  });
});

describe('calendar', () => {
  it('spans whole months in week columns starting on Monday, without time-zone shifts', () => {
    const cal = calendarLayout([
      { date: '2026-02-03T00:00:00', value: 4 },
      { date: '2026-03-31', value: 9 },
    ]);
    expect(cal.cells[0]?.iso).toBe('2026-02-01');
    expect(cal.cells[cal.cells.length - 1]?.iso).toBe('2026-03-31');
    // 1 Feb 2026 is a Sunday: the last row of the first week
    expect(cal.cells[0]).toMatchObject({ week: 0, weekday: 6 });
    expect(cal.cells.find((c) => c.iso === '2026-02-03')).toMatchObject({ week: 1, weekday: 1, value: 4 });
    expect(cal.cells.find((c) => c.iso === '2026-02-04')?.value).toBeNull();
    expect(cal.months.map((m) => m.label)).toEqual(['Feb', 'Mar']);
    expect(calendarLayout([]).weeks).toBe(0);
    expect(isoDay(parseDay('2026-10-07T23:59:00') as Date)).toBe('2026-10-07');
  });
});

describe('box plot', () => {
  it('summarises raw values with Tukey whiskers and outliers', () => {
    const s = boxStats([1, 2, 3, 4, 5, 6, 7, 8, 9, 100]);
    expect(s.median).toBe(5.5);
    expect(s.q1).toBe(3.25);
    expect(s.q3).toBe(7.75);
    expect(s.max).toBe(9);
    expect(s.outliers).toEqual([100]);
    expect(s.count).toBe(10);
    expect(boxStats([]).median).toBeNull();
  });

  it('keeps the engine statistics when they are given', () => {
    expect(itemStats({ id: 'a', label: 'a', min: 1, q1: 2, median: 3, q3: 4, max: 5, values: [100, 200] }).median).toBe(3);
    expect(itemStats({ id: 'b', label: 'b', values: [1, 2, 3] }).median).toBe(2);
  });
});

describe('timeline', () => {
  it('packs overlapping items into rows per lane and spans today', () => {
    const today = new Date(2026, 9, 7);
    const { lanes, domain } = timelineLayout(
      [
        { id: 'a', label: 'Pump A', start: '2026-01-01', end: '2026-12-31', lane: 'Pumps' },
        { id: 'b', label: 'Pump B', start: '2026-06-01', end: '2027-05-31', lane: 'Pumps' },
        { id: 'c', label: 'Pump C', start: '2027-01-15', end: '2027-03-01', lane: 'Pumps' },
        { id: 'd', label: 'Roof', start: '2025-05-01', end: null, lane: 'Buildings' },
      ],
      { today }
    );
    expect(lanes.map((l) => [l.lane, l.rows])).toEqual([
      ['Pumps', 2],
      ['Buildings', 1],
    ]);
    expect(lanes[0]?.bars.map((b) => [b.task.id, b.row])).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 0],
    ]);
    expect(lanes[1]?.bars[0]?.open).toBe(true);
    expect(domain?.[0].getTime()).toBe(new Date(2025, 4, 1).getTime());
    expect(domain?.[1].getTime()).toBe(new Date(2027, 4, 31).getTime());
  });
});

describe('dot plot', () => {
  const items = [
    { id: 'a', label: 'A', from: 10, to: 12 },
    { id: 'b', label: 'B', from: 20, to: 5 },
    { id: 'c', label: 'C', from: null, to: 8 },
  ];

  it('orders rows, judges each move by meaning and pads the domain without forcing zero', () => {
    expect(dotPlotRows(items, 'change').map((d) => d.id)).toEqual(['b', 'c', 'a']);
    expect(dotPlotRows(items, 'to').map((d) => d.id)).toEqual(['a', 'c', 'b']);
    expect(items.map((d) => moveGood(d, 'lower'))).toEqual([false, true, null]);
    const [lo, hi] = dotDomain(items);
    expect(lo).toBeCloseTo(4.1);
    expect(hi).toBeCloseTo(20.9);
  });

  it('spreads slope labels apart, keeping their order', () => {
    expect(spreadLabels([100, 104, 50], 12)).toEqual([100, 112, 50]);
  });
});
