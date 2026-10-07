import type { Page } from '@playwright/test';

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

/** Interprets just enough of the DAX the app generates to filter the fake register. */
function evaluate(query: string): Record<string, unknown>[] {
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
