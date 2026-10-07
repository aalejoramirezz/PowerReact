import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { appliedFilters, sampleRows, selectionOf, type CrossFilter } from './crossFilters';
import { categoryLabel, mapRows, normalizeKey, toNullableNumber } from './mapRows';
import { validateManifest, type Manifest, type ManifestComponentName, type VisualOf } from './schema';

const parsed = validateManifest(JSON.parse(readFileSync('public/manifests/sample-manifest.json', 'utf8')));
if (!parsed.ok) throw new Error('sample manifest invalid');
const manifest: Manifest = parsed.manifest;
const visual = <C extends ManifestComponentName>(id: string, _component: C) =>
  manifest.visuals.find((v) => v.id === id) as VisualOf<C>;

const GROUP = "'asset_class_group'[Asset_Class_Group]";
const CLASS = "'asset_class'[Asset_Class]";
const filter = (field: string, value: string, sourceVisualId: string): CrossFilter => ({ field, value, sourceVisualId });

describe('keys and values', () => {
  it('normalises quoted table names to the executeQueries spelling', () => {
    expect(normalizeKey(GROUP)).toBe('asset_class_group[Asset_Class_Group]');
    expect(normalizeKey("'Date Table'[Month]")).toBe('Date Table[Month]');
    expect(normalizeKey('[Assets]')).toBe('[Assets]');
  });

  it('keeps blanks blank and reads numeric strings', () => {
    expect(toNullableNumber(null)).toBeNull();
    expect(toNullableNumber('')).toBeNull();
    expect(toNullableNumber('12.5')).toBe(12.5);
    expect(toNullableNumber('n/a')).toBeNull();
    expect(categoryLabel(2024)).toBe('2024');
    expect(categoryLabel(null)).toBe('(Blank)');
  });
});

describe('mapRows', () => {
  it('KPI: first row, blanks stay blank, meter from its own field', () => {
    expect(mapRows(visual('kpi-total', 'UniverusKpiCard'), [{ '[Total Assets]': 10000 }])).toEqual({ value: 10000, comparisonValue: null, meterValue: null });
    expect(mapRows(visual('kpi-total', 'UniverusKpiCard'), [])).toMatchObject({ value: null });
    expect(mapRows(visual('kpi-assessed', 'UniverusKpiCard'), [{ '[Assessed]': '7390', '[Assessed Share]': 0.739 }])).toMatchObject({
      value: 7390,
      meterValue: 0.739,
    });
  });

  it('hero: value, meter and labelled metrics', () => {
    const out = mapRows(visual('condition-coverage', 'UniverusKpiHero'), [
      { '[Assessed Share]': 0.739, '[Total Assets]': 10000, '[Assessed]': 7390, '[Due For Renewal]': null, '[Due Share]': 0.0687 },
    ]);
    expect(out.value).toBe(0.739);
    expect(out.meterValue).toBe(0.0687);
    expect(out.metrics).toEqual([
      { label: 'Assets in scope', value: 10000, format: undefined },
      { label: 'Condition assessed', value: 7390, format: undefined },
      { label: 'Due for renewal', value: null, format: undefined },
    ]);
  });

  it('bars: category (with its raw value) and value, quoted or unquoted keys', () => {
    const out = mapRows(visual('groups', 'UniverusSpotlightBars'), [
      { 'asset_class_group[Asset_Class_Group]': 'Core', '[Group Assets]': 1200 },
      { "'asset_class_group'[Asset_Class_Group]": 'rd_line', '[Group Assets]': '300' },
      { 'asset_class_group[Asset_Class_Group]': null, '[Group Assets]': null },
    ]);
    expect(out.data).toEqual([
      { id: 'Core', label: 'Core', value: 1200, raw: 'Core' },
      { id: 'rd_line', label: 'rd_line', value: 300, raw: 'rd_line' },
      { id: '(Blank)', label: '(Blank)', value: 0, raw: undefined },
    ]);
  });

  it('table: columns keyed like the rows, kinds inferred, row key from the manifest', () => {
    const out = mapRows(visual('classes', 'UniverusDataTable'), [
      { 'asset_class[Asset_Class]': 'Roads', 'asset_class_group[Asset_Class_Group]': 'rd_line', '[Assets]': 300, '[Assessed]': 100, '[Assessed Share]': 0.33, '[Due For Renewal]': 0 },
    ]);
    expect(out.rowKey).toBe('asset_class[Asset_Class]');
    expect(out.columns.map((c) => [c.key, c.kind])).toEqual([
      ['asset_class[Asset_Class]', 'text'],
      ['asset_class_group[Asset_Class_Group]', 'text'],
      ['[Assets]', 'number'],
      ['[Assessed]', 'meter'],
      ['[Due For Renewal]', 'status'],
    ]);
    expect(out.columns[3]?.ratioKey).toBe('[Assessed Share]');
    expect(out.rows[0]?.['asset_class[Asset_Class]']).toBe('Roads');
  });

  it('trend: categories in row order, a primary and an optional comparison series', () => {
    const trend = {
      ...visual('groups', 'UniverusSpotlightBars'),
      component: 'UniverusTrendChart',
      fields: { category: "'Date'[Month]", value: '[Received]', comparison: '[Resolved]' },
      props: { title: 'Requests', seriesLabel: 'Received', area: true, directLabels: true, chartHeight: 260, focusMode: true, tableView: true },
    } as unknown as VisualOf<'UniverusTrendChart'>;
    const out = mapRows(trend, [
      { 'Date[Month]': 'Jan', '[Received]': 10, '[Resolved]': 8 },
      { 'Date[Month]': 'Feb', '[Received]': null, '[Resolved]': 9 },
    ]);
    expect(out.categories).toEqual(['Jan', 'Feb']);
    expect(out.series).toEqual([
      { id: 'value', label: 'Received', role: 'primary', values: [10, null] },
      { id: 'comparison', label: 'Resolved', role: 'comparison', values: [8, 9] },
    ]);
  });
});

