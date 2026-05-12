import { test, expect } from '@playwright/test';
import { decodeVisibleQr } from './helpers/decode-qr';

test('typed URL generates matching QR', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('URL', { exact: true }).fill('https://example.org/lage');
  await page.getByRole('button', { name: /QR erzeugen/i }).click();
  await expect(page).toHaveURL(/\/qr\?/);
  expect(await decodeVisibleQr(page)).toBe('https://example.org/lage');
});
