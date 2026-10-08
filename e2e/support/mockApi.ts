import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { sampleColumnValues, sampleRows, type CrossFilter } from '../../src/lib/manifest/crossFilters';
import { validateManifest } from '../../src/lib/manifest/schema';

interface FakeClass {
  group: string;
  className: string;
  count: number;
  assessed: number;
  due: number;
}

/** A tiny asset register; every visual is computed from it so the numbers stay coherent. */
export const REGISTER: FakeClass[] = [
  { group: 'Utility_Line', className: 'Water_Pipes', count: 1979, assessed: 1840, due: 637 },
  { group: 'Utility_Line', className: 'Sanitary_Pipes', count: 2100, assessed: 1500, due: 0 },
  { group: 'Utility_Line', className: 'Stormwater_Pipes', count: 1372, assessed: 900, due: 0 },
  { group: 'Utility_Point', className: 'Hydrants', count: 1549, assessed: 1200, due: 0 },
  { group: 'Utility_Point', className: 'Valves', count: 1000, assessed: 400, due: 0 },
  { group: 'Core', className: 'Buildings', count: 1200, assessed: 1000, due: 50 },
  { group: 'Transport', className: 'Bridges', count: 500, assessed: 450, due: 0 },
  { group: 'rd_line', className: 'Roads', count: 300, assessed: 100, due: 0 },
];

const match = (query: string, pattern: RegExp) => pattern.exec(query)?.[1];

const sum = (rows: FakeClass[], key: 'count' | 'assessed' | 'due') => rows.reduce((t, r) => t + r[key], 0);
const ratio = (a: number, b: number) => (b ? a / b : null);

/** Measures (and the one expression) the manifest sample uses, computed from the register. */
const MEASURES: Array<[RegExp, (rows: FakeClass[]) => number | null]> = [
  [/^DIVIDE\(\s*\[Assets Due For Renewal\]\s*,\s*\[Asset Count \(All States\)\]\s*\)$/, (r) => ratio(sum(r, 'due'), sum(r, 'count'))],
  [/^DIVIDE\(\s*\[Assets Assessed For Condition\]\s*,\s*\[Asset Count \(All States\)\]\s*\)$/, (r) => ratio(sum(r, 'assessed'), sum(r, 'count'))],
  [/^\[Asset Count \(All States\)\]$/, (r) => sum(r, 'count')],
  [/^\[Assets Assessed For Condition\]$/, (r) => sum(r, 'assessed')],
  [/^\[Assets Due For Renewal\]$/, (r) => sum(r, 'due')],
  [/^\[% Assessed For Condition\]$/, (r) => ratio(sum(r, 'assessed'), sum(r, 'count'))],
  [/^\[Avg Base Life \(Years\)\]$/, () => 42.3],
];

const COLUMNS = {
  "'asset_class_group'[Asset_Class_Group]": { key: 'asset_class_group[Asset_Class_Group]', of: (r: FakeClass) => r.group },
  "'asset_class'[Asset_Class]": { key: 'asset_class[Asset_Class]', of: (r: FakeClass) => r.className },
} as const;

/**
 * Manifest queries (src/lib/manifest, public/manifests/sample-manifest.json): ROW or SUMMARIZECOLUMNS
 * with "Alias", <measure> pairs, optionally inside TOPN, wrapped by the engine's cross-filter
 * injection in CALCULATETABLE(…, TREATAS(…)), with an optional ORDER BY.
 */
