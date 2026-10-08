import { describe, expect, it } from 'vitest';
import type { DaxRow } from '../dax/types';
import { appliedFilters, ownColumns, sampleColumnValues, sampleRows, selectionOn, type CrossFilter } from './crossFilters';
import { columnValuesQuery } from './daxInjection';
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

describe('column chart and stacked bars', () => {
  const MONTH = "'Date'[Year Month]";
  const STATUS = "'WR Status'[Status]";
  const long: DaxRow[] = [
    { 'Date[Year Month]': '2026-01', 'WR Status[Status]': 'Open', '[WRs]': 3, '[SLA]': 0.9 },
    { 'Date[Year Month]': '2026-01', 'WR Status[Status]': 'Closed', '[WRs]': 20, '[SLA]': 0.9 },
    { 'Date[Year Month]': '2026-02', 'WR Status[Status]': 'Closed', '[WRs]': 25, '[SLA]': 0.8 },
  ];

  it('pivots long rows into one series per status, keeping the query order of categories', () => {
    const v = visual({
      component: 'UniverusColumnChart',
      fields: { category: MONTH, series: STATUS, value: '[WRs]', tooltips: [{ field: '[SLA]', label: 'Within SLA', format: { style: 'percent' } }] },
      props: { title: 'WRs', seriesOrder: ['Closed'] },
    });
    const d = mapRows(v, long);
    expect(d.categories.map((c) => c.label)).toEqual(['2026-01', '2026-02']);
    // seriesOrder first, then the order of appearance; a missing pair stays blank
    expect(d.series.map((s) => [s.id, s.values])).toEqual([
      ['Closed', [20, 25]],
      ['Open', [3, null]],
    ]);
    expect(d.categories[0]?.tooltips).toEqual([{ label: 'Within SLA', value: 0.9, format: { style: 'percent' } }]);
  });

  it('reads wide rows as one series per measure, and a single measure as one series', () => {
    const rows = [
      { 'Date[Year]': 2026, '[Need]': 4.2, '[Budget]': 3.8 },
      { 'Date[Year]': 2027, '[Need]': 3.1, '[Budget]': 3.8 },
    ];
    const wide = visual({
      component: 'UniverusColumnChart',
      fields: { category: "'Date'[Year]", values: [{ field: '[Need]', label: 'Need' }, { field: '[Budget]', label: 'Budget' }] },
      props: { title: 'Funding', layout: 'grouped' },
    });
    const d = mapRows(wide, rows);
    expect(d.categories.map((c) => c.raw)).toEqual([2026, 2027]);
    expect(d.series.map((s) => [s.label, s.values])).toEqual([
      ['Need', [4.2, 3.1]],
      ['Budget', [3.8, 3.8]],
    ]);
    const single = visual({ component: 'UniverusStackedBars', fields: { category: "'Date'[Year]", value: '[Need]' }, props: { title: 'Need' } });
    expect(mapRows(single, rows).series).toEqual([{ id: 'value', label: 'Need', values: [4.2, 3.1] }]);
  });

  it('a segment click selects the series column too: the chart highlights it, others filter', () => {
    const v = visual({
      component: 'UniverusStackedBars',
      fields: { category: MONTH, series: STATUS, value: '[WRs]' },
      crossFilter: { field: MONTH },
      props: { title: 'WRs' },
    });
    expect(ownColumns(v)).toEqual([MONTH, STATUS]);
    const filters = [select(STATUS, 'Open'), select("'Crew'[Crew]", 'North')];
    expect(appliedFilters(v, filters).map((f) => f.field)).toEqual(["'Crew'[Crew]"]);
    expect(selectionOn(filters, STATUS)).toBe('Open');
  });

  it('aggregates samples by category and series, averaging percent tooltips', () => {
    const v = visual({
      component: 'UniverusColumnChart',
      fields: { category: MONTH, series: STATUS, value: '[WRs]', tooltips: [{ field: '[SLA]', label: 'SLA', format: { style: 'percent' } }] },
      props: { title: 'WRs' },
      sample: [...long, { 'Date[Year Month]': '2026-02', 'WR Status[Status]': 'Closed', '[WRs]': 5, '[SLA]': 0.6 }],
    });
    const closedFeb = sampleRows(v, []).find((r) => r['Date[Year Month]'] === '2026-02');
    expect(closedFeb?.['[WRs]']).toBe(30);
    expect(closedFeb?.['[SLA]']).toBeCloseTo(0.7);
  });
});

