import { test, expect } from '@playwright/test';
import { decodeVisibleQr } from './helpers/decode-qr';

test('app works offline after first load', async ({ page, context }) => {
  await page.goto('/');
  // Wait for SW to register and reach an active state.
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker?.ready;
    return !!reg?.active;
  });
  // Reload so this page comes under SW control (controller is set on next navigation).
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null);
  await page.waitForTimeout(500);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'QR-Generator' })).toBeVisible();
  await page.getByRole('listitem', { name: /Lage aktuell/i }).click();
  await expect(page).toHaveURL(/\/qr\?/);
  await expect(page.locator('svg')).toBeVisible();
  expect(await decodeVisibleQr(page)).toBe('https://einsatz.drk-xy.de/lage');
});
