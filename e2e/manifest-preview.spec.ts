import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './support/mockApi';

const GROUP_FILTER = `TREATAS({"Utility_Line"}, 'asset_class_group'[Asset_Class_Group])`;
const SAMPLE = JSON.parse(readFileSync('public/manifests/sample-manifest.json', 'utf8')) as {
  title: string;
  dataSource: { semanticModelId: string };
  visuals: Array<{ id: string; grid: { colSpan: number } }>;
};

/** A visual's card inside its web component (locators pierce the shadow root). */
const card = (page: Page, title: string) =>
  page.locator('section.u-card').filter({ has: page.getByRole('heading', { name: title, exact: true }) });

const upload = (page: Page, name: string, json: unknown) =>
  page.getByLabel('Upload a manifest').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(json)) });

test.describe('manifest preview', () => {
  test('renders the bundled manifest live and cross-filters through injected DAX', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const api = await mockApi(page);
    await page.goto('/manifest-preview');

    const total = page.getByTestId('kpi-total-assets');
    await expect(page.getByRole('heading', { name: SAMPLE.title, level: 1 })).toBeVisible();
    await expect(total).toHaveText('10,000');
    await expect(page.getByTestId('groups-share-Utility_Line')).toHaveText('(54.5%)');
    // Every query goes to the manifest's own semantic model
    expect(api.daxRequests.every((r) => r.datasetId === SAMPLE.dataSource.semanticModelId)).toBe(true);

    await page.getByTestId('groups-bar-Utility_Line').click();
    await expect(total).toHaveText('5,451');
    await expect(page.getByTestId('groups-bar-Utility_Line')).toHaveAttribute('aria-pressed', 'true');
    expect(api.daxQueries.some((q) => q.includes('CALCULATETABLE(') && q.includes(GROUP_FILTER))).toBe(true);
    // The source visual (and the donut on the same column) are not filtered by it: they highlight
    expect(api.daxQueries.filter((q) => q.includes('"Group Assets"')).some((q) => q.includes('TREATAS'))).toBe(false);
    expect(api.daxQueries.filter((q) => q.includes('"Group Assessed"')).some((q) => q.includes('TREATAS'))).toBe(false);
    // Visuals on other columns follow the filter
    const ranking = card(page, 'Top asset classes');
    await expect(ranking.getByRole('list')).toContainText('Water_Pipes');
    await expect(ranking.getByRole('list')).not.toContainText('Hydrants');

    const chips = page.getByTestId('manifest-filters');
    await expect(chips).toContainText('Asset Class Group: Utility_Line');

    // A second column narrows further; a click on the selected bar removes its filter
    await page.getByRole('row', { name: /Water_Pipes/ }).click();
    await expect(total).toHaveText('1,979');
    await expect(chips).toContainText('Asset Class: Water_Pipes');

    await chips.getByRole('button', { name: 'Reset all' }).click();
    await expect(total).toHaveText('10,000');
    await expect(chips).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('exports the raw query rows as CSV and a visual as Excel', async ({ page }) => {
    await mockApi(page);
    await page.goto('/manifest-preview');
    await expect(page.getByTestId('kpi-total-assets')).toHaveText('10,000');

    const table = card(page, 'Asset classes');
    await table.getByRole('button', { name: 'Export data' }).click();
    const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Export CSV' }).click()]);
    expect(csv.suggestedFilename()).toBe('asset-classes.csv');
    const lines = readFileSync(await csv.path(), 'utf8').replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0]).toBe('Asset Class,Asset Class Group,Assets,Assessed,Assessed Share,Due For Renewal');
    expect(lines).toHaveLength(9);
    expect(lines[1]).toMatch(/^Sanitary_Pipes,Utility_Line,2100,1500,0\.71\d*,0$/);

    const ranking = card(page, 'Top asset classes');
    await ranking.getByRole('button', { name: 'Export data' }).click();
    const [xlsx] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Export Excel' }).click()]);
    expect(xlsx.suggestedFilename()).toBe('top-classes.xlsx');
    expect(readFileSync(await xlsx.path()).subarray(0, 2).toString()).toBe('PK');
  });

  test('an invalid upload lists its problems; a valid one renders', async ({ page }) => {
    await mockApi(page);
    await page.goto('/manifest-preview');
    await expect(page.getByTestId('kpi-total-assets')).toHaveText('10,000');

    const broken = structuredClone(SAMPLE);
    broken.visuals[0]!.grid.colSpan = 13;
    broken.dataSource.semanticModelId = 'not-a-guid';
    await upload(page, 'broken.json', broken);
    const issues = page.getByTestId('manifest-issues');
    await expect(issues).toContainText('This manifest is not valid');
    await expect(issues).toContainText('visuals[0].grid.colSpan');
    await expect(issues).toContainText('dataSource.semanticModelId');

    await page.getByLabel('Upload a manifest').setInputFiles({ name: 'syntax.json', mimeType: 'application/json', buffer: Buffer.from('{ "schemaVersion": 1,') });
    await expect(issues).toContainText('Not valid JSON');

    await upload(page, 'mine.json', { ...SAMPLE, title: 'My uploaded portfolio' });
    await expect(page.getByRole('heading', { name: 'My uploaded portfolio', level: 1 })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Manifest' }).getByRole('button', { name: 'mine.json' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('kpi-total-assets')).toHaveText('10,000');

    // Back to the bundled manifest
    await page.getByRole('group', { name: 'Manifest' }).getByRole('button', { name: 'Asset Portfolio' }).click();
    await expect(page.getByRole('heading', { name: SAMPLE.title, level: 1 })).toBeVisible();
  });

  test('Sample mode renders and cross-filters without the network', async ({ page }) => {
    await mockApi(page);
    await page.route('**/api/powerbi/query', (route) => route.abort());
    await page.goto('/manifest-preview');

    await page.getByRole('group', { name: 'Data source' }).getByRole('button', { name: 'Sample' }).click();
    await expect(page.getByTestId('manifest-grid')).toHaveAttribute('data-source', 'sample');
    const total = page.getByTestId('kpi-total-assets');
    await expect(total).toHaveText('10,000');

    await page.getByTestId('groups-bar-Utility_Line').click();
    await expect(total).toHaveText('5,451');
    await expect(card(page, 'Top asset classes').getByRole('list')).not.toContainText('Hydrants');
  });

  test('the schema can be downloaded', async ({ page }) => {
    await mockApi(page);
    await page.goto('/manifest-preview');
    const [schema] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download schema' }).click()]);
    expect(schema.suggestedFilename()).toBe('manifest.schema.json');
    expect(JSON.parse(readFileSync(await schema.path(), 'utf8')).title).toBe('PowerReact report manifest');
  });
});