function evaluateManifest(query: string, group?: string, className?: string): Record<string, unknown>[] {
  const scoped = REGISTER.filter((r) => (!group || r.group === group) && (!className || r.className === className));
  const measures = [...query.matchAll(/"([^"]+)",\s*(DIVIDE\(\s*\[[^\]]+\]\s*,\s*\[[^\]]+\]\s*\)|\[[^\]]+\])/g)].map(([, alias, expr]) => {
    const found = MEASURES.find(([pattern]) => pattern.test(expr ?? ''));
    if (!found) throw new Error(`Unexpected measure in e2e mock: ${expr}`);
    return { alias: `[${alias}]`, compute: found[1] };
  });
  const summarize = /SUMMARIZECOLUMNS\(([^"]*)"/.exec(query)?.[1] ?? '';
  // In argument order, as executeQueries returns them
  const groupBy = (Object.keys(COLUMNS) as Array<keyof typeof COLUMNS>)
    .filter((c) => summarize.includes(c))
    .sort((a, b) => summarize.indexOf(a) - summarize.indexOf(b))
    .map((c) => COLUMNS[c]);

  const buckets = new Map<string, FakeClass[]>();
  for (const r of groupBy.length ? scoped : [REGISTER[0] as FakeClass]) {
    const id = groupBy.map((c) => c.of(r)).join('|');
    buckets.set(id, [...(buckets.get(id) ?? []), r]);
  }
  let rows = [...buckets.values()].map((members) => {
    const inScope = groupBy.length ? members : scoped;
    const row: Record<string, unknown> = {};
    for (const c of groupBy) row[c.key] = c.of(members[0] as FakeClass);
    for (const m of measures) row[m.alias] = m.compute(inScope);
    return row;
  });

  const top = /TOPN\(\s*(\d+)/.exec(query);
  const byFirst = measures[0]?.alias;
  if (top && byFirst) rows = [...rows].sort((a, b) => Number(b[byFirst]) - Number(a[byFirst])).slice(0, Number(top[1]));
  const orderBy = /ORDER BY (\[[^\]]+\])\s*(DESC)?/.exec(query);
  if (orderBy?.[1]) {
    const key = orderBy[1];
    const dir = orderBy[2] ? -1 : 1;
    rows = [...rows].sort((a, b) => dir * (Number(a[key]) - Number(b[key])));
  }
  return rows;
}

/**
 * The vocabulary manifests (condition-works.json, delivery-lifecycle.json) are answered from their own
 * sample rows: the visual is recognised by its table expression inside the (possibly injected) query,
 * and every TREATAS in the query narrows the rows through the app's Sample-mode logic. Report-filter
 * option queries get the column's sample values (Community, which no sample carries, a short list).
 * Returns null for any other query.
 */
const VOCABULARY_VISUALS = ['condition-works.json', 'delivery-lifecycle.json'].flatMap((file) => {
  const result = validateManifest(JSON.parse(readFileSync(`public/manifests/${file}`, 'utf8')));
  if (!result.ok) throw new Error(`${file} is invalid`);
  return result.manifest.visuals;
});
const squash = (dax: string) => dax.replace(/\s+/g, '');
const tableOf = (dax: string) => squash(dax.replace(/^\s*EVALUATE/i, '').replace(/\s+ORDER BY[\s\S]*$/i, ''));
const COMMUNITIES = ['Falls North', 'Falls South', 'Valley'];

const pad = (n: string) => n.padStart(2, '0');

/** Every TREATAS({…}, column) in a query, as the cross-filters it stands for (DATE(y, m, d) as the engine's date text). */
export function treatAsFilters(query: string): CrossFilter[] {
  return [...query.matchAll(/TREATAS\(\{([^}]*)\},\s*((?:'(?:[^']|'')+'|[A-Za-z_][\w ]*)\[[^\]]+\])\)/g)].map(([, list = '', field = '']) => ({
    field,
    values: [...list.matchAll(/DATE\((\d+),\s*(\d+),\s*(\d+)\)|"((?:[^"]|"")*)"|(-?\d+(?:\.\d+)?)/g)].map(([, y, m, d, text, num]) =>
      y !== undefined ? `${y}-${pad(m ?? '')}-${pad(d ?? '')}T00:00:00` : text !== undefined ? text.replace(/""/g, '"') : Number(num)
    ),
    sourceVisualId: 'engine',
    origin: 'slicer' as const,
  }));
}

function evaluateVocabulary(query: string): Record<string, unknown>[] | null {
  if (/SUMMARIZECOLUMNS\(\s*'asset_register'\[Community\]\s*\)/.test(query)) return COMMUNITIES.map((c) => ({ 'asset_register[Community]': c }));
  // A report filter's options (possibly wrapped by the other filters): SUMMARIZECOLUMNS(column) ORDER BY column
  const options = /SUMMARIZECOLUMNS\(\s*('([^']+)'\[([^\]]+)\])\s*\)[\s\S]*ORDER BY\s+\1\s*$/.exec(query);
  if (options?.[1]) {
    const key = `${options[2]}[${options[3]}]`;
    return sampleColumnValues(VOCABULARY_VISUALS, options[1], treatAsFilters(query)).map((value) => ({ [key]: value }));
  }
  const q = squash(query);
  const visual = VOCABULARY_VISUALS.find((v) => q.includes(tableOf(v.query.dax)));
  return visual ? (sampleRows(visual, treatAsFilters(query)) as Record<string, unknown>[]) : null;
}

