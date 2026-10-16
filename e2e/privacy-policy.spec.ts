import { expect, test } from '@playwright/test';

test('privacy policy opens directly without authentication on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/privacy');

  await expect(page).toHaveTitle('Privacy Policy | Buddy Budget');
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
  await expect(page.getByText('Draft — publication blocked')).toBeVisible();
  await expect(page.getByRole('link', { name: /information regulator/i })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    'document.documentElement.scrollWidth > document.documentElement.clientWidth',
  );
  expect(hasHorizontalOverflow).toBe(false);
});

const credentialsAvailable = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

test('authenticated users can open the privacy policy from Settings', async ({ page }) => {
  test.skip(!credentialsAvailable, 'Set E2E_EMAIL and E2E_PASSWORD for a dedicated test user.');

  await page.goto('/auth/sign-in');
  await page.getByLabel('Email address').fill(process.env.E2E_EMAIL ?? '');
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/app\//);

  await page.goto('/app/settings');
  await page
    .getByRole('navigation', { name: 'Legal and contact information' })
    .getByRole('link', { name: 'Privacy' })
    .click();

  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
});