describe('matrix', () => {
  const CRIT = "'Asset'[Criticality]";
  const COND = "'Asset'[Condition]";
  const v = visual({
    component: 'UniverusMatrix',
    fields: {
      rows: [CRIT],
      column: COND,
      values: [{ field: '[Assets]', label: 'Assets', heatmap: 'sequential' }],
      rowTotals: ['[IsCritTotal]'],
      columnTotal: '[IsCondTotal]',
    },
    crossFilter: { field: CRIT },
    props: { title: 'Risk' },
  });
  // ROLLUPADDISSUBTOTAL rows as the engine returns them: cells, row totals, column totals, grand total
  const rows: DaxRow[] = [
    { 'Asset[Criticality]': 5, 'Asset[Condition]': 'Good', '[IsCritTotal]': false, '[IsCondTotal]': false, '[Assets]': 10 },
    { 'Asset[Criticality]': 5, 'Asset[Condition]': 'Poor', '[IsCritTotal]': false, '[IsCondTotal]': false, '[Assets]': 4 },
    { 'Asset[Criticality]': 5, 'Asset[Condition]': null, '[IsCritTotal]': false, '[IsCondTotal]': true, '[Assets]': 14 },
    { 'Asset[Criticality]': 4, 'Asset[Condition]': 'Good', '[IsCritTotal]': false, '[IsCondTotal]': false, '[Assets]': 7 },
    { 'Asset[Criticality]': 4, 'Asset[Condition]': null, '[IsCritTotal]': false, '[IsCondTotal]': true, '[Assets]': 7 },
    { 'Asset[Criticality]': null, 'Asset[Condition]': 'Good', '[IsCritTotal]': true, '[IsCondTotal]': false, '[Assets]': 17 },
    { 'Asset[Criticality]': null, 'Asset[Condition]': 'Poor', '[IsCritTotal]': true, '[IsCondTotal]': false, '[Assets]': 4 },
    { 'Asset[Criticality]': null, 'Asset[Condition]': null, '[IsCritTotal]': true, '[IsCondTotal]': true, '[Assets]': 21 },
  ];

  it('builds the pivot from the engine rows: cells, row totals and the grand total, never summed here', () => {
    const d = mapRows(v, rows);
    expect(d.columns.map((c) => c.label)).toEqual(['Good', 'Poor']);
    expect(d.nodes.map((n) => [n.label, n.cells['[Assets]'], n.total?.['[Assets]']])).toEqual([
      ['5', [10, 4], 14],
      ['4', [7, null], 7],
    ]);
    expect(d.grandTotal?.cells['[Assets]']).toEqual([17, 4]);
    expect(d.grandTotal?.total?.['[Assets]']).toBe(21);
    expect(d.measures[0]).toMatchObject({ id: '[Assets]', heatmap: 'sequential' });
  });

  it('nests a hierarchy from subtotal flags (the group row is the engine subtotal)', () => {
    const tree = visual({
      component: 'UniverusMatrix',
      fields: { rows: ["'g'[Group]", "'c'[Class]"], values: [{ field: '[Share]', label: 'Share' }], rowTotals: ['[IsG]', '[IsC]'] },
      props: { title: 'Tree' },
    });
    const d = mapRows(tree, [
      { 'g[Group]': 'Core', 'c[Class]': 'Buildings', '[IsG]': false, '[IsC]': false, '[Share]': 0.9 },
      { 'g[Group]': 'Core', 'c[Class]': 'Bridges', '[IsG]': false, '[IsC]': false, '[Share]': 0.3 },
      { 'g[Group]': 'Core', 'c[Class]': null, '[IsG]': false, '[IsC]': true, '[Share]': 0.5 },
      { 'g[Group]': null, 'c[Class]': null, '[IsG]': true, '[IsC]': true, '[Share]': 0.5 },
    ]);
    expect(d.nodes).toHaveLength(1);
    expect(d.nodes[0]?.cells['[Share]']).toEqual([0.5]);
    expect(d.nodes[0]?.children?.map((c) => [c.label, c.cells['[Share]']])).toEqual([
      ['Buildings', [0.9]],
      ['Bridges', [0.3]],
    ]);
    expect(d.nodes[0]?.children?.[0]?.children).toBeUndefined();
    expect(d.grandTotal?.cells['[Share]']).toEqual([0.5]);
  });

  it('a cell selects its row and column: the matrix highlights both, other filters apply', () => {
    expect(ownColumns(v)).toEqual([CRIT, COND]);
    expect(appliedFilters(v, [select(COND, 'Poor'), select("'Asset'[Community]", 'East')]).map((f) => f.field)).toEqual(["'Asset'[Community]"]);
  });
});