/** Interprets just enough of the DAX the app generates to filter the fake register. */
function evaluate(query: string): Record<string, unknown>[] {
  const vocabulary = evaluateVocabulary(query);
  if (vocabulary) return vocabulary;
  const group = match(query, /TREATAS\(\{"([^"]+)"\}, 'asset_class_group'\[Asset_Class_Group\]\)/);
  const className = match(query, /TREATAS\(\{"([^"]+)"\}, 'asset_class'\[Asset_Class\]\)/);
  const search = match(query, /CONTAINSSTRING\('asset_class'\[Asset_Class\], "([^"]*)"\)/);

  // Everything /visuals sends names "TotalAssets" or "AssetCount"; the rest are manifest queries
  if (!/"(TotalAssets|AssetCount)"/.test(query)) return evaluateManifest(query, group, className);

  if (query.includes('"TotalAssets"')) {
    const rows = REGISTER.filter((r) => (!group || r.group === group) && (!className || r.className === className));
    const total = sum(rows, 'count');
    return [
      {
        '[TotalAssets]': total,
        '[TotalAssessed]': sum(rows, 'assessed'),
        '[DueForRenewal]': sum(rows, 'due'),
        '[AvgBaseLife]': 42.3,
        '[PctAssessed]': total ? sum(rows, 'assessed') / total : null,
      },
    ];
  }

  if (/SUMMARIZECOLUMNS\(\s*'asset_class_group'\[Asset_Class_Group\],/.test(query)) {
    const rows = REGISTER.filter((r) => !className || r.className === className);
    const groups = [...new Set(rows.map((r) => r.group))];
    return groups.map((g) => {
      const inGroup = rows.filter((r) => r.group === g);
      return {
        'asset_class_group[Asset_Class_Group]': g,
        '[AssetCount]': sum(inGroup, 'count'),
        '[Assessed]': sum(inGroup, 'assessed'),
        '[DueForRenewal]': sum(inGroup, 'due'),
      };
    });
  }

  if (query.includes('TOPN(')) {
    return REGISTER.filter(
      (r) =>
        (!group || r.group === group) &&
        (!search || r.className.toLowerCase().includes(search.toLowerCase())) &&
        (!query.includes('[DueForRenewal] > 0') || r.due > 0) &&
        (!query.includes('[Assessed] > 0') || r.assessed > 0)
    ).map((r) => ({
      'asset_class[Asset_Class]': r.className,
      '[AssetCount]': r.count,
      '[Assessed]': r.assessed,
      '[DueForRenewal]': r.due,
    }));
  }

  throw new Error(`Unexpected DAX in e2e mock:\n${query}`);
}

export interface DaxRequest {
  query: string;
  workspaceId?: string;
  datasetId?: string;
}

/** Intercepts every /api call the app makes; returns the DAX it received (and the request bodies). */
export async function mockApi(page: Page) {
  const daxQueries: string[] = [];
  const daxRequests: DaxRequest[] = [];

  await page.route('**/api/health', (route) =>
    route.fulfill({
      json: { status: 'ok', configured: true, tenantId: 't', clientId: 'c...', unityDomain: 'https://unity.test' },
    })
  );
  await page.route('**/api/powerbi/preconfigured', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/powerbi/embed-config', (route) =>
    route.fulfill({ status: 403, json: { success: false, error: 'Embedding disabled in e2e', hint: 'mocked' } })
  );
  await page.route('**/api/powerbi/query', async (route) => {
    const body = route.request().postDataJSON() as DaxRequest;
    daxQueries.push(body.query);
    daxRequests.push(body);
    const rows = evaluate(body.query);
    await route.fulfill({ json: { success: true, executionTimeMs: 12, rowCount: rows.length, rows } });
  });

  return { daxQueries, daxRequests };
}
