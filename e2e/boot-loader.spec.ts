import { expect, test } from '@playwright/test';

test('shows the branded loader before the application bundle finishes loading', async ({
  page,
}) => {
  await page.route(/\/assets\/.*\.js$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await route.continue();
  });

  const navigation = page.goto('/', { waitUntil: 'commit' });

  await expect(page.locator('.boot-loader')).toBeVisible();
  await expect(page.getByRole('status', { name: 'Loading Buddy Budget' })).toBeVisible();

  await navigation;
  await expect(page.locator('.boot-loader')).toBeHidden();
});
