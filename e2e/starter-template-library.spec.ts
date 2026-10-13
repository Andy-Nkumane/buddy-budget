import { expect, test } from '@playwright/test';

const credentialsAvailable = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

test.describe('starter template library', () => {
  test.skip(!credentialsAvailable, 'Set E2E_EMAIL and E2E_PASSWORD for a dedicated test user.');

  test('previews, customizes, and copies one owned starter template', async ({ page }) => {
    await page.goto('/auth/sign-in');
    await page.getByLabel('Email address').fill(process.env.E2E_EMAIL ?? '');
    await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.goto('/app/templates');

    await page.getByRole('button', { name: 'Use a starter' }).click();
    const dialog = page.getByRole('dialog', { name: 'Starter template library' });
    await dialog.getByRole('radio', { name: /Minimal essentials/ }).check();
    await expect(dialog.getByRole('heading', { name: 'Minimal essentials preview' })).toBeVisible();
    const templateName = `Playwright starter ${Date.now()}`;
    await dialog.getByLabel('Your template name').fill(templateName);
    await dialog.getByLabel('Income monthly amount').fill('25000.00');
    await dialog.getByRole('checkbox', { name: /Healthcare/ }).uncheck();
    await dialog.getByRole('button', { name: 'Create this template' }).click();

    await expect(page.getByRole('heading', { name: templateName })).toBeVisible();
    await expect(page.getByText('5 recurring items')).toBeVisible();
  });
});
