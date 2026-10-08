import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './support/mockApi';

/**
 * The vocabulary manifest (public/manifests/condition-works.json): slicers and report filters,
 * multi-dimensional clicks (matrix cell, stacked segment) and Sample mode. The fake engine answers it
 * from the manifest's own sample rows, narrowed by every TREATAS the app injects.
 */
const GROUP = "'asset_register'[Asset_Class_Group]";

async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const api = await mockApi(page);
  await page.goto('/manifest-preview');
  await page.getByRole('group', { name: 'Manifest' }).getByRole('button', { name: 'Condition & Works' }).click();
  await expect(page.getByRole('heading', { name: 'Condition & Works (manifest)', level: 1 })).toBeVisible();
  return { api, errors };
}

const sent = (queries: string[], ...parts: string[]) => queries.some((q) => parts.every((p) => q.includes(p)));

test.describe('manifest vocabulary', () => {
  test('a multi-select slicer filters the page with one TREATAS and no chip', async ({ page }) => {
    const { api, errors } = await open(page);
    const assessed = page.getByTestId('kpi-assessed-assets');
    await expect(assessed).toHaveText('7,558');

    await page.getByTestId('s-group-option-Core').click();
    await page.getByTestId('s-group-option-Transport').click();
    await expect(page.getByTestId('s-group-option-Core')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('s-group-all')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => sent(api.daxQueries, `TREATAS({"Core", "Transport"}, ${GROUP})`)).toBe(true);
    await expect(assessed).toHaveText('214');
    // The slicer shows its own selection: no chip repeats it
    await expect(page.getByTestId('manifest-filters')).not.toContainText('Asset Class Group');

    await page.getByTestId('s-group-all').click();
    await expect(assessed).toHaveText('7,558');
    expect(errors).toEqual([]);
  });

  test('a matrix cell filters by its row and column at once; a stacked segment by category and series', async ({ page }) => {
    const { api, errors } = await open(page);
    const chips = page.getByTestId('manifest-filters');

    await page.getByTestId('risk-cell-High-Very Poor').click();
    await expect(chips).toContainText('Criticality: High');
    await expect(chips).toContainText('Condition: Very Poor');
    // Visuals on other columns get both filters in one query
    await expect
      .poll(() => sent(api.daxQueries, '"Avg Condition"', `TREATAS({"High"}, 'asset_register'[Criticality])`, `TREATAS({"Very Poor"}, 'asset_register'[Condition])`))
      .toBe(true);
    // The matrix keeps every cell and highlights the selection
    await expect(page.getByRole('treegrid', { name: 'Risk matrix: criticality × condition' }).getByRole('row', { name: /^High/ })).toHaveAttribute('aria-selected', 'true');

    await chips.getByRole('button', { name: 'Reset all' }).click();
    await expect(chips).toHaveCount(0);

    await page.getByTestId('profile-mark-Water_Pipes-Poor').click();
    await expect(chips).toContainText('Asset Class: Water_Pipes');
    await expect(chips).toContainText('Condition: Poor');
    await expect
      .poll(() => sent(api.daxQueries, 'ROW("Assessed"', `TREATAS({"Water_Pipes"}, 'asset_register'[Asset_Class])`, `TREATAS({"Poor"}, 'asset_register'[Condition])`))
      .toBe(true);
    expect(errors).toEqual([]);
  });

  test('a report filter in the toolbar lists the column values and filters every visual', async ({ page }) => {
    const { api, errors } = await open(page);
    const filters = page.getByTestId('manifest-report-filters');
    await filters.getByRole('button', { name: 'Community: All' }).click();
    await page.getByRole('dialog', { name: 'Community: All' }).getByRole('checkbox', { name: 'Valley' }).check();
    await expect.poll(() => sent(api.daxQueries, '"Assessed"', `TREATAS({"Valley"}, 'asset_register'[Community])`)).toBe(true);
    await expect(filters.getByRole('button', { name: 'Community: Valley' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Sample mode filters the sample rows offline; the dashboard fits a phone', async ({ page }) => {
    const { api, errors } = await open(page);
    await page.getByRole('group', { name: 'Data source' }).getByRole('button', { name: 'Sample' }).click();
    const before = api.daxQueries.length;
    await page.getByTestId('s-group-option-Core').click();
    await expect(page.getByTestId('kpi-assessed-assets')).toHaveText('146');
    expect(api.daxQueries.length).toBe(before);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('manifest-grid')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
});
