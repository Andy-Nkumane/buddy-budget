import { expect, test } from '@playwright/test';

const enabled = Boolean(
  process.env.E2E_TEMPLATE_SHARE_DISPOSABLE === 'true' &&
  process.env.E2E_OWNER_EMAIL &&
  process.env.E2E_RECIPIENT_EMAIL &&
  process.env.E2E_PASSWORD,
);

const signIn = async (page: import('@playwright/test').Page, email: string) => {
  await page.goto('/auth/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Sign in' }).click();
};

test('anonymous visitors can preview a redacted template', async ({ page }) => {
  await page.route('**/functions/v1/share-report', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
      body: JSON.stringify({
        expires_at: '2026-10-19T00:00:00Z',
        snapshot: {
          schemaVersion: 1,
          name: 'Shared essentials',
          version: 1,
          includesAmounts: false,
          items: [
            {
              key: 'preview-item',
              name: 'Housing',
              itemType: 'expense',
              categoryName: 'Essentials',
              sortOrder: 0,
            },
          ],
        },
      }),
    }),
  );
  await page.goto('/template#abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ');
  await expect(page.getByRole('heading', { name: 'Shared essentials' })).toBeVisible();
  await expect(page.getByText(/kept their amounts private/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account to copy' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex,nofollow,noarchive',
  );
});

test.describe('copyable template links', () => {
  test.skip(!enabled, 'Set disposable template-share credentials and enable the guarded flow.');

  test('publishes a redacted template and copies it into another account', async ({ browser }) => {
    const ownerContext = await browser.newContext();
    await ownerContext.grantPermissions(['clipboard-read', 'clipboard-write']);
    const owner = await ownerContext.newPage();
    await signIn(owner, process.env.E2E_OWNER_EMAIL ?? '');
    await owner.goto('/app/templates');
    await owner.getByRole('button', { name: 'Share template' }).click();
    await expect(owner.getByText('Amount hidden').first()).toBeVisible();
    await owner.getByRole('button', { name: 'Publish template snapshot' }).click();
    await owner.getByRole('button', { name: 'Copy link' }).click();
    await expect(owner.getByRole('button', { name: 'Copied' })).toBeVisible();
    const link = await owner.getByLabel('Template share link').inputValue();

    const recipientContext = await browser.newContext();
    const recipient = await recipientContext.newPage();
    await signIn(recipient, process.env.E2E_RECIPIENT_EMAIL ?? '');
    await recipient.goto(link);
    await expect(recipient.getByText(/kept their amounts private/)).toBeVisible();
    await recipient.getByLabel('Your template name').fill('Copied shared plan');
    await recipient.getByRole('button', { name: 'Copy to my templates' }).click();
    await expect(recipient).toHaveURL(/\/app\/templates/);
    await expect(recipient.getByText('Copied shared plan')).toBeVisible();

    await recipientContext.close();
    await ownerContext.close();
  });
});
