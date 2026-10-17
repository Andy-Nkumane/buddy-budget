import { expect, test } from '@playwright/test';

test('registration explains collection and requires an unchecked acknowledgement', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/auth/register');

  const notice = page.getByRole('complementary', {
    name: 'Before you create a test account',
  });
  await expect(notice).toBeVisible();
  await expect(notice.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', /\/privacy$/);
  await expect(notice.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', /\/terms$/);
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await expect(page.getByText(/not blanket consent/i)).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    'document.documentElement.scrollWidth > document.documentElement.clientWidth',
  );
  expect(hasHorizontalOverflow).toBe(false);
});
