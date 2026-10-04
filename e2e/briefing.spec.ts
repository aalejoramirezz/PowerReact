import { expect, test } from '@playwright/test';
import { mockApi } from './support/mockApi';

for (const theme of ['neoglass', 'nocturne']) {
  test(`the briefing dialog covers the whole app in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript((t) => window.localStorage.setItem('powerreact-theme', t), theme);
    await mockApi(page);
    await page.goto('/visuals');
    await expect(page.getByTestId('kpi-total-assets')).toHaveText('10,000');

    const orb = page.getByTitle('Start Guided Briefing');
    await orb.click();
    const dialog = page.getByRole('dialog', { name: 'Executive Voice Briefing' });
    await expect(dialog).toBeVisible();

    // The overlay spans the viewport, not just the report plane (whose backdrop-filter traps fixed children)
    const overlay = page.getByTestId('briefing-overlay');
    expect(await overlay.boundingBox()).toEqual({ x: 0, y: 0, width: 1440, height: 900 });

    // Nothing from the report (header, filter tabs) or the shell paints above the blur
    const onTop = await page.evaluate(() =>
      [
        [400, 115],
        [650, 225],
        [120, 24],
        [1300, 160],
      ].map(([x, y]) => document.elementFromPoint(x ?? 0, y ?? 0)?.closest('[data-testid="briefing-overlay"]') !== null)
    );
    expect(onTop).toEqual([true, true, true, true]);

    // Keyboard: focus lands in the dialog, Esc closes it and returns focus to the orb
    await expect(page.getByRole('button', { name: 'Start Full Guided Briefing' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(orb).toBeFocused();
  });
}

test('clicking the backdrop closes the briefing dialog', async ({ page }) => {
  await mockApi(page);
  await page.goto('/visuals');
  await page.getByTitle('Start Guided Briefing').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.mouse.click(20, 400);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
