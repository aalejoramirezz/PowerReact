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

/** Interprets just enough of the DAX the app generates to filter the fake register. */
function evaluate(query: string): Record<string, unknown>[] {
  const group = match(query, /TREATAS\(\{"([^"]+)"\}, 'asset_class_group'\[Asset_Class_Group\]\)/);
  const className = match(query, /TREATAS\(\{"([^"]+)"\}, 'asset_class'\[Asset_Class\]\)/);
  const search = match(query, /CONTAINSSTRING\('asset_class'\[Asset_Class\], "([^"]*)"\)/);

  const sum = (rows: FakeClass[], key: 'count' | 'assessed' | 'due') => rows.reduce((t, r) => t + r[key], 0);

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

/** Intercepts every /api call the app makes; returns the DAX it received. */
export async function mockApi(page: Page) {
  const daxQueries: string[] = [];

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
    const { query } = route.request().postDataJSON() as { query: string };
    daxQueries.push(query);
    const rows = evaluate(query);
    await route.fulfill({ json: { success: true, executionTimeMs: 12, rowCount: rows.length, rows } });
  });

  return { daxQueries };
}
