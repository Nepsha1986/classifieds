import type { Listing } from '@classifieds/shared';
import { ListingCard } from './ListingCard';

type Props = {
  listings: readonly Listing[];
  categoryLabels: ReadonlyMap<number, string>;
};

export function ListingGrid({ listings, categoryLabels }: Props) {
  return (
    <ul className="listing-grid">
      {listings.map((listing) => (
        <li key={listing.id}>
          <ListingCard listing={listing} categoryLabel={categoryLabels.get(listing.categoryId)} />
        </li>
      ))}
    </ul>
  );
}
