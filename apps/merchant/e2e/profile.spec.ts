import { expect, test } from '@playwright/test';
import { signUpViaApi } from './helpers';

test('edit the profile', async ({ page }) => {
  const { email } = await signUpViaApi(page, 'Profile Tester');
  await page.goto('/');
  await page.getByRole('link', { name: 'Profile' }).click();
  await expect(page.getByText(email)).toBeVisible();

  await page.getByLabel('Phone').fill('not a phone');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByText('Invalid phone number')).toBeVisible();

  await page.getByLabel('Name').fill('Profile Tester Jr.');
  await page.getByLabel('Phone').fill('+380 50 123 45 67');
  await page.getByLabel('City').fill('Odesa');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('status')).toHaveText('Profile saved.');
  await expect(page.locator('.app-user')).toContainText('Profile Tester Jr.');

  await page.reload();
  await expect(page.getByLabel('Phone')).toHaveValue('+380 50 123 45 67');
  await expect(page.getByLabel('City')).toHaveValue('Odesa');

  // The profile city is the default for a new listing.
  await page.getByRole('link', { name: 'New listing' }).click();
  await expect(page.getByLabel('City')).toHaveValue('Odesa');
});
