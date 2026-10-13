import { expect, test } from '@playwright/test';
import path from 'node:path';

const credentialsAvailable = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

test.describe('CSV transaction import', () => {
  test.skip(!credentialsAvailable, 'Set E2E_EMAIL and E2E_PASSWORD for a dedicated test user.');

  test('reviews a local statement, imports it once, and undoes the batch', async ({ page }) => {
    await page.goto('/auth/sign-in');
    await page.getByLabel('Email address').fill(process.env.E2E_EMAIL ?? '');
    await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/app\//);
    await page.goto('/app/transactions');

    await page.getByRole('button', { name: 'Import CSV' }).click();
    const dialog = page.getByRole('dialog', { name: 'Import bank statement' });
    await expect(dialog.getByText('Your statement stays on this device.')).toBeVisible();
    await dialog
      .locator('input[type="file"]')
      .setInputFiles(path.join(process.cwd(), 'e2e/fixtures/safe-bank-statement.csv'));
    await dialog.getByRole('button', { name: 'Review transactions' }).click();
    await expect(dialog.getByText('2 ready')).toBeVisible();
    await dialog.getByRole('button', { name: 'Import 2 transactions' }).click();
    await expect(page.getByText('2 transactions imported.')).toBeVisible();
    await expect(
      page.locator('.transaction-row').filter({ hasText: 'E2E CSV coffee' }),
    ).toBeVisible();

    const batch = page.locator('.import-batch').filter({ hasText: 'safe-bank-statement.csv' });
    await batch.getByRole('button', { name: 'Undo' }).click();
    await page
      .getByRole('dialog', { name: 'Undo CSV import?' })
      .getByRole('button', { name: 'Undo import' })
      .click();
    await expect(page.getByText('CSV import undone.')).toBeVisible();
    await expect(
      page.locator('.transaction-row').filter({ hasText: 'E2E CSV coffee' }),
    ).toBeHidden();
  });
});
