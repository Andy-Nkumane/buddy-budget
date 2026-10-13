import { expect, test } from '@playwright/test';

const enabled = Boolean(
  process.env.E2E_HOUSEHOLD_DISPOSABLE === 'true' &&
  process.env.E2E_OWNER_EMAIL &&
  process.env.E2E_MEMBER_EMAIL &&
  process.env.E2E_PASSWORD,
);

const signIn = async (page: import('@playwright/test').Page, email: string) => {
  await page.goto('/auth/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Sign in' }).click();
};

test.describe('household collaboration', () => {
  test.skip(!enabled, 'Set disposable owner/member credentials and E2E_HOUSEHOLD_DISPOSABLE=true.');

  test('accepts an editor invitation and isolates household switching', async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    await signIn(owner, process.env.E2E_OWNER_EMAIL ?? '');
    await owner.goto('/app/household');
    await owner.getByLabel('Email address').fill(process.env.E2E_MEMBER_EMAIL ?? '');
    await owner.getByLabel('Role').selectOption('editor');
    await owner.getByRole('button', { name: 'Create invitation' }).click();
    const invitationUrl = await owner.locator('.household-invite__link').textContent();
    expect(invitationUrl).toBeTruthy();

    const memberContext = await browser.newContext();
    const member = await memberContext.newPage();
    await signIn(member, process.env.E2E_MEMBER_EMAIL ?? '');
    await member.goto(invitationUrl ?? '/app/household');
    await member.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(member.getByText('Your role is editor.')).toBeVisible();
    await expect(member.getByLabel('Household').first()).toContainText('editor');

    await memberContext.close();
    await ownerContext.close();
  });
});
