import { renderToString } from '@powerreact/univerus-elements/hydrate';
import { describe, expect, it } from 'vitest';
import {
  COST_AC_VS_PLAN,
  EFFICIENCY_VS_TARGET,
  MONTHS,
  NET_FLOW_BY_SITE,
  RENEWALS_AC_VS_PY,
  REQUESTS_BY_CHANNEL,
  SERVICE_REQUESTS,
  WORK_ORDERS_BY_DEPARTMENT,
} from './__fixtures__/samples';

/**
 * Server-side smoke tests of the Univerus web components through Stencil's hydrate renderer
 * (the same render code the browser runs). Array / object props are set before hydration.
 */
async function render(tag: string, props: Record<string, unknown> = {}): Promise<string> {
  const { html, diagnostics } = await renderToString(`<${tag}></${tag}>`, {
    prettyHtml: false,
    beforeHydrate(doc: Document) {
      Object.assign(doc.querySelector(tag) as object, props);
    },
  });
  expect(diagnostics.filter((d) => d.level === 'error')).toEqual([]);
  // Markup only: the inlined <style> of the shadow root is not what these tests are about
  return (html ?? '').replace(/<style[\s\S]*?<\/style>/g, '');
}

const count = (html: string, pattern: RegExp) => html.match(pattern)?.length ?? 0;

describe('charts render server-side with sample data', () => {
  it('spotlight bars show shares over every category and the rank', async () => {
    const out = await render('univerus-spotlight-bars', { heading: 'x', data: WORK_ORDERS_BY_DEPARTMENT, rank: true, topN: 3 });
    expect(out).toContain('#1');
    expect(out).toContain('26.2%');
    expect(count(out, /<li[\s>]/g)).toBe(3);
  });

  it('spotlight bars can show the share in parentheses and quiet meta lines', async () => {
    const data = WORK_ORDERS_BY_DEPARTMENT.slice(0, 2).map((d) => ({ ...d, meta: [{ label: 'Due', value: '637', tone: 'warn' }] }));
    const out = await render('univerus-spotlight-bars', { heading: 'x', data, secondary: 'share-paren', testIdPrefix: 'dept' });
    expect(out).toContain('data-testid="dept-share-Water"');
    expect(out).toMatch(/\(55\.1%\)/);
    expect(out).toContain('data-tone="warn"');
  });

  it('ranking bars note hidden categories', async () => {
    expect(await render('univerus-ranking-bars', { heading: 'x', data: WORK_ORDERS_BY_DEPARTMENT, topN: 5 })).toContain('Top 5 of 8');
  });

  it('bullet bars colour the variance chip by meaning', async () => {
    const out = await render('univerus-bullet-bars', { heading: 'x', data: EFFICIENCY_VS_TARGET });
    expect(out).toContain('data-tone="ok"');
    expect(out).toContain('data-tone="bad"');
  });

  it('diverging bars label both directions', async () => {
    const out = await render('univerus-diverging-bars', { heading: 'x', data: NET_FLOW_BY_SITE, negativeLabel: 'Out', positiveLabel: 'In' });
    expect(out).toContain('← Out');
    expect(out).toContain('In →');
    expect(out).toContain('−41');
  });

  it('the donut shows the total in the hole', async () => {
    expect(await render('univerus-donut', { heading: 'x', data: REQUESTS_BY_CHANNEL, centerLabel: 'requests' })).toContain('2,760');
  });

  it('the trend chart labels the series directly', async () => {
    const out = await render('univerus-trend-chart', { heading: 'x', categories: MONTHS, series: SERVICE_REQUESTS });
    expect(out).toContain('Received');
    expect(out).toContain('2,880');
  });

  it('IBCS variance titles its panels with scenario and unit', async () => {
    const horizontal = await render('univerus-ibcs-variance', { heading: 'x', data: RENEWALS_AC_VS_PY, scenario: 'PY' });
    expect(horizontal).toContain('AC vs PY');
    expect(horizontal).toContain('ΔPY%');
    const vertical = await render('univerus-ibcs-variance', {
      heading: 'x',
      data: COST_AC_VS_PLAN,
      orientation: 'vertical',
      scenario: 'PL',
      goodWhen: 'lower',
    });
    expect(vertical).toContain('AC vs PL · K');
  });

  it.each([
    ['univerus-spotlight-bars', { data: [] }],
    ['univerus-ranking-bars', { data: [] }],
    ['univerus-bullet-bars', { data: [] }],
    ['univerus-diverging-bars', { data: [] }],
    ['univerus-donut', { data: [] }],
    ['univerus-trend-chart', { categories: [], series: [] }],
    ['univerus-data-table', { rows: [] }],
  ])('%s renders an empty state with no data', async (tag, props) => {
    expect(await render(tag, { heading: 'x', ...props })).toContain('No data for the current selection.');
  });

  it('IBCS variance renders an empty state with the same geometry', async () => {
    expect(await render('univerus-ibcs-variance', { heading: 'x', data: [] })).toContain('No data for the current selection.');
  });

  it('loading and error states keep the card', async () => {
    expect(await render('univerus-ranking-bars', { heading: 'x', loading: true })).toContain('u-skeleton');
    expect(await render('univerus-ranking-bars', { heading: 'x', error: 'Column not found' })).toContain('Column not found');
  });
});

