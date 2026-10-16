import { expect, test } from '@playwright/test';

test('public legal links and direct routes remain usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');

  const legalNavigation = page.getByRole('navigation', { name: 'Legal and contact information' });
  await expect(legalNavigation.getByRole('link', { name: 'Privacy' })).toBeVisible();
  await expect(legalNavigation.getByRole('link', { name: 'Terms' })).toBeVisible();
  await expect(legalNavigation.getByRole('link', { name: 'Disclaimer' })).toBeVisible();
  await expect(legalNavigation.getByRole('link', { name: 'Contact' })).toBeVisible();

  await legalNavigation.getByRole('link', { name: 'Terms' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Terms of Use' })).toBeVisible();
  await page.goto('/disclaimer');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Financial Information Disclaimer' }),
  ).toBeVisible();
  await page.goto('/contact');
  await expect(page.getByRole('heading', { level: 1, name: 'Contact' })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    'document.documentElement.scrollWidth > document.documentElement.clientWidth',
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test('restores a legal route from the GitHub Pages fallback query', async ({ page }) => {
  await page.goto('/?/terms');
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Terms of Use' })).toBeVisible();
});

const credentialsAvailable = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

test('authenticated Settings exposes every legal and contact link', async ({ page }) => {
  test.skip(!credentialsAvailable, 'Set E2E_EMAIL and E2E_PASSWORD for a dedicated test user.');

  await page.goto('/auth/sign-in');
  await page.getByLabel('Email address').fill(process.env.E2E_EMAIL ?? '');
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/app\//);
  await page.goto('/app/settings');

  const legalNavigation = page.getByRole('navigation', { name: 'Legal and contact information' });
  await expect(legalNavigation.getByRole('link', { name: 'Privacy' })).toBeVisible();
  await expect(legalNavigation.getByRole('link', { name: 'Terms' })).toBeVisible();
  await expect(legalNavigation.getByRole('link', { name: 'Disclaimer' })).toBeVisible();
  await expect(legalNavigation.getByRole('link', { name: 'Contact' })).toBeVisible();
});