test.describe('manifest preview on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  for (const theme of ['neoglass', 'nocturne'] as const) {
    test(`fits the screen without sideways scrolling in ${theme}`, async ({ page }) => {
      await page.addInitScript((t) => window.localStorage.setItem('powerreact-theme', t), theme);
      await mockApi(page);
      await page.goto('/manifest-preview');
      await expect(page.getByTestId('kpi-total-assets')).toHaveText('10,000');
      await expect(page.getByRole('row', { name: /Water_Pipes/ })).toBeVisible();

      const overflow = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const skip = (el: Element) => el.closest('.u-scroll-x, .u-chart-scroll, [inert], [aria-hidden="true"], .sr-only') !== null;
        const out: string[] = [];
        for (const el of document.querySelectorAll('body *')) {
          if (skip(el)) continue;
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && (r.right > vw + 1 || r.left < -1)) out.push(`${el.tagName.toLowerCase()}.${String(el.getAttribute('class') ?? '').slice(0, 60)}`);
        }
        return out.slice(0, 10);
      });
      expect(overflow).toEqual([]);

      // KPIs (colSpan 3) sit two per row on a phone
      const at = (slug: string) => page.getByTestId(`kpi-card-${slug}`).evaluate((el: HTMLElement) => ({ x: el.offsetLeft, y: el.offsetTop }));
      const [first, second] = await Promise.all([at('total-assets'), at('condition-assessed')]);
      expect(second.y).toBe(first.y);
      expect(second.x).toBeGreaterThan(first.x);
    });
  }
});
