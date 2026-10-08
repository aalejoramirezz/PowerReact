import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './support/mockApi';

const CARDS = [
  'Requests by channel',
  'Service requests',
  'Work orders by department',
  'Spotlight ranking',
  'Regional efficiency',
  'Net flow by site',
  'Renewals by asset class',
  'Maintenance cost by month',
  'Asset classes',
  'Renewal need vs budget',
  'Work requests by status',
  'Condition profile by group',
  'Status by priority',
  'Open requests by age',
  'Criticality × condition',
  'Condition vs criticality',
  'Portfolio by group and class',
  'Work orders, lollipop',
  'Backlog by crew',
  'Funding gap',
  'Backlog by crew, slope',
  'Work requests raised per day',
  'Equipment warranties',
  'Inventory by group and class',
  'Backlog bridge',
  'Financial position',
  'Condition index by group',
  'Service sites',
  'Open requests by site',
  'Backlog spikes',
  'Asset density',
  'Fault hotspots',
  'Assets in poor condition',
  'Poor condition, tile map',
  'Service centres worldwide',
  'Asset growth by country',
];
/** Already tables: no Table view toggle. */
const TABLES = ['Asset classes', 'Criticality × condition', 'Portfolio by group and class'];

/** A visual's card (inside its web component's shadow root, which locators pierce). */
const card = (page: Page, title: string) =>
  page.locator('section.u-card').filter({ has: page.getByRole('heading', { name: title, exact: true }) });

for (const theme of ['neoglass', 'nocturne']) {
  test(`the design gallery renders every component in ${theme}`, async ({ page }) => {
    await page.addInitScript((t) => window.localStorage.setItem('powerreact-theme', t), theme);
    await mockApi(page);
    await page.goto('/gallery');

    for (const title of CARDS) {
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('meter', { name: 'Crew utilization' })).toHaveAttribute('aria-valuenow', '81');
    await expect(page.getByRole('img', { name: 'Renewals AC vs PY' })).toContainText('ΔPY%');
  });

  test(`every visual carries Export, Table view and Focus view in ${theme}`, async ({ page }) => {
    // Three checks on each of the gallery's cards
    test.slow();
    await page.addInitScript((t) => window.localStorage.setItem('powerreact-theme', t), theme);
    await mockApi(page);
    await page.goto('/gallery');

    for (const title of CARDS) {
      const c = card(page, title);
      await expect(c.getByRole('button', { name: 'Export data' }), title).toBeVisible();
      await expect(c.getByRole('button', { name: 'Focus view' }), title).toBeVisible();
      // The data table and the matrices are already tables: no Table toggle there
      await expect(c.getByRole('button', { name: 'Table view' }), title).toHaveCount(TABLES.includes(title) ? 0 : 1);
    }

    // Focus view: a modal dialog, Esc closes it and focus returns to its button
    const ranking = card(page, 'Work orders by department');
    await ranking.getByRole('button', { name: 'Focus view' }).click();
    const dialog = page.getByRole('dialog', { name: 'Work orders by department' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('list', { name: 'Work orders by department' })).toBeVisible();
    await expect(ranking).toContainText('Shown in the focus view');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(ranking.getByRole('button', { name: 'Focus view' })).toBeFocused();

    // Table view: the same data as a sortable table
    const toggle = ranking.getByRole('button', { name: 'Table view' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const table = ranking.getByRole('table');
    await expect(table).toBeVisible();
    const value = table.getByRole('columnheader', { name: /Value/ });
    await expect(value).toHaveAttribute('aria-sort', 'none');
    await value.getByRole('button').click();
    await expect(value).toHaveAttribute('aria-sort', 'descending');
    await value.getByRole('button').click();
    await expect(value).toHaveAttribute('aria-sort', 'ascending');
    await toggle.click();
    await expect(ranking.getByRole('table')).toHaveCount(0);

    // KPIs keep the face clean: the same actions live in a compact ⋯ menu
    await page.getByRole('button', { name: 'More options for Open Backlog' }).click();
    const menu = page.getByRole('menu', { name: 'More options for Open Backlog' });
    await expect(menu.getByRole('menuitem')).toHaveText(['Export CSV', 'Export Excel', 'Focus view']);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });
}

test('KPI variants read their numbers; maps zoom, turn and load boundaries from the app itself', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') external.push(r.url());
  });
  await mockApi(page);
  await page.goto('/gallery');

  // KPI variants: the latest period, the gap to target in points, the IBCS variances
  await expect(page.getByTestId('kpi-requests-raised')).toHaveText('380');
  await expect(page.getByTestId('kpi-card-sla-compliance')).toContainText('0.8 pp below target');
  await expect(page.getByTestId('kpi-card-maintenance-cost')).toContainText('ΔPL%');

  // Zoom with the buttons; the reset appears once zoomed
  const sites = card(page, 'Service sites');
  const map = sites.getByRole('img', { name: 'Service sites: 24 locations' });
  await expect(map).toBeVisible();
  await sites.getByRole('button', { name: 'Zoom in' }).click();
  await expect(map).toHaveAttribute('data-zoomed', 'true');
  await sites.getByRole('button', { name: 'Reset view' }).click();
  await expect(map).toHaveAttribute('data-zoomed', 'false');

  // A click on a location selects it (the gallery highlights it)
  await sites.getByTestId('sites-point-nyc').dispatchEvent('click');
  await expect(sites.getByTestId('sites-point-chi')).toHaveAttribute('data-dimmed', 'true');

  // The globe turns to the location the keyboard moves to, and names it
  const globe = card(page, 'Service centres worldwide').getByRole('img', { name: /Service centres worldwide/ });
  await globe.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(card(page, 'Service centres worldwide').getByRole('status')).toBeVisible();

  // Boundaries come from /geo on this origin: no map tiles or GeoJSON from other hosts
  await expect(card(page, 'Assets in poor condition')).toContainText('1 region is not on this map: Victoria (Australia)');
  expect(external).toEqual([]);
});

