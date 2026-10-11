import type { Category, Listing } from '@classifieds/shared';
import type { Page } from '@playwright/test';

/** Signs up a fresh user through the API; the session cookie lands in the page's browser context. */
export async function signUpViaApi(page: Page, name = 'E2E Seller') {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.io`;
  const res = await page.request.post('/api/auth/sign-up/email', {
    data: { name, email, password: 'password123' },
    // better-auth's CSRF check wants a trusted Origin on cookie-authenticated POSTs.
    headers: { Origin: 'http://localhost:5173' },
  });
  if (!res.ok()) throw new Error(`Sign-up failed: ${res.status()} ${await res.text()}`);
  return { name, email, password: 'password123' };
}

export async function firstLeafCategory(page: Page): Promise<Category> {
  const tree = (await (await page.request.get('/api/categories')).json()) as Category[];
  let node = tree[0]!;
  while (node.children.length > 0) node = node.children[0]!;
  return node;
}

export async function createListingViaApi(page: Page, input: { title: string; price?: number | null }) {
  const category = await firstLeafCategory(page);
  const res = await page.request.post('/api/listings', {
    data: {
      title: input.title,
      description: 'Created by an end-to-end test',
      price: input.price === undefined ? 100_000 : input.price,
      city: 'Kyiv',
      categoryId: category.id,
    },
  });
  if (!res.ok()) throw new Error(`Create failed: ${res.status()} ${await res.text()}`);
  return (await res.json()) as Listing;
}
