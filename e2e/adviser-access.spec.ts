import { expect, test } from '@playwright/test';

const enabled = Boolean(
  process.env.E2E_ADVISER_DISPOSABLE === 'true' &&
  process.env.E2E_OWNER_EMAIL &&
  process.env.E2E_ADVISER_EMAIL &&
  process.env.E2E_PASSWORD,
);

const signIn = async (page: import('@playwright/test').Page, email: string) => {
  await page.goto('/auth/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Sign in' }).click();
};

test.describe('time-limited adviser access', () => {
  test.skip(!enabled, 'Set verified disposable owner/adviser credentials and enable the flow.');

  test('owner grants and revokes read-only adviser access', async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    await signIn(owner, process.env.E2E_OWNER_EMAIL ?? '');
    await owner.goto('/app/household');
    await owner.getByLabel('Adviser email').fill(process.env.E2E_ADVISER_EMAIL ?? '');
    await expect(owner.getByRole('checkbox', { name: 'Monthly summary' })).toBeChecked();
    await expect(
      owner.getByRole('checkbox', { name: 'Allow scoped JSON export' }),
    ).not.toBeChecked();
    await owner.getByRole('button', { name: 'Create adviser invitation' }).click();
    const invitationUrl = await owner.locator('.adviser-access code').textContent();
    expect(invitationUrl).toBeTruthy();

    const adviserContext = await browser.newContext();
    const adviser = await adviserContext.newPage();
    await signIn(adviser, process.env.E2E_ADVISER_EMAIL ?? '');
    await adviser.goto(invitationUrl ?? '/app/adviser');
    await adviser.getByRole('button', { name: 'Accept access' }).click();
    await expect(adviser.getByText('Buddy Budget adviser mode')).toBeVisible();
    await expect(adviser.getByText(/cannot edit, add, delete, reshare, or export/)).toBeVisible();
    await expect(adviser.getByRole('button', { name: 'Download approved JSON' })).toHaveCount(0);

    await owner.getByRole('button', { name: 'Revoke' }).last().click();
    await adviser.reload();
    await expect(adviser.getByRole('heading', { name: 'No active adviser access' })).toBeVisible();

    await adviserContext.close();
    await ownerContext.close();
  });
});