describe('scatter and slicer', () => {
  it('maps points with size, group and tooltips; samples average x / y and sum the size', () => {
    const v = visual({
      component: 'UniverusScatter',
      fields: { category: "'c'[Class]", x: '[Cond]', y: '[Crit]', size: '[Assets]', group: "'g'[Group]" },
      props: { title: 'Risk' },
      sample: [
        { 'c[Class]': 'Pipes', 'g[Group]': 'Line', '[Cond]': 3, '[Crit]': 4, '[Assets]': 10 },
        { 'c[Class]': 'Pipes', 'g[Group]': 'Line', '[Cond]': 4, '[Crit]': 2, '[Assets]': 30 },
      ],
    });
    const [row] = sampleRows(v, []);
    expect([row?.['[Cond]'], row?.['[Crit]'], row?.['[Assets]']]).toEqual([3.5, 3, 40]);
    expect(mapRows(v, row ? [row] : []).points).toEqual([{ id: 'Pipes', label: 'Pipes', raw: 'Pipes', x: 3.5, y: 3, size: 40, group: 'Line' }]);
  });

  it('a slicer owns its column: options ignore its own filter, every other visual obeys it', () => {
    const slicer = visual({
      component: 'UniverusSlicer',
      fields: { value: "'g'[Group]", count: '[Assets]' },
      props: { title: 'Group' },
    });
    expect(ownColumns(slicer)).toEqual(["'g'[Group]"]);
    const own: CrossFilter = { field: "'g'[Group]", values: ['Core', 'Line'], labels: ['Core', 'Line'], sourceVisualId: 'v', origin: 'slicer' };
    expect(appliedFilters(slicer, [own])).toEqual([]);
    expect(mapRows(slicer, [{ 'g[Group]': 'Core', '[Assets]': 12 }]).options).toEqual([{ id: 'Core', label: 'Core', raw: 'Core', count: 12 }]);
  });

  it('report filters: a safe default options query and offline options from the samples', () => {
    expect(columnValuesQuery("asset[Community]")).toBe("EVALUATE\nSUMMARIZECOLUMNS('asset'[Community])\nORDER BY 'asset'[Community]");
    expect(() => columnValuesQuery('ALL(x)')).toThrow(/column reference/);
    const a = visual({ component: 'UniverusSlicer', fields: { value: "'g'[Group]" }, props: { title: 'G' }, sample: [{ 'g[Group]': 'Core', 'c[Class]': 'Buildings' }, { 'g[Group]': 'Line', 'c[Class]': 'Pipes' }] });
    expect(sampleColumnValues([a], "'c'[Class]", [])).toEqual(['Buildings', 'Pipes']);
    // The other filters narrow the options; one on the filter's own column does not
    expect(sampleColumnValues([a], "'c'[Class]", [select("'g'[Group]", 'Core'), select("'c'[Class]", 'Pipes')])).toEqual(['Buildings']);
  });
});
