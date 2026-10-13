import { expect, test } from '@playwright/test';

const enabled = Boolean(
  process.env.E2E_SHARE_DISPOSABLE === 'true' && process.env.E2E_EMAIL && process.env.E2E_PASSWORD,
);

test('an invalid public link reveals no financial information', async ({ page }) => {
  await page.route('**/functions/v1/share-report', (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
      body: JSON.stringify({ error: 'shared_report_unavailable' }),
    }),
  );
  await page.goto('/shared-report#invalid-share-token');
  await expect(
    page.getByRole('heading', { name: 'This shared report is unavailable' }),
  ).toBeVisible();
  await expect(page.getByText(/expired, been revoked, or reached its view limit/)).toBeVisible();
  await expect(page.locator('body')).not.toContainText('ZAR');
});

test.describe('privacy-safe report sharing', () => {
  test.skip(!enabled, 'Set disposable credentials and E2E_SHARE_DISPOSABLE=true.');

  test('creates, copies, opens, and revokes a limited snapshot', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/auth/sign-in');
    await page.getByLabel('Email address').fill(process.env.E2E_EMAIL ?? '');
    await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.goto('/app/settings');
    await page.getByRole('button', { name: 'Share limited report' }).click();
    await expect(page.getByLabel('Transaction-level details')).not.toBeChecked();
    await page.getByRole('button', { name: 'Preview exactly what will be shared' }).click();
    await expect(page.getByText(/Omitted: transaction details/)).toBeVisible();
    await page.getByRole('button', { name: 'Create private link' }).click();
    await page.getByRole('button', { name: 'Copy link' }).click();
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
    const link = await page.getByLabel('Shared report link').inputValue();

    const shared = await context.newPage();
    await shared.goto(link);
    await expect(shared.getByText('Limited shared snapshot')).toBeVisible();
    await expect(shared.getByText('Approved transaction details')).toHaveCount(0);
    await shared.close();

    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Revoke' }).first().click();
    await expect(page.getByText('Revoked').first()).toBeVisible();
  });
});
