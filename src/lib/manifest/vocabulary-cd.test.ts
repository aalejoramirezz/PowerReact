import { describe, expect, it } from 'vitest';
import type { DaxRow } from '../dax/types';
import { appliedFilters, ownColumns, sampleRows, type CrossFilter } from './crossFilters';
import { injectCrossFilters } from './daxInjection';
import { mapRows } from './mapRows';
import { validateManifest, type ManifestVisual, type VisualOf } from './schema';

/** Builds a validated visual (defaults applied) from a minimal spec. */
function visual<C extends ManifestVisual['component']>(spec: Record<string, unknown> & { component: C }): VisualOf<C> {
  const result = validateManifest({
    schemaVersion: 1,
    id: 'vocab',
    title: 'Vocabulary',
    dataSource: { workspaceId: '00000000-0000-4000-8000-000000000001', semanticModelId: '00000000-0000-4000-8000-000000000002' },
    visuals: [{ id: 'v', grid: { colSpan: 6 }, query: { dax: 'EVALUATE ROW("x", 1)' }, ...spec }],
  });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.manifest.visuals[0] as VisualOf<C>;
}

const select = (field: string, value: string, sourceVisualId = 'other'): CrossFilter => ({ field, values: [value], sourceVisualId, origin: 'select' });

describe('waterfall', () => {
  const v = visual({
    component: 'UniverusWaterfall',
    fields: { category: '[Step]', value: '[Delta]', kind: '[Kind]', tooltips: [{ field: '[Share]', label: 'Share', format: { style: 'percent' } }] },
    props: { title: 'Backlog bridge' },
  });

  it('keeps the query order and reads the level kinds (case-insensitive, unknown ignored)', () => {
    const rows: DaxRow[] = [
      { '[Step]': 'Open 7 days ago', '[Delta]': 120, '[Kind]': 'Start', '[Share]': 1 },
      { '[Step]': 'Raised', '[Delta]': 40, '[Kind]': 'delta', '[Share]': 0.3 },
      { '[Step]': 'Closed', '[Delta]': -55, '[Kind]': 'other', '[Share]': 0.4 },
      { '[Step]': 'Open now', '[Delta]': 105, '[Kind]': 'END', '[Share]': 1 },
    ];
    const { steps } = mapRows(v, rows);
    expect(steps.map((s) => [s.label, s.value, s.kind])).toEqual([
      ['Open 7 days ago', 120, 'start'],
      ['Raised', 40, 'delta'],
      ['Closed', -55, undefined],
      ['Open now', 105, 'end'],
    ]);
    expect(steps[1]?.tooltips).toEqual([{ label: 'Share', value: 0.3, format: { style: 'percent' } }]);
  });

  it('samples sum each step over the finer rows', () => {
    const s = visual({
      component: 'UniverusWaterfall',
      fields: { category: '[Step]', value: '[Delta]' },
      props: { title: 'Bridge' },
      sample: [
        { '[Step]': 'Raised', 'g[Group]': 'Core', '[Delta]': 10 },
        { '[Step]': 'Raised', 'g[Group]': 'Line', '[Delta]': 5 },
        { '[Step]': 'Closed', 'g[Group]': 'Core', '[Delta]': -7 },
      ],
    });
    expect(sampleRows(s, []).map((r) => r['[Delta]'])).toEqual([15, -7]);
    expect(sampleRows(s, [select("'g'[Group]", 'Core')]).map((r) => r['[Delta]'])).toEqual([10, -7]);
  });
});

