import { expect, test } from '@playwright/test';

test('the landing page makes the no-signup demo prominent', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: /Try demo/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Try the interactive demo/i })).toBeVisible();
});

test('visitor explores the demo and carries only an approved plan to registration', async ({
  page,
}) => {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'See where the month is going' })).toBeVisible();

  await page.getByLabel('Description').fill('Fictional coffee');
  await page.getByLabel('Amount').fill('45.00');
  await page.getByRole('button', { name: 'Add sample transaction' }).click();
  await expect(page.getByText('Fictional coffee')).toBeVisible();

  await page.getByRole('button', { name: /Start with this setup/ }).click();
  await expect(page).toHaveURL(/\/auth\/register\?starter=demo$/);
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();

  const storage = await page.context().storageState();
  const stored = storage.origins
    .flatMap((origin) => origin.localStorage)
    .find((entry) => entry.name === 'buddy-budget-approved-demo-plan')?.value;
  expect(stored).not.toContain('transactions');
  expect(stored).not.toContain('Fictional coffee');
});

test('the demo reloads while offline after its assets are cached', async ({ context, page }) => {
  await page.goto('/demo');
  await page.evaluate('navigator.serviceWorker.ready.then(() => true)');
  await page.reload();
  await page.waitForFunction('navigator.serviceWorker.controller !== null');

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole('heading', { name: 'See where the month is going' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Start with this setup/ })).toBeDisabled();
    await expect(page.getByText(/will become available when you are back online/i)).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
