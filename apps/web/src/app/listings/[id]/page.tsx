import { formatDate, formatPrice } from '@classifieds/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { publicAssetUrl, siteUrl } from '../../../config';
import { categoryPath } from '../../../lib/categories';
import { getListing, getUser } from '../../../lib/data';
import { api } from '../../../lib/endpoints';
import { jsonForScript, listingJsonLd, summarize } from '../../../lib/listing-seo';
import { buildHref } from '../../../lib/search-params';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const listing = await getListing((await params).id);
  if (!listing) return { title: 'Listing not found', robots: { index: false } };

  const price = formatPrice(listing.price, listing.currency);
  const description = summarize(`${price} · ${listing.city}. ${listing.description}`);
  const path = `/listings/${listing.id}`;
  return {
    title: listing.title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: path,
      title: listing.title,
      description,
      images: listing.photos.map((photo) => ({ url: publicAssetUrl(photo.url) })),
    },
  };
}

export default async function ListingPage({ params }: Props) {
  // Unknown, deleted and paused listings are all a 404 from the API (DECISIONS D15).
  const listing = await getListing((await params).id);
  if (!listing) notFound();

  const [seller, categories] = await Promise.all([getUser(listing.sellerId), api.categories()]);
  const path = categoryPath(categories, listing.categoryId);
  const photoUrls = listing.photos.map((photo) => publicAssetUrl(photo.url));
  const [cover, ...morePhotos] = photoUrls;
  const attributes = Object.entries(listing.attributes);
  const sold = listing.status === 'sold';

  return (
    <article className="listing">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonForScript(listingJsonLd(listing, `${siteUrl()}/listings/${listing.id}`, photoUrls)),
        }}
      />

      <nav className="breadcrumbs" aria-label="Breadcrumbs">
        <Link href="/">All listings</Link>
        {path.map((category) => (
          <span key={category.id}>
            {' / '}
            <Link href={buildHref('/', { category: category.slug })}>{category.name}</Link>
          </span>
        ))}
      </nav>

      <div className="listing__layout">
        <div className="listing__main">
          <div className="gallery">
            {cover ? (
              <a href={cover} className="gallery__cover">
                {/* Photos come straight from the API with an immutable cache (DECISIONS D30). */}
                <img src={cover} alt={`${listing.title} — photo 1`} />
              </a>
            ) : (
              <div className="gallery__cover gallery__cover--empty">No photos</div>
            )}
            {morePhotos.length > 0 && (
              <ul className="gallery__thumbs">
                {morePhotos.map((url, index) => (
                  <li key={url}>
                    <a href={url}>
                      <img src={url} alt={`${listing.title} — photo ${index + 2}`} loading="lazy" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <section className="listing__section">
            <h2>Description</h2>
            <p className="listing__description">{listing.description}</p>
          </section>

          {attributes.length > 0 && (
            <section className="listing__section">
              <h2>Details</h2>
              <dl className="attributes">
                {attributes.map(([key, value]) => (
                  <div key={key}>
                    <dt>{humanizeKey(key)}</dt>
                    <dd>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>

        <aside className="listing__aside">
          <div className="panel">
            {sold && <p className="badge badge--sold">Sold</p>}
            <h1 className="listing__title">{listing.title}</h1>
            <p className="listing__price">{formatPrice(listing.price, listing.currency)}</p>
            <p className="muted">
              {listing.city} · Posted{' '}
              <time dateTime={listing.createdAt}>{formatDate(listing.createdAt)}</time>
            </p>
          </div>

          {seller && (
            <div className="panel seller">
              <h2>Seller</h2>
              <p className="seller__name">
                <Link href={`/users/${seller.id}`}>{seller.name}</Link>
              </p>
              {seller.city && <p className="muted">{seller.city}</p>}
              <p className="muted">
                On Classifieds since <time dateTime={seller.createdAt}>{formatDate(seller.createdAt)}</time>
              </p>
              {seller.phone && !sold && (
                <a className="button seller__phone" href={`tel:${seller.phone.replace(/[^\d+]/g, '')}`}>
                  Call {seller.phone}
                </a>
              )}
              <Link href={`/users/${seller.id}`}>All listings by {seller.name}</Link>
            </div>
          )}
        </aside>
      </div>
    </article>
  );
}

/** `room_count` / `engineVolume` → "Room count" / "Engine volume". */
function humanizeKey(key: string): string {
  const words = key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
