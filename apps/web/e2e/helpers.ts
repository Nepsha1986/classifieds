import { request, type APIRequestContext } from '@playwright/test';

const API = 'http://localhost:4000';
// better-auth requires a trusted Origin on cookie-authenticated POSTs (DECISIONS D12).
const ORIGIN = 'http://localhost:5173';

export type Seeded = { sellerId: string; sellerName: string; listingId: string; title: string; word: string };

/** A fresh seller with one active listing (with a unique word in the title) and one paused listing. */
export async function seedSeller(): Promise<Seeded & { pausedId: string; api: APIRequestContext }> {
  const api = await request.newContext({ baseURL: API, extraHTTPHeaders: { Origin: ORIGIN } });
  const stamp = Date.now().toString(36);
  const word = `zebra${stamp}`;
  const sellerName = `E2E Seller ${stamp}`;
  const signUp = await api.post('/api/auth/sign-up/email', {
    data: { name: sellerName, email: `web-${stamp}@test.io`, password: 'password123' },
  });
  if (!signUp.ok()) throw new Error(`sign-up failed: ${signUp.status()}`);
  await api.patch('/api/me', { data: { city: 'Kyiv', phone: '+380 50 123 45 67' } });
  const me = (await (await api.get('/api/me')).json()) as { id: string };

  const categories = (await (await api.get('/api/categories')).json()) as {
    slug: string;
    children: { id: number; slug: string }[];
  }[];
  const cars = categories.flatMap((c) => c.children).find((c) => c.slug === 'cars')!;

  const create = async (title: string) => {
    const res = await api.post('/api/listings', {
      data: {
        title,
        description: `Line one of ${title}.\nLine two.`,
        price: 1_234_500,
        currency: 'UAH',
        city: 'Kyiv',
        categoryId: cars.id,
        attributes: { mileage: 120000, fuel: 'diesel' },
      },
    });
    if (!res.ok()) throw new Error(`create failed: ${res.status()} ${await res.text()}`);
    return ((await res.json()) as { id: string }).id;
  };
  const title = `Car ${word} for sale`;
  const listingId = await create(title);
  const pausedId = await create(`Paused ${word} car`);
  await api.patch(`/api/listings/${pausedId}/status`, { data: { status: 'paused' } });

  return { api, sellerId: me.id, sellerName, listingId, pausedId, title, word };
}
