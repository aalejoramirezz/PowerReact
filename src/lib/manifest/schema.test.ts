import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KPI_ICONS } from '../../../packages/univerus-elements/src/utils/icons';
import { MANIFEST_SCHEMA_FILE, manifestSchemaDocument } from './jsonSchema';
import { KPI_ICON_NAMES, MANIFEST_COMPONENTS, validateManifest, validateManifestText, type ManifestInput } from './schema';

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
    const groups = result.manifest.visuals.find((v) => v.id === 'groups');
    expect(groups?.grid.rowSpan).toBe(1);
    expect(groups?.crossFilter).toEqual({ field: "'asset_class_group'[Asset_Class_Group]", emit: true, respect: true });
    expect(groups?.props.focusMode).toBe(true);
    expect(result.manifest.layout).toEqual({ columns: 12, rowMinHeight: 120 });
    const classes = result.manifest.visuals.find((v) => v.id === 'classes');
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

  it('lists the ten components', () => {
    expect(MANIFEST_COMPONENTS).toHaveLength(10);
  });

  it('names exactly the icons the KPI element can draw', () => {
    expect([...KPI_ICON_NAMES].sort()).toEqual(Object.keys(KPI_ICONS).sort());
  });

  it('the published JSON Schema is in sync (npm run manifest:schema)', () => {
    expect(readFileSync(MANIFEST_SCHEMA_FILE, 'utf8').replace(/\r\n/g, '\n')).toBe(manifestSchemaDocument());
  });
});
