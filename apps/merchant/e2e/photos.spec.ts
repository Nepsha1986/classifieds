import { expect, test, type Locator } from '@playwright/test';
import { createListingViaApi, pngBytes, signUpViaApi } from './helpers';

/** True once the browser has actually decoded the image served by the API. */
const isLoaded = (img: Locator) => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0);

test('upload, reorder and remove photos', async ({ page }) => {
  await signUpViaApi(page);
  const listing = await createListingViaApi(page, { title: 'E2E camera' });

  await page.goto(`/listings/${listing.id}/edit`);
  await expect(page.getByText('No photos yet.', { exact: false })).toBeVisible();

  await page.getByLabel('Add photos').setInputFiles([
    { name: 'red.png', mimeType: 'image/png', buffer: pngBytes([255, 0, 0]) },
    { name: 'green.png', mimeType: 'image/png', buffer: pngBytes([0, 255, 0]) },
  ]);
  const first = page.getByRole('img', { name: 'Photo 1' });
  const second = page.getByRole('img', { name: 'Photo 2' });
  await expect(second).toBeVisible();
  await expect(page.getByText('2 of 10')).toBeVisible();
  await expect.poll(() => isLoaded(first)).toBe(true);

  // A file that is not an image never reaches the API.
  await page
    .getByLabel('Add photos')
    .setInputFiles([{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') }]);
  await expect(page.getByRole('alert')).toHaveText('notes.txt: only JPEG, PNG or WebP images');

  const firstSrc = await first.getAttribute('src');
  const secondSrc = await second.getAttribute('src');
  await page.getByRole('listitem', { name: 'Photo 2' }).getByRole('button', { name: 'Make cover' }).click();
  await expect(first).toHaveAttribute('src', secondSrc!);
  await expect(second).toHaveAttribute('src', firstSrc!);

  // The order is stored by the API.
  await page.reload();
  await expect(page.getByRole('img', { name: 'Photo 1' })).toHaveAttribute('src', secondSrc!);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Remove photo 2' }).click();
  await expect(page.getByRole('img', { name: 'Photo 2' })).toHaveCount(0);
  await expect(page.getByText('1 of 10')).toBeVisible();

  // The cover shows in the list.
  await page.goto('/');
  const cover = page.getByRole('listitem', { name: 'E2E camera' }).locator('img');
  await expect(cover).toHaveAttribute('src', secondSrc!);
  await expect.poll(() => isLoaded(cover)).toBe(true);
});
