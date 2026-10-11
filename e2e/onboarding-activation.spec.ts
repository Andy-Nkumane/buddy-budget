import { expect, test, type Page } from '@playwright/test';

type PathName = 'BLANK' | 'STARTER' | 'CSV' | 'TRANSFER';

const credentials = (path: PathName) => ({
  email: process.env[`E2E_ONBOARDING_${path}_EMAIL`] ?? '',
  password: process.env[`E2E_ONBOARDING_${path}_PASSWORD`] ?? '',
});

const credentialsAvailable = (path: PathName) => {
  const account = credentials(path);
  return Boolean(account.email && account.password);
};

const signIn = async (page: Page, path: PathName) => {
  const account = credentials(path);
  await page.goto('/auth/sign-in');
  await page.getByLabel('Email address').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/onboarding/);
};

const continueToPlan = async (page: Page) => {
  await page.getByRole('button', { name: 'Continue' }).click();
};

const finish = async (page: Page) => {
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Create my dashboard' }).click();
  await expect(page).toHaveURL(/\/app\/budget\//);
};

test.describe('onboarding activation paths', () => {
  test('creates a blank first dashboard', async ({ page }) => {
    test.skip(!credentialsAvailable('BLANK'), 'Set dedicated blank onboarding credentials.');
    await signIn(page, 'BLANK');
    await page.getByRole('button', { name: /Build a simple plan/ }).click();
    await continueToPlan(page);
    await finish(page);
  });

  test('creates a dashboard from a curated starter', async ({ page }) => {
    test.skip(!credentialsAvailable('STARTER'), 'Set dedicated starter onboarding credentials.');
    await signIn(page, 'STARTER');
    await page.getByRole('button', { name: /Use a curated starter/ }).click();
    await continueToPlan(page);
    await page.getByRole('button', { name: 'Choose a starter template' }).click();
    const dialog = page.getByRole('dialog', { name: 'Starter template library' });
    await dialog.getByRole('radio', { name: /Minimal essentials/ }).check();
    await dialog.getByRole('button', { name: 'Use this starting point' }).click();
    await finish(page);
  });

  test('creates a dashboard from a current-month CSV', async ({ page }) => {
    test.skip(!credentialsAvailable('CSV'), 'Set dedicated CSV onboarding credentials.');
    await signIn(page, 'CSV');
    await page.getByRole('button', { name: /Import a bank statement/ }).click();
    await continueToPlan(page);
    const today = new Date().toISOString().slice(0, 10);
    await page.getByLabel('Bank statement CSV').setInputFiles({
      name: 'current-month.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(`Date,Description,Amount\n${today},Groceries,-25.00\n`),
    });
    await page.getByRole('button', { name: 'Preview statement' }).click();
    await finish(page);
  });

  test('consumes an approved acquisition plan once', async ({ page }) => {
    test.skip(!credentialsAvailable('TRANSFER'), 'Set dedicated transfer onboarding credentials.');
    await page.addInitScript(() => {
      localStorage.setItem(
        'buddy-budget-approved-demo-plan',
        JSON.stringify({
          version: 1,
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          currencyCode: 'ZAR',
          templateName: 'Transferred plan',
          items: [
            {
              name: 'Income',
              itemType: 'income',
              categoryName: 'Earnings',
              amountMinor: 100000,
            },
          ],
        }),
      );
    });
    await signIn(page, 'TRANSFER');
    await page.getByRole('button', { name: /Use my saved plan/ }).click();
    await continueToPlan(page);
    await finish(page);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('buddy-budget-approved-demo-plan')))
      .toBeNull();
  });
});
