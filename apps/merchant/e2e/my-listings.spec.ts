import { expect, test } from '@playwright/test';
import { createListingViaApi, signUpViaApi } from './helpers';

test('manage listing statuses from the list', async ({ page }) => {
  await signUpViaApi(page);
  await createListingViaApi(page, { title: 'E2E bicycle', price: 450_000 });
  await createListingViaApi(page, { title: 'E2E lamp', price: null });

  await page.goto('/');
  const bike = page.getByRole('listitem', { name: 'E2E bicycle' });
  const lamp = page.getByRole('listitem', { name: 'E2E lamp' });
  await expect(bike.getByText('Active')).toBeVisible();
  await expect(bike.getByText('UAH 4,500')).toBeVisible();
  await expect(lamp.getByText('Price on request')).toBeVisible();

  await bike.getByRole('button', { name: 'Pause' }).click();
  await expect(bike.getByText('Paused')).toBeVisible();

  await page.getByRole('button', { name: 'Paused', exact: true }).click();
  await expect(page).toHaveURL(/status=paused/);
  await expect(lamp).toHaveCount(0);
  await expect(bike).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await bike.getByRole('button', { name: 'Mark as sold' }).click();
  await expect(page.getByText('No paused listings.')).toBeVisible();

  await page.getByRole('button', { name: 'Sold', exact: true }).click();
  await expect(bike.getByText('Sold')).toBeVisible();
  await expect(bike.getByRole('button')).toHaveText(['Delete']);

  // State comes from the API, not the client: it survives a reload.
  await page.reload();
  await expect(bike.getByText('Sold')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await bike.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('No sold listings.')).toBeVisible();

  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(lamp).toBeVisible();
  await expect(page.getByText('1 listing', { exact: true })).toBeVisible();
});
