import { expect, test } from '@playwright/test';

const credentialsAvailable = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

test.describe('cash-flow calendar', () => {
  test.skip(!credentialsAvailable, 'Set E2E_EMAIL and E2E_PASSWORD for a dedicated test user.');

  test('creates a schedule and keeps list and calendar views usable on mobile', async ({
    page,
  }) => {
    await page.goto('/auth/sign-in');
    await page.getByLabel('Email address').fill(process.env.E2E_EMAIL ?? '');
    await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.goto('/app/cash-flow');
    await page.getByRole('button', { name: 'New schedule' }).click();
    await page.getByLabel('Schedule name').fill(`Forecast test ${Date.now()}`);
    await page.getByLabel('Amount').fill('125.50');
    await page.getByRole('button', { name: 'Create schedule' }).click();
    await expect(page.getByRole('status')).toContainText('Schedule created');
    await page.getByRole('button', { name: 'Calendar' }).click();
    await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
  });
});
