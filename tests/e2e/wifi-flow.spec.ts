import { test, expect } from '@playwright/test';
import { decodeVisibleQr } from './helpers/decode-qr';

test('wifi form generates valid WIFI: payload', async ({ page }) => {
  await page.goto('/wifi');
  await page.getByLabel(/SSID/i).fill('DRK-Test');
  await page.getByLabel(/Passwort/i).fill('geheim');
  await page.getByRole('button', { name: /QR erzeugen/i }).click();
  await expect(page).toHaveURL(/\/qr\?/);
  expect(await decodeVisibleQr(page)).toBe('WIFI:T:WPA;S:DRK-Test;P:geheim;H:false;;');
});
