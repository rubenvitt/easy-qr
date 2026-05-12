import { test, expect } from '@playwright/test';
import { decodeVisibleQr } from './helpers/decode-qr';

test('preset tap navigates to QR view and renders scannable QR', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Lage aktuell/i }).click();
  await expect(page).toHaveURL(/\/qr\?/);
  await expect(page.locator('svg')).toBeVisible();
  const decoded = await decodeVisibleQr(page);
  expect(decoded).toBe('https://einsatz.drk-xy.de/lage');
});
