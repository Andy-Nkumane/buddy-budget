import path from 'node:path';
import { expect, test } from '@playwright/test';

const enabled = Boolean(
  process.env.E2E_RESTORE_DISPOSABLE === 'true' &&
  process.env.E2E_EMAIL &&
  process.env.E2E_PASSWORD,
);

test.describe('backup restore', () => {
  test.skip(!enabled, 'Set disposable restore credentials and E2E_RESTORE_DISPOSABLE=true.');

  test('validates and merges a safe JSON backup', async ({ page }) => {
    await page.goto('/auth/sign-in');
    await page.getByLabel('Email address').fill(process.env.E2E_EMAIL ?? '');
    await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.goto('/app/settings');
    await page.getByRole('button', { name: 'Restore backup' }).click();
    await page
      .getByLabel('Buddy Budget JSON backup')
      .setInputFiles(path.resolve('e2e/fixtures/backup-v10-empty.json'));
    await expect(page.getByRole('heading', { name: 'Validated backup' })).toBeVisible();
    await page.getByRole('button', { name: 'Merge validated backup' }).click();
    await expect(page.getByRole('heading', { name: 'Restore completed' })).toBeVisible();
  });
});
