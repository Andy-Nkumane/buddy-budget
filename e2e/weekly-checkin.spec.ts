import { expect, test } from '@playwright/test';

const credentialsAvailable = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

test.describe('weekly budget check-in', () => {
  test.skip(!credentialsAvailable, 'Set E2E_EMAIL and E2E_PASSWORD for a dedicated test user.');

  test('opts in, previews the summary, and opts out again', async ({ page }) => {
    await page.goto('/auth/sign-in');
    await page.getByLabel('Email address').fill(process.env.E2E_EMAIL ?? '');
    await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.goto('/app/settings/check-ins');
    const optIn = page.getByRole('checkbox', { name: /Enable weekly check-ins/ });
    if (!(await optIn.isChecked())) await optIn.check();
    await page.getByRole('button', { name: 'Save preferences' }).click();
    await expect(page.getByRole('status')).toContainText('preferences saved');
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.locator('.checkin-preview h3')).toBeVisible();
    await optIn.uncheck();
    await page.getByRole('button', { name: 'Save preferences' }).click();
    await expect(page.getByRole('status')).toContainText('preferences saved');
  });
});
