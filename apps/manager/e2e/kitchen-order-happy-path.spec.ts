import { expect, test } from '@playwright/test';

import { ensurePlacedOrderForManager, requireE2EEnv } from './helpers/ensure-placed-order';

test.describe('kitchen order happy path', () => {
  test.describe.configure({ mode: 'serial' });

  test('manager accepts a placed order then marks it ready', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only — avoid double-advancing the same order');

    const { email, password } = requireE2EEnv();
    const { marker } = await ensurePlacedOrderForManager(email);

    await page.goto('/login');
    await page.getByLabel(/^email$/i).fill(email);
    await page.getByLabel(/^password$/i).fill(password);
    await page.getByRole('button', { name: /^sign in$/i }).click();

    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Live orders' })).toBeVisible({ timeout: 30_000 });

    // status=all so the card stays visible after placed → preparing → ready
    await page.goto(`/orders?status=all&q=${encodeURIComponent(marker)}`);
    const card = page.locator('article').filter({ hasText: marker }).first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.getByRole('button', { name: /accept order/i }).click();

    await expect(card.getByText(/^preparing$/i)).toBeVisible({ timeout: 20_000 });
    await card.getByRole('button', { name: /mark ready/i }).click();

    await expect(card.getByText(/ready for pickup/i)).toBeVisible({ timeout: 20_000 });
    await expect(card.getByRole('button', { name: /view order/i })).toBeVisible();
  });
});