describe('treemap', () => {
  const GROUP = "'g'[Group]";
  const CLASS = "'c'[Class]";
  const rows: DaxRow[] = [
    { 'g[Group]': 'Core', 'c[Class]': 'Buildings', '[Assets]': 30, '[Cond]': 3.1 },
    { 'g[Group]': 'Core', 'c[Class]': 'Roads', '[Assets]': 20, '[Cond]': 2.5 },
    { 'g[Group]': 'Line', 'c[Class]': 'Pipes', '[Assets]': 50, '[Cond]': 3.8 },
  ];
  const v = visual({
    component: 'UniverusTreemap',
    fields: { levels: [GROUP, CLASS], value: '[Assets]', color: '[Cond]' },
    crossFilter: { field: GROUP },
    props: { title: 'Inventory' },
  });

  it('nests items under their group, with sizes and colour values', () => {
    const { nodes } = mapRows(v, rows);
    expect(nodes.map((n) => [n.label, n.children?.map((c) => [c.label, c.value, c.colorValue])])).toEqual([
      ['Core', [['Buildings', 30, 3.1], ['Roads', 20, 2.5]]],
      ['Line', [['Pipes', 50, 3.8]]],
    ]);
  });

  it('one level gives a flat list', () => {
    const flat = visual({ component: 'UniverusTreemap', fields: { levels: [CLASS], value: '[Assets]' }, props: { title: 'Classes' } });
    expect(mapRows(flat, rows).nodes.map((n) => [n.label, n.value, n.children])).toEqual([
      ['Buildings', 30, undefined],
      ['Roads', 20, undefined],
      ['Pipes', 50, undefined],
    ]);
  });

  it('a tile selects its group and item: the treemap highlights both levels, others filter', () => {
    expect(ownColumns(v)).toEqual([GROUP, CLASS]);
    expect(appliedFilters(v, [select(CLASS, 'Pipes'), select("'a'[Community]", 'East')]).map((f) => f.field)).toEqual(["'a'[Community]"]);
  });

  it('samples sum the size and average the colour measure', () => {
    const s = visual({
      component: 'UniverusTreemap',
      fields: { levels: [GROUP], value: '[Assets]', color: '[Cond]' },
      props: { title: 'Groups' },
      sample: rows,
    });
    expect(sampleRows(s, []).map((r) => [r['g[Group]'], r['[Assets]'], r['[Cond]']])).toEqual([
      ['Core', 50, 2.8],
      ['Line', 50, 3.8],
    ]);
  });
});

describe('calendar heatmap', () => {
  const DATE = "'Date'[Date]";
  const v = visual({
    component: 'UniverusCalendarHeatmap',
    fields: { date: DATE, value: '[WRs]' },
    crossFilter: { field: DATE },
    props: { title: 'Raised per day' },
  });

  it('keeps the engine date as the click value and drops rows without a date', () => {
    const { days } = mapRows(v, [
      { 'Date[Date]': '2026-03-02T00:00:00', '[WRs]': 4 },
      { 'Date[Date]': null, '[WRs]': 9 },
      { 'Date[Date]': '2026-03-03T00:00:00', '[WRs]': null },
    ]);
    expect(days).toEqual([
      { date: '2026-03-02T00:00:00', value: 4, raw: '2026-03-02T00:00:00' },
      { date: '2026-03-03T00:00:00', value: null, raw: '2026-03-03T00:00:00' },
    ]);
  });

  it('a clicked day filters other visuals as a DATE', () => {
    const dax = injectCrossFilters("EVALUATE SUMMARIZECOLUMNS('wr'[Type], \"WRs\", [WRs Raised])", [select(DATE, '2026-03-02T00:00:00')]);
    expect(dax).toContain("TREATAS({DATE(2026, 3, 2)}, 'Date'[Date])");
  });
});

describe('dot plot', () => {
  it('maps the two values per category', () => {
    const v = visual({
      component: 'UniverusDotPlot',
      fields: { category: "'crew'[Crew]", from: '[Open 7D Ago]', to: '[Open]' },
      props: { title: 'Backlog by crew', goodWhen: 'lower' },
    });
    expect(mapRows(v, [{ 'crew[Crew]': 'North', '[Open 7D Ago]': 12, '[Open]': '9' }]).items).toEqual([{ id: 'North', label: 'North', raw: 'North', from: 12, to: 9 }]);
    expect(v.props).toMatchObject({ variant: 'dumbbell', fromLabel: 'Before', toLabel: 'After', sort: 'none' });
  });
});

