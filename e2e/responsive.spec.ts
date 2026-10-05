import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './support/mockApi';

// A phone: 390 × 844 CSS px, touch only (hover: none, pointer: coarse)
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

const THEMES = ['neoglass', 'nocturne'] as const;

async function open(page: Page, path: string, theme: (typeof THEMES)[number] = 'neoglass') {
  await page.addInitScript((t) => window.localStorage.setItem('powerreact-theme', t), theme);
  await mockApi(page);
  await page.goto(path);
}

/**
 * Elements that stick out of the viewport, plus scroll containers that scroll sideways.
 * Excluded: the filter row and wide charts (they scroll inside their card on purpose), the closed
 * drawer (inert, off canvas), decorative layers and visually hidden content (sr-only: a clipped 1×1 box).
 */
const sidewaysOverflow = (page: Page) =>
  page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const visuallyHidden = (el: Element) => {
      for (let a: Element | null = el; a; a = a.parentElement) {
        const r = a.getBoundingClientRect();
        if (r.width <= 1 && r.height <= 1 && getComputedStyle(a).overflow === 'hidden') return true;
      }
      return false;
    };
    const skip = (el: Element) =>
      el.closest('.u-scroll-x, .u-chart-scroll, [inert], [aria-hidden="true"]') !== null || visuallyHidden(el);
    const name = (el: Element) => `${el.tagName.toLowerCase()}.${String(el.getAttribute('class') ?? '').slice(0, 70)}`;
    const out: string[] = [];
    for (const el of document.querySelectorAll('body *')) {
      if (skip(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.right > vw + 1 || r.left < -1)) out.push(`sticks out: ${name(el)}`);
      const { overflowX } = getComputedStyle(el);
      if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1) {
        out.push(`scrolls sideways: ${name(el)}`);
      }
    }
    return out.slice(0, 10);
  });

