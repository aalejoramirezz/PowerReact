import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './support/mockApi';

/** Speech that never ends: a started briefing stays "playing" until it is stopped. */
const holdSpeech = (page: Page) =>
  page.addInitScript(() => {
    window.speechSynthesis.speak = () => {};
  });

test.describe('report header', () => {
  test('technical context lives behind "Report details"; the DAX Inspector opens in a sheet', async ({ page }) => {
    await mockApi(page);
    await page.goto('/visuals');
    await expect(page.getByTestId('kpi-total-assets')).toHaveText('10,000');

    // Nothing technical on the canvas
    await expect(page.getByText('AssetFinda_Financial_Master_Suite')).toHaveCount(0);
    await expect(page.getByText(/Live VertiPaq/)).toHaveCount(0);

    const details = page.getByRole('button', { name: 'Report details' });
    await details.click();
    const panel = page.getByRole('dialog', { name: 'Report details' });
    await expect(panel).toContainText('AssetFinda_Financial_Master_Suite');
    await expect(panel).toContainText(/\d+ ms/);

    // The popover paints over the filter row and the data, not under them
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    const topmost = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x ?? 0, y ?? 0)?.closest('[role="dialog"]')?.getAttribute('aria-label') ?? null,
      [box!.x + box!.width / 2, box!.y + box!.height - 12]
    );
    expect(topmost).toBe('Report details');

    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(details).toBeFocused();

    await details.click();
    await panel.getByRole('button', { name: 'Open DAX Inspector' }).click();
    const sheet = page.getByRole('dialog', { name: 'DAX Inspector' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId('dax-inspector')).toContainText('Recent DAX Query History');
    await expect(page.getByRole('button', { name: 'Close DAX Inspector' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(details).toBeFocused();
  });

  test('the briefing plays in a mini-player that only exists while it plays', async ({ page }) => {
    await holdSpeech(page);
    await mockApi(page);
    await page.goto('/visuals');
    await expect(page.getByTestId('kpi-total-assets')).toHaveText('10,000');

    const player = page.getByRole('region', { name: 'Briefing player' });
    await expect(player).toHaveCount(0);

    await page.getByTitle('Start Guided Briefing').click();
    await page.getByRole('button', { name: 'Start Full Guided Briefing' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(player).toBeVisible();
    await expect(player).toContainText('Executive Overview');

    await player.getByRole('button', { name: 'Captions' }).click();
    await expect(player.getByRole('button', { name: 'Captions' })).toHaveAttribute('aria-pressed', 'false');

    await player.getByRole('button', { name: 'Stop briefing' }).click();
    await expect(player).toHaveCount(0);
  });
});
