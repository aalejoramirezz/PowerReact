import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KPI_ICONS } from '../../../packages/udp-powerbi-visuals/src/utils/icons';
import { MANIFEST_SCHEMA_FILE, manifestSchemaDocument } from './jsonSchema';
import { KPI_ICON_NAMES, MANIFEST_COMPONENTS, validateManifest, validateManifestText, type ManifestInput, type VisualOf } from './schema';

const sample = JSON.parse(readFileSync('public/manifests/sample-manifest.json', 'utf8')) as ManifestInput;
const clone = (): ManifestInput => structuredClone(sample);

const issuesOf = (input: unknown) => {
  const result = validateManifest(input);
  return result.ok ? [] : result.issues;
};

describe('manifest schema', () => {
  it('accepts the bundled sample manifest', () => {
    const result = validateManifest(sample);
    expect(result.ok ? [] : result.issues).toEqual([]);
  });

  it('fills defaults: row span, cross-filter emit / respect, export, layout', () => {
    const input = clone();
    delete input.layout;
    const result = validateManifest(input);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    const groups = result.manifest.visuals.find((v) => v.id === 'groups') as VisualOf<'UniverusSpotlightBars'> | undefined;
    expect(groups?.grid.rowSpan).toBe(1);
    expect(groups?.crossFilter).toEqual({ field: "'asset_class_group'[Asset_Class_Group]", emit: true, respect: true });
    expect(groups?.props.focusMode).toBe(true);
    expect(result.manifest.layout).toEqual({ columns: 12, rowMinHeight: 120 });
    const classes = result.manifest.visuals.find((v) => v.id === 'classes') as VisualOf<'UniverusDataTable'> | undefined;
    expect(classes?.props.export).toEqual({ csv: true, xlsx: true, fileName: 'asset-classes', source: 'query' });
  });

  it('reports every problem with its path', () => {
    const input = clone() as unknown as { visuals: Array<Record<string, unknown>>; dataSource: Record<string, unknown> };
    (input.visuals[2] as { grid: { colSpan: number } }).grid.colSpan = 13;
    input.visuals[3] = { ...input.visuals[3], id: 'kpi-total' };
    (input.visuals[4] as { query: { dax: string } }).query.dax = 'ROW("x", 1)';
    input.dataSource.semanticModelId = 'not-a-guid';
    const paths = issuesOf(input).map((i) => i.path);
    expect(paths).toEqual(expect.arrayContaining(['visuals[2].grid.colSpan', 'visuals[3].id', 'visuals[4].query.dax', 'dataSource.semanticModelId']));
    const messages = issuesOf(input).map((i) => i.message).join(' | ');
    expect(messages).toMatch(/Duplicate visual id "kpi-total"/);
    expect(messages).toMatch(/Exactly one top-level EVALUATE/);
  });

  it('rejects unknown components, misspelt keys and malformed references', () => {
    const input = clone() as unknown as { visuals: Array<Record<string, unknown>> };
    input.visuals[0] = { ...input.visuals[0], component: 'UniverusPie' };
    (input.visuals[1] as { grid: Record<string, unknown> }).grid = { colspan: 3 };
    (input.visuals[5] as { fields: Record<string, unknown> }).fields = { category: 'asset_class_group', value: '[Group Assets]' };
    const issues = issuesOf(input);
    expect(issues.find((i) => i.path.startsWith('visuals[0]'))).toBeDefined();
    expect(issues.map((i) => i.path)).toEqual(expect.arrayContaining(['visuals[1].grid', 'visuals[5].fields.category']));
    expect(issues.find((i) => i.path === 'visuals[5].fields.category')?.message).toMatch(/column reference/);
  });

  it('reports JSON syntax errors as an issue', () => {
    const result = validateManifestText('{ "schemaVersion": 1, ');
    expect(result).toMatchObject({ ok: false, issues: [{ path: '(root)', message: expect.stringMatching(/^Not valid JSON/) }] });
  });

  it('lists the twenty visuals and the slicer', () => {
    expect(MANIFEST_COMPONENTS).toHaveLength(21);
    expect(MANIFEST_COMPONENTS).toEqual(
      expect.arrayContaining([
        'UniverusColumnChart',
        'UniverusStackedBars',
        'UniverusScatter',
        'UniverusMatrix',
        'UniverusWaterfall',
        'UniverusTreemap',
        'UniverusCalendarHeatmap',
        'UniverusDotPlot',
        'UniverusTimeline',
        'UniverusBoxplot',
        'UniverusSlicer',
      ])
    );
  });

  it('a boxplot takes the statistics or raw values, a timeline an ISO "today", a treemap at most two levels', () => {
    const withVisual = (visual: Record<string, unknown>) =>
      validateManifest({ ...clone(), visuals: [{ id: 'v', grid: { colSpan: 6 }, query: { dax: 'EVALUATE ROW("x", 1)' }, ...visual }] });
    const box = (fields: Record<string, unknown>) => withVisual({ component: 'UniverusBoxplot', fields, props: { title: 'Box' } });
    expect(box({ category: "'g'[Group]", q1: '[Q1]', median: '[Median]', q3: '[Q3]' }).ok).toBe(true);
    expect(box({ category: "'g'[Group]", value: "'a'[Condition]" }).ok).toBe(true);
    expect(box({ category: "'g'[Group]", median: '[Median]' }).ok).toBe(false);
    expect(box({ category: "'g'[Group]", value: "'a'[Condition]", q1: '[Q1]', median: '[Median]', q3: '[Q3]' }).ok).toBe(false);
    const timeline = (today: unknown) => withVisual({ component: 'UniverusTimeline', fields: { item: '[Asset]', start: '[Start]' }, props: { title: 'T', today } });
    expect(timeline('2026-10-07').ok).toBe(true);
    expect(timeline('none').ok).toBe(true);
    expect(timeline('next week').ok).toBe(false);
    const treemap = (levels: string[]) => withVisual({ component: 'UniverusTreemap', fields: { levels, value: '[Assets]' }, props: { title: 'T' } });
    expect(treemap(["'g'[Group]", "'c'[Class]"]).ok).toBe(true);
    expect(treemap(["'g'[Group]", "'c'[Class]", "'a'[Asset]"]).ok).toBe(false);
  });

  it('accepts a series in one of its two shapes, and engine totals one flag per row level', () => {
    const base = clone();
    const withVisual = (visual: Record<string, unknown>) =>
      validateManifest({ ...base, visuals: [{ id: 'v', grid: { colSpan: 6 }, query: { dax: 'EVALUATE ROW("x", 1)' }, ...visual }] });
    const column = (fields: Record<string, unknown>) => withVisual({ component: 'UniverusColumnChart', fields, props: { title: 'Columns' } });
    expect(column({ category: "'d'[Year]", value: '[Need]' }).ok).toBe(true);
    expect(column({ category: "'d'[Year]", series: "'s'[Status]", value: '[WRs]' }).ok).toBe(true);
    expect(column({ category: "'d'[Year]", values: [{ field: '[Need]', label: 'Need' }, { field: '[Budget]', label: 'Budget' }] }).ok).toBe(true);
    expect(column({ category: "'d'[Year]" }).ok).toBe(false);
    expect(column({ category: "'d'[Year]", value: '[Need]', values: [{ field: '[Budget]', label: 'Budget' }] }).ok).toBe(false);
    const matrix = (fields: Record<string, unknown>) => withVisual({ component: 'UniverusMatrix', fields, props: { title: 'Matrix' } });
    const values = [{ field: '[Assets]', label: 'Assets', heatmap: 'sequential' }];
    expect(matrix({ rows: ["'a'[Criticality]"], column: "'a'[Condition]", values, rowTotals: ['[IsCritTotal]'], columnTotal: '[IsCondTotal]' }).ok).toBe(true);
    expect(matrix({ rows: ["'g'[Group]", "'c'[Class]"], values, rowTotals: ['[IsGroupTotal]'] }).ok).toBe(false);
  });

  it('names exactly the icons the KPI element can draw', () => {
    expect([...KPI_ICON_NAMES].sort()).toEqual(Object.keys(KPI_ICONS).sort());
  });

  it('the published JSON Schema is in sync (npm run manifest:schema)', () => {
    expect(readFileSync(MANIFEST_SCHEMA_FILE, 'utf8').replace(/\r\n/g, '\n')).toBe(manifestSchemaDocument());
  });
});
