import { expect, test } from '@playwright/test';

const credentialsAvailable = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

test.describe('critical monthly budget flow', () => {
  test.skip(!credentialsAvailable, 'Set E2E_EMAIL and E2E_PASSWORD for a dedicated test user.');

  test('signs in, persists a monthly edit, adds a one-off, exports, and signs out', async ({
    page,
  }) => {
    await page.goto('/auth/sign-in');
    await page.getByLabel('Email address').fill(process.env.E2E_EMAIL ?? '');
    await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/app\//);
    await page.goto('/app/budget/current');
    const firstAmount = page.locator('.money-input').first();
    await expect(firstAmount).toBeVisible();
    const original = await firstAmount.inputValue();
    const replacement = original === '123.45' ? '123.46' : '123.45';
    await firstAmount.fill(replacement);
    await expect(page.getByText('Saved').first()).toBeVisible();
    await page.reload();
    await expect(page.locator('.money-input').first()).toHaveValue(replacement);

    await page.getByRole('button', { name: 'Add expense' }).first().click();
    await page.getByLabel('Name').fill(`E2E one-off ${Date.now()}`);
    await page.getByLabel('Amount').fill('42.00');
    await page.getByRole('button', { name: 'Add expense' }).last().click();
    await expect(page.getByText(/E2E one-off/)).toBeVisible();

    await page.getByRole('link', { name: 'Months' }).first().click();
    await expect(page.locator('.month-export-format select').first()).toHaveValue('pdf');
    await page
      .getByRole('button', { name: /Download .* as PDF/ })
      .first()
      .click();
    const reportDialog = page.getByRole('dialog', { name: 'Report preview' });
    await expect(reportDialog).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PDF' }).click();
    expect((await downloadPromise).suggestedFilename()).toMatch(/buddybudget-\d{4}-\d{2}\.pdf/);
    await expect(reportDialog).toBeHidden();

    if ((page.viewportSize()?.width ?? 1000) <= 820) {
      await page.getByRole('button', { name: 'Open menu' }).click();
    }
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});
