import { deflateSync } from 'node:zlib';
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

/** A valid 1×1 PNG in the given colour, built by hand so no fixture files are needed. */
export function pngBytes([r, g, b]: [number, number, number] = [255, 0, 0]): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.from([0, r, g, b]))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