describe('the standard frame', () => {
  it('exposes Export, Table, Focus and the ⓘ curtain, closed by default', async () => {
    const out = await render('univerus-ranking-bars', { heading: 'T', info: 'Means X.', calc: 'Y', data: WORK_ORDERS_BY_DEPARTMENT });
    expect(out).toContain('aria-label="Export data"');
    expect(out).toContain('aria-label="Table view"');
    expect(out).toContain('aria-label="Focus view"');
    expect(out).toContain('aria-label="What this chart means"');
    expect(out).toContain('aria-expanded="false"');
    expect(out).toContain('data-open="false"');
    expect(out).toContain('<dialog');
  });

  it('drops the tools a container switches off', async () => {
    const out = await render('univerus-ranking-bars', { heading: 'T', data: WORK_ORDERS_BY_DEPARTMENT, exportable: false, focusable: false, tableToggle: false });
    expect(out).not.toContain('Export data');
    expect(out).not.toContain('Table view');
    expect(out).not.toContain('<dialog');
  });

  it('the theme prop pins the template on the host', async () => {
    expect(await render('univerus-donut', { heading: 'x', data: REQUESTS_BY_CHANNEL, theme: 'nocturne' })).toContain('data-theme="nocturne"');
  });
});

describe('data table', () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ name: `C${i}`, count: 1000 + i, due: i % 2 }));
  const columns = [
    { key: 'name', label: 'Asset Class' },
    { key: 'count', label: 'Inventory', kind: 'number' },
    { key: 'due', label: 'Renewals', kind: 'status', suffix: 'due', emptyLabel: 'None due' },
  ];

  it('renders sortable headers, the first page and the pager', async () => {
    const out = await render('univerus-data-table', { heading: 'Classes', columns, rows, crossFilterField: "'t'[C]", selectedValue: 'C3' });
    expect(out).toContain('aria-sort="none"');
    expect(count(out, /<tr[\s>]/g)).toBe(11);
    expect(out).toContain('1–10 of 12');
    expect(out).toContain('aria-selected="true"');
    expect(out).toContain('1 due');
    expect(out).toContain('aria-label="None due"');
  });

  it('lists every row without pagination when asked', async () => {
    expect(count(await render('univerus-data-table', { heading: 'x', columns, rows, paginated: false }), /<tr[\s>]/g)).toBe(13);
  });
});

describe('KPIs carry the curtain', () => {
  const button = (html: string) => /<button[^>]*class="[^"]*kpi-body[^"]*"[^>]*>/.exec(html)?.[0] ?? '';

  it('the KPI card describes itself with "What it means" and the calculation', async () => {
    const out = await render('univerus-kpi-card', { heading: 'Total Assets', value: 10000, info: 'Assets in scope.', calc: '[Asset Count]', interactive: true });
    expect(out).toContain('What it means');
    expect(out).toContain('10,000');
    expect(out).toContain('data-testid="kpi-total-assets"');
    expect(out).toContain('data-testid="kpi-card-total-assets"');
    expect(button(out)).toContain('aria-describedby');
    // A plain action (no `active`) has no pressed state; touch screens get an ⓘ for the curtain
    expect(button(out)).not.toContain('aria-pressed');
    expect(out).toContain('aria-label="What Total Assets means"');
  });

  it('exposes its toggle state only when it is a toggle', async () => {
    expect(button(await render('univerus-kpi-card', { heading: 'Due', value: 1, active: false }))).toContain('aria-pressed="false"');
    expect(button(await render('univerus-kpi-card', { heading: 'Due', value: 1, active: true }))).toContain('aria-pressed="true"');
  });

  it('shows a placeholder while loading, a dash on error and derives the delta', async () => {
    expect(await render('univerus-kpi-card', { heading: 'X', loading: true })).toContain('>…<');
    expect(await render('univerus-kpi-card', { heading: 'X', error: 'boom' })).toContain('>—<');
    const out = await render('univerus-kpi-card', { heading: 'X', value: 110, comparisonValue: 100, deltaLabel: 'vs PY', goodWhen: 'lower' });
    expect(out).toContain('↑ 10.0% vs PY');
    expect(out).toContain('data-favourable="false"');
  });

  it('the hero renders the 60-tick meter', async () => {
    const out = await render('univerus-kpi-hero', { heading: 'SLA', displayValue: '94.2', meter: { label: 'Crew', value: 0.81 } });
    expect(count(out, /<i[\s>]/g)).toBe(60);
    expect(out).toContain('aria-valuenow="81"');
  });
});
