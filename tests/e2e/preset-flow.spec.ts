import { test, expect } from '@playwright/test';
import { decodeVisibleQr } from './helpers/decode-qr';

// Architecture changed (Task 22+): presets are served from D1 behind auth.
// Anonymous users no longer see preset buttons on the home page.
// The admin + preset flow is covered end-to-end by tests/e2e/auth-admin-flow.spec.ts.
test.skip('preset tap navigates to QR view and renders scannable QR', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Beispiel-Link/i }).click();
  await expect(page).toHaveURL(/\/qr\?/);
  await expect(page.locator('svg')).toBeVisible();
  const decoded = await decodeVisibleQr(page);
  expect(decoded).toBe('https://www.drk.de');
});
