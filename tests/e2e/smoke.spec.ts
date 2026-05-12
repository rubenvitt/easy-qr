import { test, expect } from '@playwright/test';

test('main page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'QR-Generator' })).toBeVisible();
});
