import { expect, test } from '@playwright/test';

test('public calculator carries an approved plan to registration', async ({ context, page }) => {
  await page.goto('/calculator');
  await expect(page).toHaveTitle(/Monthly Budget Calculator/);
  const amounts = page.getByLabel('Monthly amount');
  await amounts.nth(0).fill('10000.00');
  await amounts.nth(1).fill('4000.00');
  await expect(page.getByText(/6.*000[.,]00/)).toBeVisible();
  await page.getByRole('button', { name: 'Create an account and save this plan' }).click();
  await expect(page).toHaveURL(/\/auth\/register\?starter=calculator$/);
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  const state = await context.storageState();
  const stored = state.origins
    .flatMap((origin) => origin.localStorage)
    .find((entry) => entry.name === 'buddy-budget-approved-demo-plan')?.value;
  expect(stored).not.toBeNull();
  expect(stored).not.toContain('transactions');
});
