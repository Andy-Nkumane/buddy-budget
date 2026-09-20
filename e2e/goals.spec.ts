import { expect, test } from '@playwright/test';

const credentialsAvailable = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

test.describe('financial goals', () => {
  test.skip(!credentialsAvailable, 'Set E2E_EMAIL and E2E_PASSWORD for a dedicated test user.');

  test('creates a sinking fund and records a contribution', async ({ page }) => {
    await page.goto('/auth/sign-in');
    await page.getByLabel('Email address').fill(process.env.E2E_EMAIL ?? '');
    await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.goto('/app/goals');
    await page
      .getByRole('button', { name: /new goal|create your first goal/i })
      .first()
      .click();
    await page.getByLabel('Goal name').fill(`Annual insurance ${Date.now()}`);
    await page.getByLabel('Target amount').fill('12000');
    await page.getByLabel('Starting balance').fill('2000');
    await page.getByLabel('Desired monthly contribution').fill('1000');
    await page.getByRole('button', { name: 'Save goal' }).click();
    await page.getByRole('button', { name: 'Add contribution' }).first().click();
    await page.getByLabel('Amount').fill('500');
    await page.getByLabel('Budget month').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Record contribution' }).click();
    await expect(page.getByText(/2,500\.00/)).toBeVisible();
  });
});
