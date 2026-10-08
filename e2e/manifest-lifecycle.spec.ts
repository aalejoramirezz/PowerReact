import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './support/mockApi';

/**
 * The flows-and-lifecycles manifest (public/manifests/delivery-lifecycle.json): a calendar day filters
 * the page as a DATE, a treemap tile reports its group and class, two visuals on one column highlight
 * together, and Sample mode works offline. The fake engine answers from the manifest's sample rows.
 */
const GROUP = "'asset_class_group'[Asset_Class_Group]";
const CLASS = "'asset_class'[Asset_Class]";
const SERVICE = "'work_request'[Service_Type]";
const TITLES = [
  'Backlog bridge',
  'Work requests raised per day',
  'Inventory by group and class',
  'Condition index by group',
  'Raised vs closed by service type',
  'Open work requests by service type',
  'Renewal need vs budget',
  'Warranty coverage',
];

async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const api = await mockApi(page);
  await page.goto('/manifest-preview');
  await page.getByRole('group', { name: 'Manifest' }).getByRole('button', { name: 'Delivery & Lifecycle' }).click();
  await expect(page.getByRole('heading', { name: 'Delivery & Lifecycle (manifest)', level: 1 })).toBeVisible();
  return { api, errors };
}

const sent = (queries: string[], ...parts: string[]) => queries.some((q) => parts.every((p) => q.includes(p)));

test.describe('flows and lifecycles manifest', () => {
  test('renders every visual; a calendar day filters the other visuals by DATE', async ({ page }) => {
    const { api, errors } = await open(page);
    for (const title of TITLES) await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByTestId('bridge-step-Open now')).toBeVisible();

    await page.getByTestId('intake-day-2026-06-01').click();
    const chips = page.getByTestId('manifest-filters');
    await expect(chips).toContainText('Date: Mon, Jun 1, 2026');
    await expect.poll(() => sent(api.daxQueries, '"Open", [Open WRs]', "TREATAS({DATE(2026, 6, 1)}, 'Date'[Date])")).toBe(true);
    // The calendar keeps every day and highlights the selection
    await expect(page.getByTestId('intake-day-2026-06-01')).toHaveAttribute('data-dimmed', 'false');
    await expect(page.getByTestId('intake-day-2026-06-02')).toHaveAttribute('data-dimmed', 'true');

    await chips.getByRole('button', { name: 'Reset all' }).click();
    await expect(chips).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('a treemap tile filters by group and class; the boxplot on the group highlights it', async ({ page }) => {
    const { api, errors } = await open(page);
    const chips = page.getByTestId('manifest-filters');

    await page.getByTestId('inventory-tile-Utility_Line/Water_Pipes').click();
    await expect(chips).toContainText('Asset Class Group: Utility_Line');
    await expect(chips).toContainText('Asset Class: Water_Pipes');
    const classFilter = `TREATAS({"Water_Pipes"}, ${CLASS})`;
    const groupFilter = `TREATAS({"Utility_Line"}, ${GROUP})`;
    await expect.poll(() => sent(api.daxQueries, '"Raised", [WRs Raised]', classFilter, groupFilter)).toBe(true);
    // The boxplot's own column is the group: filtered by the class only, never by its own group
    await expect.poll(() => sent(api.daxQueries, 'PERCENTILEX.INC', classFilter)).toBe(true);
    expect(api.daxQueries.filter((q) => q.includes('PERCENTILEX.INC')).some((q) => q.includes(groupFilter))).toBe(false);
    expect(errors).toEqual([]);
  });

  test('two visuals on one column highlight together; the rest filter', async ({ page }) => {
    const { api, errors } = await open(page);
    await page.getByTestId('throughput-row-Water').click();
    await expect(page.getByTestId('manifest-filters')).toContainText('Service Type: Water');
    await expect.poll(() => sent(api.daxQueries, '"Step", "Open now"', `TREATAS({"Water"}, ${SERVICE})`)).toBe(true);
    // The lollipop ranking on the same column keeps every row
    expect(api.daxQueries.filter((q) => q.includes('"Open", [Open WRs]')).some((q) => q.includes(`TREATAS({"Water"}, ${SERVICE})`))).toBe(false);
    expect(errors).toEqual([]);
  });

  test('Sample mode works offline; the dashboard fits a phone', async ({ page }) => {
    const { api, errors } = await open(page);
    await page.getByRole('group', { name: 'Data source' }).getByRole('button', { name: 'Sample' }).click();
    const before = api.daxQueries.length;
    for (const title of TITLES) await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    const warranty = page.getByTestId('warranties-item-Copper pipe warranty#6');
    await expect(warranty).toHaveCount(1);
    await page.getByTestId('inventory-tile-Core/Fleet').click();
    await expect(page.getByTestId('manifest-filters')).toContainText('Asset Class: Fleet');
    // The warranty rows carry the class: none is Fleet's
    await expect(warranty).toHaveCount(0);
    expect(api.daxQueries.length).toBe(before);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('manifest-grid')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
});
