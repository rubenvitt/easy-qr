import { test, expect } from '@playwright/test';

test('history fills with last entries and links to QR', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('listitem', { name: /Lage aktuell/i }).click();
  await expect(page).toHaveURL(/\/qr\?/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('listitem', { name: /Helfer-Anmeldung/i }).click();
  await expect(page).toHaveURL(/\/qr\?/);
  await page.goBack();
  await expect(page.getByRole('heading', { name: /Verlauf/i })).toBeVisible();
  await page.getByRole('button', { name: /Helfer-Anmeldung/i }).first().click();
  await expect(page).toHaveURL(/\/qr\?/);
});