test.describe('phone layout', () => {
  for (const theme of THEMES) {
    test(`the report and the gallery fit the screen without sideways scrolling in ${theme}`, async ({ page }) => {
      await open(page, '/visuals', theme);
      await expect(page.getByTestId('kpi-total-assets')).toHaveText('10,000');
      await expect(page.getByRole('row', { name: /Water_Pipes/ })).toBeVisible();
      expect(await sidewaysOverflow(page)).toEqual([]);

      await page.goto('/gallery');
      await expect(page.getByTestId('gallery')).toBeVisible();
      expect(await sidewaysOverflow(page)).toEqual([]);
    });
  }

  test('the sidebar is an off-canvas drawer: menu button, Esc and navigation close it', async ({ page }) => {
    await open(page, '/visuals');
    const drawer = page.locator('#app-sidebar');
    const menu = page.getByRole('button', { name: 'Open navigation' });

    await expect(drawer).not.toBeInViewport();
    await expect(drawer).toHaveAttribute('inert', '');

    await menu.tap();
    await expect(drawer).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Close navigation' })).toBeFocused();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeInViewport();
    await expect(menu).toBeFocused();

    await menu.tap();
    await drawer.getByRole('link', { name: /Design Gallery/ }).tap();
    await expect(page).toHaveURL(/\/gallery$/);
    await expect(drawer).not.toBeInViewport();

    // The overlay closes it too
    await menu.tap();
    await expect(drawer).toBeInViewport();
    await page.getByTestId('nav-overlay').tap({ position: { x: 370, y: 400 } });
    await expect(drawer).not.toBeInViewport();
  });

  test('group filters scroll sideways and still filter', async ({ page }) => {
    await open(page, '/visuals');
    await expect(page.getByTestId('kpi-total-assets')).toHaveText('10,000');
    const filters = page.getByRole('group', { name: 'Filter by asset group' });

    // One row that scrolls, not a wrapped block
    const { scrollWidth, clientWidth } = await filters.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
    expect(scrollWidth).toBeGreaterThan(clientWidth);

    const core = filters.getByRole('button', { name: 'Core', exact: true });
    await core.tap();
    await expect(core).toHaveAttribute('aria-pressed', 'true');
    await expect(core).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('kpi-total-assets')).toHaveText('1,200');
  });

  test('KPIs sit in two columns and their ⓘ opens the curtain on touch', async ({ page }) => {
    await open(page, '/visuals');
    await expect(page.getByTestId('kpi-total-assets')).toHaveText('10,000');

    // Layout offsets, not bounding boxes: the cards rise in with a staggered transform
    const at = (slug: string) =>
      page.getByTestId(`kpi-card-${slug}`).evaluate((el: HTMLElement) => ({ x: el.offsetLeft, y: el.offsetTop }));
    const [total, assessed, renewal] = await Promise.all([at('total-assets'), at('condition-assessed'), at('due-for-renewal')]);
    expect(assessed.y).toBe(total.y);
    expect(assessed.x).toBeGreaterThan(total.x);
    expect(renewal.y).toBeGreaterThan(total.y);
    expect(renewal.x).toBe(total.x);

    const card = page.getByTestId('kpi-card-due-for-renewal');
    const info = page.getByRole('button', { name: 'What Due For Renewal means' });
    await info.tap();
    await expect(card.locator('.u-curtain[data-open="true"]')).toContainText('What it means');
    // The ⓘ does not toggle the KPI focus
    await expect(page.getByRole('button', { name: /^Due For Renewal/ })).toHaveAttribute('aria-pressed', 'false');

    await page.getByRole('button', { name: 'Hide what Due For Renewal means' }).tap();
    await expect(card.locator('.u-curtain[data-open="true"]')).toHaveCount(0);
  });

  test('the class table becomes a two-line list that keeps its rows and cross-filters', async ({ page }) => {
    await open(page, '/visuals');
    const table = page.getByRole('table', { name: /Asset classes/ });
    const row = page.getByRole('row', { name: /Water_Pipes/ });
    await expect(row).toBeVisible();

    // Header visually hidden, rows laid out as a grid, nothing scrolls sideways
    expect(await table.locator('thead').evaluate((el) => el.getBoundingClientRect().height)).toBeLessThanOrEqual(1);
    expect(await row.evaluate((el) => getComputedStyle(el).display)).toBe('grid');
    expect(await table.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await expect(row).toContainText(/\d+ due|—/);

    await row.tap();
    await expect(page.getByTestId('kpi-total-assets')).toHaveText('1,979');
  });

  test('Chat with Data opens full screen', async ({ page }) => {
    await open(page, '/visuals');
    await page.getByRole('button', { name: 'Chat with Data' }).tap();
    await expect(page.getByRole('textbox', { name: 'Ask the Data Agent' })).toBeVisible();
    // Polled: the sheet slides in
    await expect
      .poll(async () => {
        const b = await page.getByTestId('chat-drawer').boundingBox();
        return b && [b.x, b.y, b.width, b.height].map(Math.round);
      })
      .toEqual([0, 0, 390, 844]);
  });

  test('the briefing mini-player is a bottom bar that never covers the last rows', async ({ page }) => {
    await page.addInitScript(() => {
      window.speechSynthesis.speak = () => {};
    });
    await open(page, '/visuals');
    await expect(page.getByTestId('kpi-total-assets')).toHaveText('10,000');

    await page.getByRole('button', { name: 'Briefing', exact: true }).tap();
    await page.getByRole('button', { name: 'Start Full Guided Briefing' }).tap();
    const player = page.getByRole('region', { name: 'Briefing player' });
    await expect(player).toBeVisible();

    // Polled: the player pops in (scale)
    await expect
      .poll(async () => {
        const b = await player.boundingBox();
        return b && [b.x, b.width, b.y + b.height].map(Math.round);
      })
      .toEqual([0, 390, 844]);
    const bar = (await player.boundingBox())!;

    // Scrolled to the end, the report's last block ends above the bar
    const content = page.getByTestId('report-content');
    await content.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await expect
      .poll(() => content.evaluate((el) => el.firstElementChild!.getBoundingClientRect().bottom))
      .toBeLessThanOrEqual(bar.y);
  });
});
