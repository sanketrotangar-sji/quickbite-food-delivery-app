import { expect, test } from '@playwright/test';

test('login page renders without horizontal overflow', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
});

test('login page exposes email and Google sign-in', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  await expect(page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i)).first()).toBeVisible();
});
