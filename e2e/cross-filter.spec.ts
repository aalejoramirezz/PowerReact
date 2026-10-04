import { expect, test } from '@playwright/test';
import { mockApi } from './support/mockApi';

test.describe('semantic visuals cross-filtering', () => {
  test('group and class clicks cross-filter KPIs, groups and classes', async ({ page }) => {
    await mockApi(page);
    await page.goto('/visuals');

    const totalAssets = page.getByTestId('kpi-total-assets');
    const activeFilters = page.getByTestId('active-filters');
    const row = (name: string) => page.getByRole('row', { name: new RegExp(name) });

    await expect(totalAssets).toHaveText('10,000');
    await expect(page.getByTestId('group-share-Utility_Line')).toHaveText('(54.5%)');

    // Group bar -> KPIs and classes follow the group
    await page.getByTestId('group-bar-Utility_Line').click();
    await expect(totalAssets).toHaveText('5,451');
    await expect(row('Water_Pipes')).toBeVisible();
    await expect(row('Hydrants')).toHaveCount(0);
    await expect(activeFilters).toContainText('Group: Utility_Line');
    // Shares stay relative to the whole register, not to the filtered KPI total
    await expect(page.getByTestId('group-share-Utility_Line')).toHaveText('(54.5%)');

    // Class row -> KPIs narrow down to the class
    await row('Water_Pipes').click();
    await expect(totalAssets).toHaveText('1,979');
    await expect(activeFilters).toContainText('Class: Water_Pipes');

    // With a class selected the distribution only lists that class's group,
    // so switch through the filter bar; the class from the old group is dropped
    await expect(page.getByTestId('group-bar-Core')).toHaveCount(0);
    await page.getByRole('button', { name: 'Core', exact: true }).click();
    await expect(totalAssets).toHaveText('1,200');
    await expect(activeFilters).not.toContainText('Class:');

    await page.getByRole('button', { name: 'Reset All' }).click();
    await expect(totalAssets).toHaveText('10,000');
    await expect(activeFilters).toHaveCount(0);
  });

  test('KPI focus and search are resolved by the engine, not the loaded rows', async ({ page }) => {
    const api = await mockApi(page);
    await page.goto('/visuals');
    const row = (name: string) => page.getByRole('row', { name: new RegExp(name) });
    const renewalCard = page.getByRole('button', { name: /^Due For Renewal/ });

    await renewalCard.click();
    await expect(row('Water_Pipes')).toBeVisible();
    await expect(row('Buildings')).toBeVisible();
    await expect(row('Sanitary_Pipes')).toHaveCount(0);
    expect(api.daxQueries.some((q) => q.includes('[DueForRenewal] > 0'))).toBe(true);

    await renewalCard.click();
    await page.getByLabel('Search asset classes').fill('pipes');
    await expect(row('Stormwater_Pipes')).toBeVisible();
    await expect(row('Hydrants')).toHaveCount(0);
    expect(api.daxQueries.some((q) => q.includes(`CONTAINSSTRING('asset_class'[Asset_Class], "pipes")`))).toBe(true);

    await page.getByLabel('Search asset classes').fill('zzz');
    await expect(page.getByText('No asset classes match "zzz" in this scope.')).toBeVisible();
  });

  test('filters survive switching to the embedded report and back', async ({ page }) => {
    await mockApi(page);
    await page.goto('/visuals');

    await page.getByTestId('group-bar-Utility_Line').click();
    await expect(page.getByTestId('kpi-total-assets')).toHaveText('5,451');

    await page.getByRole('link', { name: 'Power BI Embed (iFrame)' }).click();
    await expect(page).toHaveURL(/\/report$/);
    await expect(page.getByText('Embedding disabled in e2e')).toBeVisible();

    await page.getByRole('link', { name: 'React Semantic Visuals' }).click();
    await expect(page).toHaveURL(/\/visuals$/);
    await expect(page.getByTestId('active-filters')).toContainText('Group: Utility_Line');
    await expect(page.getByTestId('kpi-total-assets')).toHaveText('5,451');
  });

  test('a failing DAX query shows an error with retry instead of zeros', async ({ page }) => {
    await mockApi(page);
    let failKpis = true;
    await page.route('**/api/powerbi/query', async (route, request) => {
      const { query } = request.postDataJSON() as { query: string };
      if (failKpis && query.includes('"TotalAssets"')) {
        await route.fulfill({
          status: 400,
          json: { success: false, error: 'DAX Query Execution failed', hint: 'Column not found' },
        });
        return;
      }
      await route.fallback();
    });

    await page.goto('/visuals');
    await expect(page.getByRole('alert')).toContainText('DAX Query Execution failed: Column not found');
    await expect(page.getByTestId('kpi-total-assets')).toHaveText('—');

    failKpis = false;
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByTestId('kpi-total-assets')).toHaveText('10,000');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});
