import { expect, test } from '@playwright/test';

const credentialsAvailable = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

test.describe('budget insights', () => {
  test.skip(!credentialsAvailable, 'Set E2E_EMAIL and E2E_PASSWORD for a dedicated test user.');

  test('filters evidence by date range and category with accessible alternatives', async ({
    page,
  }) => {
    await page.goto('/auth/sign-in');
    await page.getByLabel('Email address').fill(process.env.E2E_EMAIL ?? '');
    await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.goto('/app/insights');
    await expect(page.getByRole('heading', { name: 'Budget insights' })).toBeVisible();
    await page.getByLabel('Date range').selectOption('last3');
    const categories = page.locator('.insights-category-checklist input:not(:first-child)');
    if (await categories.count()) await categories.first().check();
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByText('Recommended next action')).toBeVisible();
    await expect(page.getByRole('table', { name: /Monthly planned and actual/ })).toBeVisible();
    await expect(page.getByText(/Action:/).first()).toBeVisible();
  });
});
