import { test, expect } from '@playwright/test';

test('displays search results', async ({ page }) => {
  await page.goto('/');

  await page.waitForSelector('article', { state: 'visible' });

  expect(await page.locator('article').count()).toBe(20);
});

