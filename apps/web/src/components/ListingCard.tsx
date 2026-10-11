import { formatDate, formatPrice, type Listing } from '@classifieds/shared';
import Link from 'next/link';
import { publicAssetUrl } from '../config';

type Props = {
  listing: Listing;
  /** "Parent / Child" category label, when known. */
  categoryLabel?: string;
};

export function ListingCard({ listing, categoryLabel }: Props) {
  const cover = listing.photos[0];

  return (
    <article className="card">
      <Link href={`/listings/${listing.id}`} className="card__link">
        <div className="card__image">
          {cover ? (
            // Photos come straight from the API with an immutable cache (DECISIONS D30).
            <img src={publicAssetUrl(cover.url)} alt="" loading="lazy" />
          ) : (
            <span className="card__no-photo">No photo</span>
          )}
        </div>
        <div className="card__body">
          <h2 className="card__title">{listing.title}</h2>
          <p className="card__price">{formatPrice(listing.price, listing.currency)}</p>
          <p className="card__meta">
            {listing.city} · <time dateTime={listing.createdAt}>{formatDate(listing.createdAt)}</time>
          </p>
          {categoryLabel && <p className="card__meta">{categoryLabel}</p>}
        </div>
      </Link>
    </article>
  );
}
