import { test, expect } from '@playwright/test';
import { startOidcMock } from './_oidc-mock';

let mock: Awaited<ReturnType<typeof startOidcMock>>;
test.beforeAll(async () => {
  mock = await startOidcMock();
});
test.afterAll(async () => {
  await mock.stop();
});

test('anonymous can generate QR; admin can manage presets', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('🔑 Anmelden')).toBeVisible();
  await page.fill('input[type="url"]', 'https://example.org');
  await page.getByRole('button', { name: /qr erzeugen/i }).click();
  await expect(page.locator('canvas, svg')).toBeVisible();

  await page.goto('/auth/login?return=/admin');
  await expect(page).toHaveURL(/\/admin/);
  await page.getByRole('button', { name: '+ Neues Preset' }).click();
  const label = `E2E Link ${Date.now()}`;
  await page.getByLabel('Bezeichnung').fill(label);
  await page.getByRole('textbox', { name: 'URL' }).fill('https://e2e.test');
  await page.getByRole('button', { name: 'Anlegen' }).click();
  await expect(page.getByText(label)).toBeVisible();
});
