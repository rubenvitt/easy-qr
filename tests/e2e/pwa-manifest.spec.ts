import { test, expect } from '@playwright/test';

test('manifest is reachable and has expected fields', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const json = await res.json();
  expect(json.name).toBe('QR-Generator');
  expect(json.short_name).toBe('QR');
  expect(json.display).toBe('standalone');
  expect(Array.isArray(json.icons)).toBe(true);
  expect(json.icons.length).toBeGreaterThanOrEqual(2);
});
