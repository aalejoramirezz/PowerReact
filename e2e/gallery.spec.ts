import { expect, test } from '@playwright/test';
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
];

for (const theme of ['neoglass', 'nocturne']) {
  test(`the design gallery renders every component in ${theme}`, async ({ page }) => {
    await page.addInitScript((t) => window.localStorage.setItem('powerreact-theme', t), theme);
    await mockApi(page);
    await page.goto('/gallery');

    for (const title of CARDS) {
      await expect(page.getByRole('heading', { name: title })).toBeVisible();
    }
    await expect(page.getByRole('meter', { name: 'Crew utilization' })).toHaveAttribute('aria-valuenow', '81');
    await expect(page.getByRole('img', { name: 'Renewals AC vs PY' })).toContainText('ΔPY%');
  });
}

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
  await expect(list.getByRole('button', { name: /Water/ })).toHaveClass(/opacity-35/);
});
