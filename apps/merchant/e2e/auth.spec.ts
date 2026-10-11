import { expect, test } from '@playwright/test';

test('sign up, sign out, sign in again', async ({ page }) => {
  const email = `e2e-${Date.now()}@test.io`;

  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('link', { name: 'Create one' }).click();

  await page.getByLabel('Name').fill('E2E Seller');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('E2E Seller')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);

  // The session survives a reload (cookie set by the API).
  await page.reload();
  await expect(page.getByText('E2E Seller')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password');

  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('E2E Seller')).toBeVisible();
});
