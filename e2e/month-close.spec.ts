import { expect, test } from '@playwright/test';

const credentialsAvailable = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

test.describe('month close and adjustments', () => {
  test.skip(!credentialsAvailable, 'Set E2E_EMAIL and E2E_PASSWORD for a dedicated test user.');

  test('closes and reopens an editable month with an audit trail', async ({ page }) => {
    await page.goto('/auth/sign-in');
    await page.getByLabel('Email address').fill(process.env.E2E_EMAIL ?? '');
    await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.goto('/app/budget/current');
    await page.getByRole('button', { name: 'Close month' }).click();
    await expect(page.getByText('Uncategorised transactions')).toBeVisible();
    await page.getByLabel('I reviewed these results').check();
    await page.getByRole('dialog').getByRole('button', { name: 'Close month' }).click();
    await expect(page.getByRole('heading', { name: 'Month closed' })).toBeVisible();
    await page.getByRole('button', { name: 'Reopen month' }).click();
    await page.getByRole('button', { name: 'Confirm reopen' }).click();
    await expect(page.getByRole('heading', { name: 'Ready to close?' })).toBeVisible();
    await page.getByText('Activity trail').click();
    await expect(page.getByText('reopened')).toBeVisible();
  });
});
