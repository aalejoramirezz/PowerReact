import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './support/mockApi';

const transformOf = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => getComputedStyle(el).transform);

const IDENTITY = /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/;

test.describe('Univerus themes', () => {
  test('the dark mode button switches Neo-Glass ↔ Nocturne and remembers the choice', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await mockApi(page);
    await page.goto('/visuals');
    const html = page.locator('html');

    await expect(html).toHaveAttribute('data-theme', 'neoglass');
    await expect(page.getByTestId('theme-toggle')).toHaveAttribute('aria-pressed', 'false');

    await page.getByTestId('theme-toggle').click();
    await expect(html).toHaveAttribute('data-theme', 'nocturne');
    await expect(page.getByTestId('theme-toggle')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(10, 15, 18)');

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'nocturne');
    // Functionality is untouched by the theme
    await expect(page.getByTestId('kpi-total-assets')).toHaveText('10,000');
  });

  test('a first visit follows the OS colour scheme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await mockApi(page);
    await page.goto('/visuals');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'nocturne');
  });

  test('KPI cards drop the "What it means" curtain on hover and keyboard focus', async ({ page }) => {
    await mockApi(page);
    await page.goto('/visuals');
    const renewal = page.getByRole('button', { name: /^Due For Renewal/ });
    await expect(page.getByTestId('kpi-due-for-renewal')).toHaveText('687');

    const curtain = renewal.locator('.u-curtain');
    await expect(curtain).toContainText('What it means');
    await expect(curtain).toContainText('[Assets Due For Renewal]');
    expect(await curtain.evaluate((el) => getComputedStyle(el).transform)).not.toMatch(IDENTITY);

    await renewal.hover();
    await expect.poll(() => curtain.evaluate((el) => getComputedStyle(el).transform)).toMatch(IDENTITY);

    // The curtain never blocks the click: the card still toggles the KPI focus
    await renewal.click();
    await expect(renewal).toHaveAttribute('aria-pressed', 'true');

    await page.mouse.move(0, 0);
    await page.getByRole('button', { name: /^Condition Assessed/ }).focus();
    await page.keyboard.press('Tab');
    await expect(renewal).toBeFocused();
    await expect.poll(() => curtain.evaluate((el) => getComputedStyle(el).transform)).toMatch(IDENTITY);
  });

  test('chart cards open the same curtain from their ⓘ button without blocking the chart', async ({ page }) => {
    await mockApi(page);
    await page.goto('/visuals');
    const info = page.getByRole('button', { name: 'What this chart means' }).first();

    await info.click();
    await expect(page.getByRole('button', { name: 'Hide what this chart means' }).first()).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.u-curtain[data-open="true"]')).toContainText('Assets per asset class group');

    await page.keyboard.press('Escape');
    await expect(page.locator('.u-curtain[data-open="true"]')).toHaveCount(0);

    await page.getByTestId('group-bar-Utility_Line').click();
    await expect(page.getByTestId('kpi-total-assets')).toHaveText('5,451');
  });

  test('with reduced motion everything renders in its final state', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockApi(page);
    await page.goto('/visuals');
    await expect(page.getByTestId('kpi-total-assets')).toHaveText('10,000');
    const duration = await page.locator('.u-card').first().evaluate((el) => parseFloat(getComputedStyle(el).animationDuration));
    expect(duration).toBeLessThan(0.001);
    expect(await transformOf(page, '.u-plane')).toMatch(IDENTITY);
  });

  for (const theme of ['neoglass', 'nocturne']) {
    test(`no console errors across the views in ${theme}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error' && !m.text().includes('403')) errors.push(m.text());
      });
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript((t) => window.localStorage.setItem('powerreact-theme', t), theme);
      await mockApi(page);

      await page.goto('/visuals');
      await expect(page.getByTestId('kpi-total-assets')).toHaveText('10,000');
      await page.getByRole('button', { name: /Chat with Data/ }).click();
      await expect(page.getByRole('textbox', { name: 'Ask the Data Agent' })).toBeVisible();
      await page.getByRole('link', { name: 'Power BI Embed (iFrame)' }).click();
      await expect(page.getByText('Embedding disabled in e2e')).toBeVisible();
      await page.getByRole('link', { name: /Design Gallery/ }).click();
      await expect(page.getByTestId('gallery')).toBeVisible();

      expect(errors).toEqual([]);
    });
  }
});
