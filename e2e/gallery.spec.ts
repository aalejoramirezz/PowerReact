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
];

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
    await page.addInitScript((t) => window.localStorage.setItem('powerreact-theme', t), theme);
    await mockApi(page);
    await page.goto('/gallery');

    for (const title of CARDS) {
      const c = card(page, title);
      await expect(c.getByRole('button', { name: 'Export data' }), title).toBeVisible();
      await expect(c.getByRole('button', { name: 'Focus view' }), title).toBeVisible();
      // The data table is already a table: no Table toggle there
      await expect(c.getByRole('button', { name: 'Table view' }), title).toHaveCount(title === 'Asset classes' ? 0 : 1);
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
  const pinned = page.locator('univerus-kpi-card[data-theme="nocturne"]');
  await expect(pinned).toHaveCount(1);
  await expect(pinned.getByTestId('kpi-pinned-template')).toHaveText('Nocturne');
  // Tokens re-resolve on the host: the pinned card takes Nocturne's title colour (white)
  expect(await pinned.getByTestId('kpi-pinned-template').evaluate((el) => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)');
});
