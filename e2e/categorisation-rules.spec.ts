import { expect, test } from '@playwright/test';

const credentialsAvailable = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

test.describe('transaction categorisation rules', () => {
  test.skip(!credentialsAvailable, 'Set E2E_EMAIL and E2E_PASSWORD for a dedicated test user.');

  test('creates, tests, disables, and deletes a user-controlled rule', async ({ page }) => {
    await page.goto('/auth/sign-in');
    await page.getByLabel('Email address').fill(process.env.E2E_EMAIL ?? '');
    await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/app\//);
    await page.goto('/app/settings/rules');

    const name = `E2E coffee ${Date.now()}`;
    await page.getByRole('button', { name: 'New rule' }).click();
    const dialog = page.getByRole('dialog', { name: 'Create rule' });
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByLabel('Description value').fill('coffee');
    await dialog.getByLabel('Type').selectOption('expense');
    await dialog.getByLabel('Cleaned description').fill('Coffee');
    await dialog.getByRole('button', { name: 'Save rule' }).click();
    const card = page.locator('.rule-card').filter({ hasText: name });
    await expect(card).toBeVisible();

    await page.getByRole('button', { name: 'Test rules' }).click();
    await expect(page.getByRole('dialog', { name: 'Rule dry run' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await card.getByRole('button', { name: 'Disable' }).click();
    await expect(card).toContainText('Disabled');
    await card.getByRole('button', { name: `Delete ${name}` }).click();
    await expect(card).toBeHidden();
  });
});
