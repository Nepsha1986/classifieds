import type { Listing } from '@classifieds/shared';
import { currencyDigits } from '@classifieds/shared';

/** A plain-text summary for `<meta name="description">`: whitespace collapsed, cut at a word. */
export function summarize(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:!?-]+$/, '')}…`;
}

/**
 * schema.org `Product` with an `Offer`, so search engines can show price and availability.
 * Listings without a price get no `price` (the offer is still there).
 */
export function listingJsonLd(listing: Listing, url: string, imageUrls: string[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: summarize(listing.description, 500),
    url,
    ...(imageUrls.length > 0 ? { image: imageUrls } : {}),
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: listing.currency,
      ...(listing.price !== null
        ? {
            price: (listing.price / 10 ** currencyDigits(listing.currency)).toFixed(
              currencyDigits(listing.currency),
            ),
          }
        : {}),
      availability: listing.status === 'sold' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      areaServed: listing.city,
    },
  };
}

/** JSON for an inline `<script>`: `<` escaped so listing text can never close the script tag. */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
