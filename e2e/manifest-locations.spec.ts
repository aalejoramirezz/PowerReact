import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './support/mockApi';

/**
 * The maps-and-KPIs manifest (public/manifests/locations-performance.json): KPI variants, a point
 * map, a globe whose spikes filter the page, a choropleth and its tile map, with boundaries served
 * from the app's own /geo folder. The fake engine answers from the manifest's sample rows.
 */
const COMMUNITY = "'asset_register'[Community]";
const WR = "'work_request'[WR_Number]";
const MAPS = ['Work requests on the map', 'Assets by community', 'Assessment coverage by state / province', 'Coverage, tile map'];

async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const geo: string[] = [];
  page.on('response', (r) => r.url().includes('/geo/') && geo.push(`${r.status()} ${new URL(r.url()).pathname}`));
  const api = await mockApi(page);
  await page.goto('/manifest-preview');
  await page.getByRole('group', { name: 'Manifest' }).getByRole('button', { name: 'Locations & Performance' }).click();
  await expect(page.getByRole('heading', { name: 'Locations & Performance (manifest)', level: 1 })).toBeVisible();
  return { api, errors, geo };
}

const sent = (queries: string[], ...parts: string[]) => queries.some((q) => parts.every((p) => q.includes(p)));
const card = (page: Page, title: string) => page.locator('section.u-card').filter({ has: page.getByRole('heading', { name: title, exact: true }) });

test.describe('maps and KPI variants manifest', () => {
  test('renders the KPIs and the maps with boundaries from /geo', async ({ page }) => {
    const { errors, geo } = await open(page);
    await expect(page.getByTestId('kpi-work-requests-raised')).toHaveText('49');
    await expect(page.getByTestId('kpi-card-condition-assessment-coverage')).toContainText('below target');
    await expect(page.getByTestId('kpi-card-renewal-liability-vs-budget')).toContainText('ΔBU%');
    for (const title of MAPS) await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(card(page, 'Assessment coverage by state / province')).toContainText('1 region is not on this map: Victoria (Australia)');
    await expect.poll(() => geo.some((g) => g === '200 /geo/na-admin1.topo.json')).toBe(true);
    await expect.poll(() => geo.some((g) => g === '200 /geo/world-110m.topo.json')).toBe(true);
    expect(errors).toEqual([]);
  });

  test('a spike on the globe filters the page by its community; a location by its work request', async ({ page }) => {
    const { api, errors } = await open(page);
    const chips = page.getByTestId('manifest-filters');

    await page.getByTestId('communities-point-Harbour District').dispatchEvent('click');
    await expect(chips).toContainText('Community: Harbour District');
    await expect.poll(() => sent(api.daxQueries, '"Coverage", [Condition Coverage %]', `TREATAS({"Harbour District"}, ${COMMUNITY})`)).toBe(true);
    // The globe keeps every community and highlights the selection
    await expect(page.getByTestId('communities-point-Harbour District')).toHaveAttribute('data-dimmed', 'false');
    await chips.getByRole('button', { name: 'Reset all' }).click();

    await page.getByTestId('request-map-point-1000').dispatchEvent('click');
    await expect(chips).toContainText('WR Number: 1000');
    await expect.poll(() => sent(api.daxQueries, '"Raised", [WRs Raised]', `TREATAS({"1000"}, ${WR})`)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('maps zoom with their buttons and the keyboard walks the locations', async ({ page }) => {
    const { errors } = await open(page);
    const requests = card(page, 'Work requests on the map');
    const map = requests.getByRole('img', { name: /Work requests on the map: \d+ locations/ });
    await requests.getByRole('button', { name: 'Zoom in' }).click();
    await expect(map).toHaveAttribute('data-zoomed', 'true');
    await requests.getByRole('button', { name: 'Reset view' }).click();
    await expect(map).toHaveAttribute('data-zoomed', 'false');

    const globe = card(page, 'Assets by community').getByRole('img', { name: /Assets by community/ });
    await globe.focus();
    await page.keyboard.press('ArrowRight');
    await expect(card(page, 'Assets by community').getByRole('status')).toContainText('Assets');
    expect(errors).toEqual([]);
  });

  test('Sample mode works offline; the dashboard fits a phone', async ({ page }) => {
    const { api, errors } = await open(page);
    await page.getByRole('group', { name: 'Data source' }).getByRole('button', { name: 'Sample' }).click();
    const before = api.daxQueries.length;
    for (const title of MAPS) await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await page.getByTestId('communities-point-North Shore').dispatchEvent('click');
    await expect(page.getByTestId('manifest-filters')).toContainText('Community: North Shore');
    expect(api.daxQueries.length).toBe(before);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('manifest-grid')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
});
