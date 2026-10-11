import { expect, test } from '@playwright/test';
import { seedSeller } from './helpers';

let seeded: Awaited<ReturnType<typeof seedSeller>>;

test.beforeAll(async () => {
  seeded = await seedSeller();
});

test.afterAll(async () => {
  await seeded.api.delete(`/api/listings/${seeded.listingId}`);
  await seeded.api.delete(`/api/listings/${seeded.pausedId}`);
  await seeded.api.dispose();
});

// Without JavaScript the browser shows only what the server rendered.
test.describe('server-rendered without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('feed lists the latest listings', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Latest listings' })).toBeVisible();
    await expect(page.locator('.card').first()).toBeVisible();
    await expect(page.getByRole('link', { name: seeded.title })).toBeVisible();
  });

  test('search form submits as a plain GET and lands on the canonical URL', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox', { name: 'Search' }).fill(seeded.word);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    // Empty fields are dropped by the redirect.
    await expect(page).toHaveURL(`/?q=${seeded.word}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Results for “${seeded.word}”`);
    await expect(page.getByRole('status')).toHaveText('1 listing found');
    await expect(page.locator('.card__title')).toHaveText([seeded.title]); // the paused one is not found

    await page.getByLabel('Category').selectOption('cars');
    await page.getByLabel('City').fill('Lviv');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page).toHaveURL(`/?q=${seeded.word}&category=cars&city=Lviv`);
    await expect(page.getByText('Nothing matches your search')).toBeVisible();
    await expect(page.getByLabel('City')).toHaveValue('Lviv');
  });

  test('price filter in major units', async ({ page }) => {
    await page.goto(`/?q=${seeded.word}&minPrice=12345&maxPrice=12345`);
    await expect(page.locator('.card__title')).toHaveText([seeded.title]);
    await page.goto(`/?q=${seeded.word}&minPrice=12346`);
    await expect(page.locator('.card')).toHaveCount(0);
  });

  test('listing page shows details, seller and SEO tags', async ({ page }) => {
    await page.goto(`/listings/${seeded.listingId}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(seeded.title);
    await expect(page).toHaveTitle(`${seeded.title} · Classifieds`);
    await expect(page.locator('.listing__price')).toHaveText('UAH 12,345');
    await expect(page.getByText('Line two.')).toBeVisible();
    await expect(page.getByText('Mileage')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Transport' })).toHaveAttribute(
      'href',
      '/?category=transport',
    );
    await expect(page.getByRole('link', { name: /^Call / })).toHaveAttribute('href', 'tel:+380501234567');
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
      'href',
      new RegExp(`/listings/${seeded.listingId}$`),
    );
    await expect(page.locator('meta[name=description]')).toHaveAttribute('content', /^UAH 12,345 · Kyiv\./);
    const jsonLd = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}',
    );
    expect(jsonLd).toMatchObject({ '@type': 'Product', name: seeded.title, offers: { price: '12345.00' } });
  });

  test('paused and unknown listings answer 404', async ({ page }) => {
    expect((await page.goto(`/listings/${seeded.pausedId}`))?.status()).toBe(404);
    expect((await page.goto('/listings/not-a-real-id'))?.status()).toBe(404);
  });

  test('seller profile lists only their active listings', async ({ page }) => {
    await page.goto(`/listings/${seeded.listingId}`);
    await page.getByRole('link', { name: `All listings by ${seeded.sellerName}` }).click();
    await expect(page).toHaveURL(`/users/${seeded.sellerId}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(seeded.sellerName);
    await expect(page.getByText('1 active listing', { exact: true })).toBeVisible();
    await expect(page.locator('.card__title')).toHaveText([seeded.title]);
    expect((await page.goto('/users/00000000-0000-4000-8000-000000000000'))?.status()).toBe(404);
  });
});

// Next.js renders the not-found UI of a `notFound()` page in the browser (the HTML is its error shell;
// the status is 404 either way), so this check needs JavaScript (DECISIONS D34).
test('a missing listing shows the not-found page', async ({ page }) => {
  expect((await page.goto(`/listings/${seeded.pausedId}`))?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to all listings' })).toBeVisible();
});

test('the page hydrates without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`/listings/${seeded.listingId}`);
  await page.waitForLoadState('networkidle');
  await page.goto(`/?q=${seeded.word}`);
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});