describe('cross-filter rules', () => {
  const groups = visual('groups', 'UniverusSpotlightBars');
  const donut = visual('assessed-by-group', 'UniverusDonut');
  const ranking = visual('top-classes', 'UniverusRankingBars');
  const kpi = visual('kpi-total', 'UniverusKpiCard');
  const filters = [filter(GROUP, 'Utility_Line', 'groups'), filter(CLASS, 'Water_Pipes', 'classes')];

  it('a visual is never filtered on its own column: it highlights instead', () => {
    expect(appliedFilters(groups, filters).map((f) => f.field)).toEqual([CLASS]);
    expect(selectionOf(groups, filters)).toBe('Utility_Line');
    // Another visual on the same column highlights the same value instead of collapsing to one part
    expect(appliedFilters(donut, filters).map((f) => f.field)).toEqual([CLASS]);
    expect(selectionOf(donut, filters)).toBe('Utility_Line');
  });

  it('visuals without a column of their own obey every filter; respect: false ignores them all', () => {
    expect(appliedFilters(kpi, filters)).toHaveLength(2);
    expect(selectionOf(kpi, filters)).toBeNull();
    expect(appliedFilters({ ...ranking, crossFilter: { field: CLASS, emit: true, respect: false } }, filters)).toEqual([]);
  });
});

describe('Sample mode', () => {
  it('sums single-value visuals over the rows a filter keeps', () => {
    const kpi = visual('kpi-total', 'UniverusKpiCard');
    expect(sampleRows(kpi, [])).toMatchObject([{ '[Total Assets]': 10000 }]);
    expect(sampleRows(kpi, [filter(GROUP, 'Utility_Line', 'groups')])).toMatchObject([{ '[Total Assets]': 5451 }]);
    expect(sampleRows(kpi, [filter(GROUP, 'Utility_Line', 'groups'), filter(CLASS, 'Water_Pipes', 'x')])).toMatchObject([{ '[Total Assets]': 1979 }]);
  });

  it('ignores filters on columns the sample does not carry, and averages ratios', () => {
    expect(sampleRows(visual('kpi-base-life', 'UniverusKpiCard'), [filter(GROUP, 'Core', 'groups')])).toEqual([{ '[Avg Base Life]': 42.3 }]);
    const [assessed] = sampleRows(visual('kpi-assessed', 'UniverusKpiCard'), [filter(GROUP, 'Core', 'groups')]);
    expect(assessed?.['[Assessed]']).toBe(1000);
    expect(assessed?.['[Assessed Share]']).toBeCloseTo(0.8333, 3);
  });

  it('aggregates category visuals to their category', () => {
    const rows = sampleRows(visual('groups', 'UniverusSpotlightBars'), []);
    expect(rows.map((r) => [r['asset_class_group[Asset_Class_Group]'], r['[Group Assets]']])).toEqual([
      ['Utility_Line', 5451],
      ['Utility_Point', 2549],
      ['Core', 1200],
      ['Transport', 500],
      ['rd_line', 300],
    ]);
    expect(sampleRows(visual('top-classes', 'UniverusRankingBars'), [filter(GROUP, 'Core', 'groups')])).toHaveLength(1);
  });
});
