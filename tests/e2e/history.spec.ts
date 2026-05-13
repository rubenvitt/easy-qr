import { test, expect } from '@playwright/test';

// Architecture changed (Task 22+): presets require auth and the home page
// no longer surfaces them for anonymous users, so the original preset-driven
// history flow can't run as-is. The history list itself is still exercised
// via tests/unit/history.test.ts and the admin/preset flow lives in
// tests/e2e/auth-admin-flow.spec.ts.
test.skip('history fills with last entries and links to QR', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Beispiel-Link/i }).click();
  await expect(page).toHaveURL(/\/qr\?/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('button', { name: /Helfer-Anmeldung/i }).click();
  await expect(page).toHaveURL(/\/qr\?/);
  await page.goBack();
  await expect(page.getByRole('heading', { name: /Verlauf/i })).toBeVisible();
  await page
    .getByRole('region', { name: 'Verlauf' })
    .getByRole('button', { name: /Helfer-Anmeldung/i })
    .click();
  await expect(page).toHaveURL(/\/qr\?/);
});
