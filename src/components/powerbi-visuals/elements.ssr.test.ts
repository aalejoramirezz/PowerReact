import { readFileSync } from 'node:fs';
import { renderToString } from '@powerreact/udp-powerbi-visuals/hydrate';
import { describe, expect, it } from 'vitest';
import {
  AGEING_BINS,
  ASSET_GROUPS,
  ASSET_GROWTH_BY_COUNTRY,
  ASSET_LOCATIONS,
  BACKLOG_BRIDGE,
  BACKLOG_BY_CREW,
  BACKLOG_TREND,
  CLASS_RISK_POINTS,
  CONDITION_BY_GROUP,
  CONDITION_DISTRIBUTION,
  CONDITION_GRADES,
  COST_AC_VS_PLAN,
  EFFICIENCY_VS_TARGET,
  FINANCIAL_BRIDGE,
  MONTHS,
  MONTH_CATEGORIES,
  NET_FLOW_BY_SITE,
  OPEN_REQUESTS_AGEING,
  PORTFOLIO_MEASURES,
  PORTFOLIO_TOTAL,
  PORTFOLIO_TREE,
  POOR_CONDITION_BY_REGION,
  PORTFOLIO_TREEMAP,
  RENEWALS_AC_VS_PY,
  RENEWAL_NEED_VS_BUDGET,
  RENEWAL_YEARS,
  REQUESTS_BY_CHANNEL,
  REQUESTS_BY_DAY,
  REQUESTS_RAISED_TREND,
  RISK_MATRIX,
  RISK_MEASURES,
  RISK_TOTAL,
  SERVICE_CENTRES,
  SERVICE_REQUESTS,
  SERVICE_SITES,
  WARRANTIES,
  WARRANTY_TODAY,
  WORK_ORDERS_BY_DEPARTMENT,
  WORK_REQUESTS_BY_STATUS,
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
/** Elements carrying a class token, wherever Stencil puts it in the attribute. */
const withClass = (name: string) => new RegExp(`class="(?:[^"]* )?${name}(?: [^"]*)?"`, 'g');

describe('charts render server-side with sample data', () => {
  it('spotlight bars show shares over every category and the rank', async () => {
    const out = await render('udp-pbi-spotlight-bars', { heading: 'x', data: WORK_ORDERS_BY_DEPARTMENT, rank: true, topN: 3 });
    expect(out).toContain('#1');
    expect(out).toContain('26.2%');
    expect(count(out, /<li[\s>]/g)).toBe(3);
  });

  it('spotlight bars can show the share in parentheses and quiet meta lines', async () => {
    const data = WORK_ORDERS_BY_DEPARTMENT.slice(0, 2).map((d) => ({ ...d, meta: [{ label: 'Due', value: '637', tone: 'warn' }] }));
    const out = await render('udp-pbi-spotlight-bars', { heading: 'x', data, secondary: 'share-paren', testIdPrefix: 'dept' });
    expect(out).toContain('data-testid="dept-share-Water"');
    expect(out).toMatch(/\(55\.1%\)/);
    expect(out).toContain('data-tone="warn"');
  });

  it('ranking bars note hidden categories', async () => {
    expect(await render('udp-pbi-ranking-bars', { heading: 'x', data: WORK_ORDERS_BY_DEPARTMENT, topN: 5 })).toContain('Top 5 of 8');
  });

  it('bullet bars colour the variance chip by meaning', async () => {
    const out = await render('udp-pbi-bullet-bars', { heading: 'x', data: EFFICIENCY_VS_TARGET });
    expect(out).toContain('data-tone="ok"');
    expect(out).toContain('data-tone="bad"');
  });

  it('diverging bars label both directions', async () => {
    const out = await render('udp-pbi-diverging-bars', { heading: 'x', data: NET_FLOW_BY_SITE, negativeLabel: 'Out', positiveLabel: 'In' });
    expect(out).toContain('← Out');
    expect(out).toContain('In →');
    expect(out).toContain('−41');
  });

  it('the donut shows the total in the hole', async () => {
    expect(await render('udp-pbi-donut', { heading: 'x', data: REQUESTS_BY_CHANNEL, centerLabel: 'requests' })).toContain('2,760');
  });

  it('the trend chart labels the series directly', async () => {
    const out = await render('udp-pbi-trend-chart', { heading: 'x', categories: MONTHS, series: SERVICE_REQUESTS });
    expect(out).toContain('Received');
    expect(out).toContain('2,880');
  });

  it('IBCS variance titles its panels with scenario and unit', async () => {
    const horizontal = await render('udp-pbi-ibcs-variance', { heading: 'x', data: RENEWALS_AC_VS_PY, scenario: 'PY' });
    expect(horizontal).toContain('AC vs PY');
    expect(horizontal).toContain('ΔPY%');
    const vertical = await render('udp-pbi-ibcs-variance', {
      heading: 'x',
      data: COST_AC_VS_PLAN,
      orientation: 'vertical',
      scenario: 'PL',
      goodWhen: 'lower',
    });
    expect(vertical).toContain('AC vs PL · K');
  });

  it.each([
    ['udp-pbi-spotlight-bars', { data: [] }],
    ['udp-pbi-ranking-bars', { data: [] }],
    ['udp-pbi-bullet-bars', { data: [] }],
    ['udp-pbi-diverging-bars', { data: [] }],
    ['udp-pbi-donut', { data: [] }],
    ['udp-pbi-trend-chart', { categories: [], series: [] }],
    ['udp-pbi-data-table', { rows: [] }],
  ])('%s renders an empty state with no data', async (tag, props) => {
    expect(await render(tag, { heading: 'x', ...props })).toContain('No data for the current selection.');
  });

  it('IBCS variance renders an empty state with the same geometry', async () => {
    expect(await render('udp-pbi-ibcs-variance', { heading: 'x', data: [] })).toContain('No data for the current selection.');
  });

  it('loading and error states keep the card', async () => {
    expect(await render('udp-pbi-ranking-bars', { heading: 'x', loading: true })).toContain('u-skeleton');
    expect(await render('udp-pbi-ranking-bars', { heading: 'x', error: 'Column not found' })).toContain('Column not found');
  });
});

describe('the extended vocabulary renders server-side', () => {
  it('the column chart stacks series, labels totals and keys every segment', async () => {
    const out = await render('udp-pbi-column-chart', { heading: 'x', categories: MONTH_CATEGORIES, series: WORK_REQUESTS_BY_STATUS, testIdPrefix: 'wr' });
    expect(out).toContain('data-testid="wr-mark-Oct-Closed"');
    expect(count(out, /class="u-legend\b/g)).toBe(1);
    expect(out).toContain('>31<');
  });

  it('a histogram draws one bar per bin without a legend', async () => {
    const out = await render('udp-pbi-column-chart', { heading: 'x', categories: AGEING_BINS, series: OPEN_REQUESTS_AGEING, variant: 'histogram', testIdPrefix: 'age' });
    expect(count(out, /data-testid="age-mark-/g)).toBe(7);
    expect(out).not.toContain('u-legend');
  });

  it('diverging stacked bars put the shares at both ends', async () => {
    const out = await render('udp-pbi-stacked-bars', { heading: 'x', categories: ASSET_GROUPS, series: CONDITION_BY_GROUP, layout: 'diverging', palette: 'diverging', negativeSeries: ['Very Poor', 'Poor'], neutralSeries: ['Fair'], testIdPrefix: 'cp' });
    expect(count(out, /class="sb-end sb-end--neg\b/g)).toBe(5);
    expect(out).toContain('data-testid="cp-mark-Core-Fair"');
    expect(out).toContain('var(--pbi-div-');
  });

  it('the matrix is a treegrid with engine totals, heat cells and collapsed groups', async () => {
    const risk = await render('udp-pbi-matrix', { heading: 'x', nodes: RISK_MATRIX, columns: CONDITION_GRADES, measures: RISK_MEASURES, grandTotal: RISK_TOTAL, testIdPrefix: 'risk' });
    expect(risk).toContain('role="treegrid"');
    expect(count(risk, /data-heat="true"/g)).toBe(25);
    expect(risk).toContain('9,220');
    const tree = await render('udp-pbi-matrix', { heading: 'x', nodes: PORTFOLIO_TREE, measures: PORTFOLIO_MEASURES, grandTotal: PORTFOLIO_TOTAL });
    expect(count(tree, /<tr[^>]*aria-expanded="false"/g)).toBe(5);
    expect(tree).not.toContain('Water_Pipes');
  });

  it('the scatter labels its quadrants and the largest points', async () => {
    const out = await render('udp-pbi-scatter', { heading: 'x', points: CLASS_RISK_POINTS, xReference: { value: 3 }, yReference: { value: 3 }, quadrantLabels: ['Watch', 'Act now', 'Low priority', 'Maintain'], labelTop: 3 });
    expect(out).toContain('Act now');
    expect(count(out, /class="sc-label\b/g)).toBeGreaterThanOrEqual(1);
    expect(count(out, /<circle/g)).toBe(12);
  });

  it.each(['udp-pbi-column-chart', 'udp-pbi-stacked-bars', 'udp-pbi-matrix', 'udp-pbi-scatter'])('%s renders an empty state', async (tag) => {
    expect(await render(tag, { heading: 'x', emptyMessage: 'Nothing here' })).toContain('Nothing here');
  });

  it('frame="none" drops the card, header and toolbar but keeps the visual', async () => {
    const out = await render('udp-pbi-column-chart', { heading: 'Requests', frame: 'none', categories: MONTH_CATEGORIES, series: WORK_REQUESTS_BY_STATUS });
    expect(out).toMatch(/class="u-plot\b/);
    expect(out).not.toContain('u-card');
    expect(out).not.toContain('Export data');
    expect(out).toContain('aria-label="Requests"');
  });
});

describe('flows, hierarchies, calendars, lifecycles and distributions render server-side', () => {
  it('the waterfall draws one bar per step with signed labels and connectors', async () => {
    const out = await render('udp-pbi-waterfall', { heading: 'x', steps: BACKLOG_BRIDGE, goodWhen: 'lower', testIdPrefix: 'wf' });
    expect(count(out, withClass('wf-bar'))).toBe(BACKLOG_BRIDGE.length);
    expect(out).toContain('wf-connectors');
    expect(out).toContain('+48');
    expect(out).toContain('−30');
    expect(out).toContain('data-testid="wf-step-raised"');
  });

  it('a waterfall on an auto baseline marks its levels as broken', async () => {
    const out = await render('udp-pbi-waterfall', { heading: 'x', steps: FINANCIAL_BRIDGE, orientation: 'horizontal', baseline: 'auto' });
    expect(count(out, withClass('wf-break'))).toBe(2);
    expect(out).toContain('Closing book value');
  });

  it('the treemap nests items under labelled groups', async () => {
    const out = await render('udp-pbi-treemap', { heading: 'x', nodes: PORTFOLIO_TREEMAP, testIdPrefix: 'tm' });
    expect(count(out, withClass('tm-group'))).toBe(PORTFOLIO_TREEMAP.length);
    expect(count(out, withClass('tm-tile'))).toBe(PORTFOLIO_TREEMAP.flatMap((g) => g.children ?? []).length);
    expect(out).toContain('Core · 2,620');
  });

  it('the calendar heatmap draws whole months of days with a legend', async () => {
    const out = await render('udp-pbi-calendar-heatmap', { heading: 'x', days: REQUESTS_BY_DAY, testIdPrefix: 'cal' });
    expect(count(out, withClass('cal-day'))).toBeGreaterThanOrEqual(REQUESTS_BY_DAY.length);
    expect(out).toContain('data-testid="cal-day-2026-02-02"');
    for (const text of ['Mon', 'Less', 'More', 'No data']) expect(out).toContain(`>${text}<`);
  });

  it('the dot plot draws a hollow and a solid dot per row, with its legend', async () => {
    const out = await render('udp-pbi-dot-plot', { heading: 'x', items: BACKLOG_BY_CREW, fromLabel: '30 days ago', toLabel: 'Now' });
    expect(count(out, withClass('dp-row'))).toBe(BACKLOG_BY_CREW.length);
    expect(count(out, withClass('dp-dot--from'))).toBe(BACKLOG_BY_CREW.length);
    expect(count(out, withClass('dp-dot--to'))).toBe(BACKLOG_BY_CREW.length);
    expect(count(out, withClass('dp-swatch--from'))).toBe(1);
    expect(out).toContain('>30 days ago<');
  });

  it('the timeline places items in lanes with a today line', async () => {
    const lanes = new Set(WARRANTIES.map((t) => t.lane)).size;
    const out = await render('udp-pbi-timeline', { heading: 'x', tasks: WARRANTIES, today: WARRANTY_TODAY });
    expect(count(out, withClass('tl-item'))).toBe(WARRANTIES.length);
    expect(count(out, withClass('tl-lane'))).toBe(lanes);
    expect(out).toContain('tl-today');
    const none = await render('udp-pbi-timeline', { heading: 'x', tasks: WARRANTIES, today: 'none' });
    expect(none).not.toContain('tl-today');
  });

  it('the boxplot draws whiskers, box, median, mean and outliers', async () => {
    const out = await render('udp-pbi-boxplot', { heading: 'x', items: CONDITION_DISTRIBUTION });
    for (const part of ['bx-whisker', 'bx-box', 'bx-median', 'bx-mean']) expect(count(out, withClass(part))).toBe(CONDITION_DISTRIBUTION.length);
    expect(count(out, withClass('bx-outlier'))).toBeGreaterThan(0);
    const plain = await render('udp-pbi-boxplot', { heading: 'x', items: CONDITION_DISTRIBUTION, showMean: false });
    expect(plain).not.toContain('bx-mean');
  });

  it('the trend shades the gap and draws reference lines; the ranking can be a lollipop', async () => {
    const series = RENEWAL_NEED_VS_BUDGET.map((s, i) => ({ id: s.id, label: s.label, role: i ? 'comparison' : 'primary', values: s.values }));
    const trend = await render('udp-pbi-trend-chart', {
      heading: 'x',
      categories: RENEWAL_YEARS.map((y) => y.label),
      series,
      gap: true,
      referenceLines: [{ value: 4.675e6, label: 'Avg need' }],
    });
    expect(trend).toContain('tc-gap');
    expect(trend).toContain('Avg need');
    const lollipop = await render('udp-pbi-ranking-bars', { heading: 'x', data: WORK_ORDERS_BY_DEPARTMENT, mark: 'lollipop' });
    expect(count(lollipop, /data-mark="lollipop"/g)).toBeGreaterThan(0);
  });

  it.each(['udp-pbi-waterfall', 'udp-pbi-treemap', 'udp-pbi-calendar-heatmap', 'udp-pbi-dot-plot', 'udp-pbi-timeline', 'udp-pbi-boxplot'])(
    '%s renders an empty state inside its card',
    async (tag) => {
      const out = await render(tag, { heading: 'x' });
      expect(out).toContain('u-card');
      expect(out).toContain('No data for the current selection.');
    }
  );
});

describe('KPI variants render server-side', () => {
  it('the trend KPI heads with the latest period, its delta and the sparkline', async () => {
    const out = await render('udp-pbi-kpi-trend', { heading: 'Requests raised', series: REQUESTS_RAISED_TREND, periodLabel: 'Last 12 months' });
    expect(out).toContain('data-testid="kpi-requests-raised"');
    for (const text of ['>380<', '↑ 5.0% vs Aug', 'Sep · 380', 'Last 12 months']) expect(out).toContain(text);
    for (const part of ['kt-area', 'kt-line', 'kt-last']) expect(count(out, withClass(part))).toBe(1);
    expect(count(out, withClass('kt-extreme'))).toBe(2);
    const target = await render('udp-pbi-kpi-trend', { heading: 'Backlog', series: BACKLOG_TREND, target: 300, goodWhen: 'lower' });
    expect(count(target, withClass('kt-target'))).toBe(1);
    expect(target).toContain('Target 300');
  });

  it('the bullet KPI states the gap to target in points and colours it by band', async () => {
    const out = await render('udp-pbi-kpi-bullet', {
      heading: 'SLA compliance',
      value: 0.942,
      target: 0.95,
      thresholds: [0.85, 0.92],
      forecast: 0.948,
      format: { style: 'percent', decimals: 1 },
    });
    expect(out).toContain('0.8 pp below target');
    expect(out).toContain('data-tone="warn"');
    expect(count(out, withClass('kb-band'))).toBe(3);
    for (const tick of ['>0%<', '>50%<', '>100%<']) expect(out).toContain(tick);
    expect(out).toContain('aria-label="SLA compliance 94.2%, target 95.0%, forecast 94.8%, 0.8 pp below target"');
  });

  it('the variance KPI shows AC, the scenario and both variances in IBCS notation', async () => {
    const out = await render('udp-pbi-kpi-variance', { heading: 'Maintenance cost', actual: 1.284e6, comparison: 1.19e6, scenario: 'PL', comparisonLabel: 'Plan', goodWhen: 'lower', format: { style: 'compact' } });
    for (const text of ['>ΔPL<', '>+94K<', '>ΔPL%<', '>+7.9%<']) expect(out).toContain(text);
    expect(out).toContain('unfavourable');
    expect(count(out, withClass('kv-row'))).toBe(4);
  });

  it.each(['udp-pbi-kpi-trend', 'udp-pbi-kpi-bullet', 'udp-pbi-kpi-variance'])('%s shows a dash without a value', async (tag) => {
    const out = await render(tag, { heading: 'Empty KPI' });
    expect(out).toContain('data-testid="kpi-empty-kpi"');
    // Hydrate leaves a text-node marker before the dash
    expect(out).toMatch(/data-testid="kpi-empty-kpi"[^>]*>(<!--[^>]*-->)?—</);
  });
});

describe('maps render server-side', () => {
  const NA = JSON.parse(readFileSync('public/geo/na-admin1.topo.json', 'utf8'));
  const WORLD = JSON.parse(readFileSync('public/geo/world-110m.topo.json', 'utf8'));
  const TILES = JSON.parse(readFileSync('public/geo/na-tiles.json', 'utf8')).tiles;
  const na = { geometry: NA, geometryObject: 'regions', contextObject: 'context' };

  it('the point map places every location, keyed for tests, with a group legend', async () => {
    const out = await render('udp-pbi-point-map', { heading: 'Sites', ...na, points: SERVICE_SITES, testIdPrefix: 'sites' });
    expect(count(out, withClass('pm-dot'))).toBe(SERVICE_SITES.length);
    expect(out).toContain('data-testid="sites-point-nyc"');
    expect(out).toContain('aria-label="Sites: 24 locations"');
    for (const group of ['Water', 'Roads', 'Facilities']) expect(out).toContain(`>${group}<`);
    expect(count(out, withClass('map-land'))).toBe(1);
    expect(out).toContain('aria-label="Zoom in"');
  });

  it('bubbles and spikes carry a size legend; hexbins and heat a density ramp', async () => {
    const bubble = await render('udp-pbi-point-map', { heading: 'B', ...na, points: SERVICE_SITES, mark: 'bubble' });
    expect(count(bubble, withClass('pm-bubble'))).toBe(SERVICE_SITES.length);
    expect(bubble).toContain('map-size-legend');
    const spike = await render('udp-pbi-point-map', { heading: 'S', ...na, points: SERVICE_SITES, mark: 'spike' });
    expect(count(spike, withClass('pm-spike'))).toBe(SERVICE_SITES.length);
    const hex = await render('udp-pbi-point-map', { heading: 'H', ...na, points: ASSET_LOCATIONS, mark: 'hexbin' });
    expect(count(hex, withClass('pm-hex'))).toBeGreaterThan(5);
    expect(hex).toContain('>Fewer<');
    const heat = await render('udp-pbi-point-map', { heading: 'D', ...na, points: ASSET_LOCATIONS, mark: 'heat' });
    expect(count(heat, withClass('pm-heat'))).toBeGreaterThan(2);
  });

  it('the globe draws a shaded sphere with only the near side of the data', async () => {
    const out = await render('udp-pbi-point-map', { heading: 'G', geometry: WORLD, points: SERVICE_CENTRES, projection: 'globe', mark: 'spike' });
    expect(out).toContain('data-globe="true"');
    expect(count(out, withClass('map-sphere'))).toBe(1);
    const spikes = count(out, withClass('pm-spike'));
    expect(spikes).toBeGreaterThan(3);
    expect(spikes).toBeLessThan(SERVICE_CENTRES.length);
  });

  it('the choropleth shades matched regions, hatches the rest and lists what it cannot place', async () => {
    const out = await render('udp-pbi-choropleth', { heading: 'Poor', ...na, regions: POOR_CONDITION_BY_REGION, format: { style: 'percent', decimals: 0 }, testIdPrefix: 'cond' });
    expect(count(out, /class="map-mark cp-region/g)).toBe(POOR_CONDITION_BY_REGION.length - 1);
    expect(out).toContain('data-testid="cond-region-US-NY"');
    expect(out).toContain('cp-region--nodata');
    expect(out).toContain('1 region is not on this map: Victoria (Australia)');
    for (const label of ['≤ 11%', '&gt; 22%', 'No data']) expect(out).toContain(label);
  });

  it('the tile map gives every region of the countries present one tile; the globe choropleth diverges', async () => {
    const tiles = await render('udp-pbi-choropleth', { heading: 'Tiles', ...na, tileLayout: TILES, shape: 'tiles', regions: POOR_CONDITION_BY_REGION });
    expect(count(tiles, /class="map-mark cp-tile/g)).toBe(64);
    expect(tiles).toContain('>NY<');
    const globe = await render('udp-pbi-choropleth', { heading: 'Growth', geometry: WORLD, regions: ASSET_GROWTH_BY_COUNTRY, projection: 'globe', colorScale: 'diverging' });
    expect(globe).toContain('data-globe="true"');
    expect(globe).toContain('>Around 0<');
  });

  it('frame="none" draws the map without the card; no data keeps the card with its empty state', async () => {
    const bare = await render('udp-pbi-point-map', { heading: 'Bare', ...na, points: SERVICE_SITES, frame: 'none' });
    expect(bare).not.toContain('u-card-head');
    expect(bare).toContain('map-svg');
    for (const tag of ['udp-pbi-point-map', 'udp-pbi-choropleth']) {
      const empty = await render(tag, { heading: 'x' });
      expect(empty).toContain('No data for the current selection.');
    }
  });
});

describe('the standard frame', () => {
  it('exposes Export, Table, Focus and the ⓘ curtain, closed by default', async () => {
    const out = await render('udp-pbi-ranking-bars', { heading: 'T', info: 'Means X.', calc: 'Y', data: WORK_ORDERS_BY_DEPARTMENT });
    expect(out).toContain('aria-label="Export data"');
    expect(out).toContain('aria-label="Table view"');
    expect(out).toContain('aria-label="Focus view"');
    expect(out).toContain('aria-label="What this chart means"');
    expect(out).toContain('aria-expanded="false"');
    expect(out).toContain('data-open="false"');
    expect(out).toContain('<dialog');
  });

  it('drops the tools a container switches off', async () => {
    const out = await render('udp-pbi-ranking-bars', { heading: 'T', data: WORK_ORDERS_BY_DEPARTMENT, exportable: false, focusable: false, tableToggle: false });
    expect(out).not.toContain('Export data');
    expect(out).not.toContain('Table view');
    expect(out).not.toContain('<dialog');
  });

  it('the theme prop pins the template on the host', async () => {
    expect(await render('udp-pbi-donut', { heading: 'x', data: REQUESTS_BY_CHANNEL, theme: 'nocturne' })).toContain('data-theme="nocturne"');
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
    const out = await render('udp-pbi-data-table', { heading: 'Classes', columns, rows, crossFilterField: "'t'[C]", selectedValue: 'C3' });
    expect(out).toContain('aria-sort="none"');
    expect(count(out, /<tr[\s>]/g)).toBe(11);
    expect(out).toContain('1–10 of 12');
    expect(out).toContain('aria-selected="true"');
    expect(out).toContain('1 due');
    expect(out).toContain('aria-label="None due"');
  });

  it('lists every row without pagination when asked', async () => {
    expect(count(await render('udp-pbi-data-table', { heading: 'x', columns, rows, paginated: false }), /<tr[\s>]/g)).toBe(13);
  });
});

describe('KPIs carry the curtain', () => {
  const button = (html: string) => /<button[^>]*class="[^"]*kpi-body[^"]*"[^>]*>/.exec(html)?.[0] ?? '';

  it('the KPI card describes itself with "What it means" and the calculation', async () => {
    const out = await render('udp-pbi-kpi-card', { heading: 'Total Assets', value: 10000, info: 'Assets in scope.', calc: '[Asset Count]', interactive: true });
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
    expect(button(await render('udp-pbi-kpi-card', { heading: 'Due', value: 1, active: false }))).toContain('aria-pressed="false"');
    expect(button(await render('udp-pbi-kpi-card', { heading: 'Due', value: 1, active: true }))).toContain('aria-pressed="true"');
  });

  it('shows a placeholder while loading, a dash on error and derives the delta', async () => {
    expect(await render('udp-pbi-kpi-card', { heading: 'X', loading: true })).toContain('>…<');
    expect(await render('udp-pbi-kpi-card', { heading: 'X', error: 'boom' })).toContain('>—<');
    const out = await render('udp-pbi-kpi-card', { heading: 'X', value: 110, comparisonValue: 100, deltaLabel: 'vs PY', goodWhen: 'lower' });
    expect(out).toContain('↑ 10.0% vs PY');
    expect(out).toContain('data-favourable="false"');
  });

  it('the hero renders the 60-tick meter', async () => {
    const out = await render('udp-pbi-kpi-hero', { heading: 'SLA', displayValue: '94.2', meter: { label: 'Crew', value: 0.81 } });
    expect(count(out, /<i[\s>]/g)).toBe(60);
    expect(out).toContain('aria-valuenow="81"');
  });
});
