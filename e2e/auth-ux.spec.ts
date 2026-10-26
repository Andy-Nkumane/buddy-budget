import { expect, test } from '@playwright/test';

test('password entry remains accessible and usable at the configured viewport', async ({
  page,
}) => {
  await page.goto('/auth/register');

  const password = page.getByLabel('Password', { exact: true });
  await expect(password).toHaveAttribute('autocomplete', 'new-password');
  await expect(password).toHaveAttribute('type', 'password');
  await password.fill('a long local test passphrase');

  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('a long local test passphrase');
  await expect(page.getByText(/maximum 72 UTF-8 bytes/i)).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    'document.documentElement.scrollWidth > document.documentElement.clientWidth',
  );
  expect(hasHorizontalOverflow).toBe(false);
});
