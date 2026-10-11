import { expect, test } from '@playwright/test';
import { signUpViaApi } from './helpers';

test('create a listing, then edit it', async ({ page }) => {
  await signUpViaApi(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'New listing' }).first().click();
  await expect(page.getByRole('heading', { name: 'New listing' })).toBeVisible();

  // Client-side validation with the shared schema: nothing is sent.
  await page.getByRole('button', { name: 'Publish listing' }).click();
  await expect(page.getByText('Title must be at least 3 characters')).toBeVisible();

  await page.getByLabel('Title').fill('E2E road bike');
  await page.getByLabel('Category').selectOption({ label: 'Cars' });
  await page.getByLabel('Description').fill('Light aluminium frame, 21 gears.');
  await page.getByLabel('Price').fill('12 500,50');
  await page.getByLabel('City').fill('Lviv');
  await page.getByRole('button', { name: 'Publish listing' }).click();

  await expect(page.getByText('Listing published.')).toBeVisible();
  await expect(page).toHaveURL(/\/listings\/[0-9a-f-]+\/edit$/);
  const id = page.url().split('/').at(-2)!;

  // What the API stored, read back through the API.
  const stored = await (await page.request.get(`/api/listings/${id}`)).json();
  expect(stored).toMatchObject({ title: 'E2E road bike', price: 1_250_050, currency: 'UAH', city: 'Lviv' });

  await page.reload();
  await expect(page.getByLabel('Price')).toHaveValue('12500.50');
  await page.getByLabel('Title').fill('E2E road bike (new tyres)');
  await page.getByLabel('Price').fill('');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page).toHaveURL(/\/$/);
  const row = page.getByRole('listitem', { name: 'E2E road bike (new tyres)' });
  await expect(row.getByText('Price on request')).toBeVisible();
  await expect(row.getByText(/Transport \/ Cars · Lviv/)).toBeVisible();
});