describe('timeline', () => {
  const v = visual({
    component: 'UniverusTimeline',
    fields: { item: '[Asset]', start: '[Start]', end: '[End]', lane: '[Vendor]', tone: '[Tone]' },
    props: { title: 'Warranties' },
    sample: [
      { '[Asset]': 'Pump 1', '[Start]': '2025-01-01T00:00:00', '[End]': '2027-01-01T00:00:00', '[Vendor]': 'Acme', '[Tone]': 'ok' },
      { '[Asset]': 'Pump 1', '[Start]': '2023-01-01T00:00:00', '[End]': '2025-01-01T00:00:00', '[Vendor]': 'Acme', '[Tone]': 'ok' },
    ],
  });

  it('one item per row with unique ids; no start: dropped; blank end: open; unknown tone ignored', () => {
    const { tasks } = mapRows(v, [
      { '[Asset]': 'Pump 1', '[Start]': '2025-01-01T00:00:00', '[End]': '2027-01-01T00:00:00', '[Vendor]': 'Acme', '[Tone]': 'OK' },
      { '[Asset]': 'Pump 1', '[Start]': '2023-01-01T00:00:00', '[End]': null, '[Vendor]': 'Acme', '[Tone]': 'expired' },
      { '[Asset]': 'Valve', '[Start]': null, '[End]': '2026-01-01T00:00:00' },
    ]);
    expect(tasks).toEqual([
      { id: 'Pump 1#0', label: 'Pump 1', raw: 'Pump 1', start: '2025-01-01T00:00:00', end: '2027-01-01T00:00:00', lane: 'Acme', tone: 'ok' },
      { id: 'Pump 1#1', label: 'Pump 1', raw: 'Pump 1', start: '2023-01-01T00:00:00', end: null, lane: 'Acme' },
    ]);
  });

  it('samples keep every row (each one is an item)', () => {
    expect(sampleRows(v, [])).toHaveLength(2);
  });
});

describe('boxplot', () => {
  const GROUP = "'g'[Group]";

  it('raw observations: gathered per category, blanks skipped; samples keep every row', () => {
    const v = visual({
      component: 'UniverusBoxplot',
      fields: { category: GROUP, value: "'a'[Condition]" },
      props: { title: 'Condition' },
      sample: [
        { 'g[Group]': 'Core', 'a[Condition]': 3 },
        { 'g[Group]': 'Core', 'a[Condition]': 3 },
      ],
    });
    const { items } = mapRows(v, [
      { 'g[Group]': 'Core', 'a[Condition]': 3 },
      { 'g[Group]': 'Line', 'a[Condition]': 4 },
      { 'g[Group]': 'Core', 'a[Condition]': null },
      { 'g[Group]': 'Core', 'a[Condition]': 2 },
    ]);
    expect(items.map((i) => [i.label, i.values])).toEqual([
      ['Core', [3, 2]],
      ['Line', [4]],
    ]);
    expect(sampleRows(v, [])).toHaveLength(2);
  });

  it('engine statistics: one item per row; samples average them per category', () => {
    const v = visual({
      component: 'UniverusBoxplot',
      fields: { category: GROUP, q1: '[Q1]', median: '[Median]', q3: '[Q3]', min: '[Min]', max: '[Max]', count: '[N]' },
      props: { title: 'Condition' },
      sample: [
        { 'g[Group]': 'Core', '[Q1]': 2, '[Median]': 3, '[Q3]': 4, '[Min]': 1, '[Max]': 5, '[N]': 10 },
        { 'g[Group]': 'Core', '[Q1]': 3, '[Median]': 4, '[Q3]': 5, '[Min]': 1, '[Max]': 5, '[N]': 30 },
      ],
    });
    const [row] = sampleRows(v, []);
    expect([row?.['[Q1]'], row?.['[Median]'], row?.['[N]']]).toEqual([2.5, 3.5, 40]);
    expect(mapRows(v, row ? [row] : []).items).toEqual([
      { id: 'Core', label: 'Core', raw: 'Core', min: 1, q1: 2.5, median: 3.5, q3: 4.5, max: 5, mean: null, count: 40 },
    ]);
  });
});

describe('trend chart additions', () => {
  it('reads tooltip measures per period; without them the list is empty', () => {
    const fields = { category: "'Date'[Year]", value: '[Need]', comparison: '[Budget]' };
    const rows: DaxRow[] = [
      { 'Date[Year]': 2026, '[Need]': 10, '[Budget]': 8, '[Assets]': 120 },
      { 'Date[Year]': 2027, '[Need]': 12, '[Budget]': 8, '[Assets]': 125 },
    ];
    const plain = visual({ component: 'UniverusTrendChart', fields, props: { title: 'Gap' } });
    expect(mapRows(plain, rows).categoryTooltips).toEqual([]);
    const tipped = visual({ component: 'UniverusTrendChart', fields: { ...fields, tooltips: [{ field: '[Assets]', label: 'Assets' }] }, props: { title: 'Gap', gap: true } });
    expect(mapRows(tipped, rows).categoryTooltips).toEqual([[{ label: 'Assets', value: 120, format: undefined }], [{ label: 'Assets', value: 125, format: undefined }]]);
    expect(tipped.props).toMatchObject({ gap: true, goodWhen: 'higher' });
  });
});
