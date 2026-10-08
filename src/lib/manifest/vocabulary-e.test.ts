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

const select = (field: string, value: string | number, sourceVisualId = 'other'): CrossFilter => ({ field, values: [value], sourceVisualId, origin: 'select' });

describe('KPI variants', () => {
  it('the trend KPI heads with the latest period with a value; the comparison comes from that row', () => {
    const rows: DaxRow[] = [
      { 'Date[Year Month]': '2026-07', '[Raised]': 30, '[PY]': 25, '[Target]': 28 },
      { 'Date[Year Month]': '2026-08', '[Raised]': 34, '[PY]': 31, '[Target]': 28 },
      { 'Date[Year Month]': '2026-09', '[Raised]': null, '[PY]': 29, '[Target]': 28 },
    ];
    const plain = visual({ component: 'UniverusKpiTrend', fields: { category: "'Date'[Year Month]", value: '[Raised]' }, props: { title: 'Raised' } });
    expect(mapRows(plain, rows)).toEqual({
      series: [
        { label: '2026-07', value: 30 },
        { label: '2026-08', value: 34 },
        { label: '2026-09', value: null },
      ],
      value: 34,
      target: null,
    });
    const vsPy = visual({ component: 'UniverusKpiTrend', fields: { category: "'Date'[Year Month]", value: '[Raised]', comparison: '[PY]', target: '[Target]' }, props: { title: 'Raised' } });
    expect(mapRows(vsPy, rows)).toMatchObject({ value: 34, comparisonValue: 31, target: 28 });
  });

  it('bullet and variance KPIs read one row; samples average percentages', () => {
    const bullet = visual({
      component: 'UniverusKpiBullet',
      fields: { value: '[SLA]', target: '[SLA Target]' },
      props: { title: 'SLA', thresholds: [0.85, 0.92], format: { style: 'percent' } },
      sample: [
        { 'g[Group]': 'Core', '[SLA]': 0.9, '[SLA Target]': 0.95 },
        { 'g[Group]': 'Line', '[SLA]': 0.96, '[SLA Target]': 0.95 },
      ],
    });
    const [row] = sampleRows(bullet, []);
    expect(mapRows(bullet, row ? [row] : [])).toEqual({ value: expect.closeTo(0.93, 10), target: 0.95, forecast: null });
    const variance = visual({ component: 'UniverusKpiVariance', fields: { actual: '[WDV]', comparison: '[Opening]' }, props: { title: 'Book value', scenario: 'PY' } });
    expect(mapRows(variance, [{ '[WDV]': 110, '[Opening]': '100' }])).toEqual({ actual: 110, comparison: 100 });
    expect(mapRows(variance, [])).toEqual({ actual: null, comparison: null });
  });
});

describe('maps', () => {
  const WR = "'work_request'[WR_Number]";

  it('the point map keeps rows with valid coordinates, unique ids and the raw value for clicks', () => {
    const v = visual({
      component: 'UniverusPointMap',
      fields: { latitude: "'work_request'[Latitude]", longitude: "'work_request'[Longitude]", category: WR, value: '[Age]', group: "'work_request'[Service_Type]" },
      crossFilter: { field: WR },
      props: { title: 'Requests', mark: 'bubble' },
    });
    const { points } = mapRows(v, [
      { 'work_request[WR_Number]': 'WR-1', 'work_request[Latitude]': 49.28, 'work_request[Longitude]': -123.12, '[Age]': 12, 'work_request[Service_Type]': 'Water' },
      { 'work_request[WR_Number]': 'WR-1', 'work_request[Latitude]': '49.30', 'work_request[Longitude]': '-123.10', '[Age]': 3, 'work_request[Service_Type]': 'Water' },
      { 'work_request[WR_Number]': 'WR-2', 'work_request[Latitude]': null, 'work_request[Longitude]': -123.1, '[Age]': 5 },
      { 'work_request[WR_Number]': 'WR-3', 'work_request[Latitude]': 0, 'work_request[Longitude]': 0, '[Age]': 5 },
      { 'work_request[WR_Number]': 'WR-4', 'work_request[Latitude]': 95, 'work_request[Longitude]': 10, '[Age]': 5 },
    ]);
    expect(points).toEqual([
      { id: 'WR-1', label: 'WR-1', raw: 'WR-1', lat: 49.28, lon: -123.12, value: 12, group: 'Water' },
      { id: 'WR-1 (2)', label: 'WR-1', raw: 'WR-1', lat: 49.3, lon: -123.1, value: 3, group: 'Water' },
    ]);
    expect(ownColumns(v)).toEqual([WR]);
    // Samples keep every row: each one is a location
    const s = visual({ component: 'UniverusPointMap', fields: { latitude: '[Lat]', longitude: '[Lon]', category: '[Name]' }, props: { title: 'P' }, sample: [{ '[Name]': 'A', '[Lat]': 1, '[Lon]': 2 }, { '[Name]': 'A', '[Lat]': 1, '[Lon]': 2 }] });
    expect(sampleRows(s, [])).toHaveLength(2);
  });

  it('the choropleth reads region keys as the model returns them; samples average the rate per region', () => {
    const REGION = '[Region Code]';
    const v = visual({
      component: 'UniverusChoropleth',
      fields: { region: REGION, value: '[Poor %]', label: '[Region Name]' },
      crossFilter: { field: "'asset_register'[Community]", emit: false },
      props: { title: 'Poor condition', geo: { set: 'north-america' }, format: { style: 'percent' } },
      sample: [
        { '[Region Code]': 'US-NY', '[Region Name]': 'New York', '[Poor %]': 0.2, 'g[Group]': 'Core' },
        { '[Region Code]': 'US-NY', '[Region Name]': 'New York', '[Poor %]': 0.1, 'g[Group]': 'Line' },
        { '[Region Code]': 'CA-BC', '[Region Name]': 'British Columbia', '[Poor %]': 0.08, 'g[Group]': 'Core' },
      ],
    });
    const rows = sampleRows(v, []);
    expect(mapRows(v, rows).regions).toEqual([
      { key: 'US-NY', raw: 'US-NY', label: 'New York', value: expect.closeTo(0.15, 10) },
      { key: 'CA-BC', raw: 'CA-BC', label: 'British Columbia', value: 0.08 },
    ]);
    expect(mapRows(v, [{ '[Region Code]': null, '[Poor %]': 0.3 }]).regions).toEqual([]);
    // A filter on a column the samples carry narrows the regions
    expect(sampleRows(v, [select("'g'[Group]", 'Line')]).map((r) => r['[Poor %]'])).toEqual([0.1]);
    expect(appliedFilters(v, [select("'g'[Group]", 'Line')])).toHaveLength(1);
  });

  it('a clicked location filters the other visuals by its own column', () => {
    const dax = injectCrossFilters("EVALUATE SUMMARIZECOLUMNS('work_request'[Service_Type], \"Open\", [Open WRs])", [select(WR, 'WR-1')]);
    expect(dax).toContain(`TREATAS({"WR-1"}, ${WR})`);
  });
});