test('exports download the visual as CSV and Excel on the client', async ({ page }) => {
  await mockApi(page);
  await page.goto('/gallery');
  const ranking = card(page, 'Work orders by department');

  await ranking.getByRole('button', { name: 'Export data' }).click();
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Export CSV' }).click()]);
  expect(csv.suggestedFilename()).toBe('work-orders-by-department.csv');
  const text = readFileSync(await csv.path(), 'utf8');
  expect(text.replace(/^﻿/, '').split('\r\n').slice(0, 2)).toEqual(['Category,Value', 'Water,412']);

  await ranking.getByRole('button', { name: 'Export data' }).click();
  const [xlsx] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Export Excel' }).click()]);
  expect(xlsx.suggestedFilename()).toBe('work-orders-by-department.xlsx');
  const bytes = readFileSync(await xlsx.path());
  expect(bytes.subarray(0, 2).toString()).toBe('PK');
});

test('IBCS scenario notation follows the selected comparison', async ({ page }) => {
  await mockApi(page);
  await page.goto('/gallery');
  const chart = page.getByRole('img', { name: 'Maintenance cost by month' });
  await expect(chart).toContainText('AC vs PL · K');

  await page.getByRole('button', { name: 'FC', exact: true }).click();
  await expect(chart).toContainText('AC vs FC · K');
  await expect(chart).toContainText('ΔFC%');
});

test('spotlight selection dims the other categories', async ({ page }) => {
  await mockApi(page);
  await page.goto('/gallery');
  const list = page.getByRole('list', { name: 'Spotlight ranking' });
  await list.getByRole('button', { name: /Roads/ }).click();
  await expect(list.getByRole('button', { name: /Roads/ })).toHaveAttribute('aria-pressed', 'true');
  // Inside the shadow root the dimming (≈ 35 % opacity) is exposed as data-dimmed
  await expect(list.getByRole('button', { name: /Water/ })).toHaveAttribute('data-dimmed', 'true');
});

test('the theme prop pins one element to the other template', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await mockApi(page);
  await page.goto('/gallery');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'neoglass');
  const pinned = page.locator('udp-pbi-kpi-card[data-theme="nocturne"]');
  await expect(pinned).toHaveCount(1);
  await expect(pinned.getByTestId('kpi-pinned-template')).toHaveText('Nocturne');
  // Tokens re-resolve on the host: the pinned card takes Nocturne's title colour (white)
  expect(await pinned.getByTestId('kpi-pinned-template').evaluate((el) => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)');
});

test('the matrix and the scatter work from the keyboard: one tab stop, arrows move, the tooltip follows', async ({ page }) => {
  await mockApi(page);
  await page.goto('/gallery');

  // Matrix (WAI-ARIA treegrid): ← collapses the focused group, → expands it, ↓ moves into its classes
  const matrix = page.getByRole('treegrid', { name: 'Portfolio matrix by group and class' });
  const group = matrix.getByRole('row', { name: /Utility_Line/ }).first();
  const header = group.getByRole('rowheader');
  await header.focus();
  await expect(group).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(group).toHaveAttribute('aria-expanded', 'false');
  await expect(matrix.getByRole('rowheader', { name: /Water_Pipes/ })).toHaveCount(0);
  await page.keyboard.press('ArrowRight');
  await expect(group).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(matrix.getByRole('rowheader', { name: /Water_Pipes/ })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(matrix.getByRole('gridcell', { name: /^Water_Pipes, Assets: / })).toBeFocused();

  // Scatter: the chart is one tab stop; the arrows walk the points in x order and the tooltip names each
  const scatter = card(page, 'Condition vs criticality');
  await scatter.getByRole('img', { name: 'Condition vs criticality' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(scatter.getByRole('status')).toContainText('Streetlights');
  await page.keyboard.press('End');
  await expect(scatter.getByRole('status')).toContainText('Bridges');
  await page.keyboard.press('Escape');
  await expect(scatter.getByRole('status')).toHaveCount(0);
});
