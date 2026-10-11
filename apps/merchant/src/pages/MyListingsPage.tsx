import {
  LISTING_STATUS_TRANSITIONS,
  LISTING_STATUSES,
  listingStatusSchema,
  type Listing,
  type ListingStatus,
} from '@classifieds/shared';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { apiUrl } from '../api/client';
import { FormError } from '../components/form';
import { StatusBadge, STATUS_LABELS } from '../components/StatusBadge';
import { categoryLabels, formatDate, formatPrice } from '../format';
import { useCategories, useChangeListingStatus, useDeleteListing, useMyListings } from '../queries';

const PAGE_SIZE = 20;

/** Button text for moving a listing into a status. */
const ACTION_LABELS: Record<ListingStatus, string> = {
  active: 'Activate',
  paused: 'Pause',
  sold: 'Mark as sold',
};

export function MyListingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const parsedStatus = listingStatusSchema.safeParse(searchParams.get('status'));
  const status = parsedStatus.success ? parsedStatus.data : undefined;
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const listings = useMyListings({ status, page, pageSize: PAGE_SIZE });
  const categories = useCategories();
  const labels = useMemo(() => categoryLabels(categories.data ?? []), [categories.data]);
  const changeStatus = useChangeListingStatus();
  const deleteListing = useDeleteListing();

  const setFilter = (next: { status?: ListingStatus | undefined; page?: number }) => {
    const params = new URLSearchParams();
    if (next.status) params.set('status', next.status);
    if (next.page && next.page > 1) params.set('page', String(next.page));
    setSearchParams(params);
  };

  const onChangeStatus = (listing: Listing, to: ListingStatus) => {
    if (to === 'sold' && !window.confirm(`Mark "${listing.title}" as sold? This cannot be undone.`)) return;
    deleteListing.reset();
    changeStatus.mutate({ id: listing.id, status: to });
  };

  const onDelete = (listing: Listing) => {
    if (!window.confirm(`Delete "${listing.title}"? Its photos are deleted too.`)) return;
    changeStatus.reset();
    deleteListing.mutate(listing.id);
  };

  const data = listings.data;
  const busyId = changeStatus.isPending
    ? changeStatus.variables.id
    : deleteListing.isPending
      ? deleteListing.variables
      : undefined;

  return (
    <section>
      <div className="page-header">
        <h1>My listings</h1>
      </div>

      <nav className="tabs" aria-label="Filter by status">
        {[undefined, ...LISTING_STATUSES].map((s) => (
          <button
            key={s ?? 'all'}
            type="button"
            className={`tab${s === status ? ' active' : ''}`}
            aria-pressed={s === status}
            onClick={() => setFilter({ status: s })}
          >
            {s ? STATUS_LABELS[s] : 'All'}
          </button>
        ))}
      </nav>

      <FormError error={changeStatus.error ?? deleteListing.error} />

      {listings.isPending ? (
        <p className="muted">Loading…</p>
      ) : listings.isError ? (
        <FormError error={listings.error} />
      ) : data && data.items.length === 0 && data.total > 0 ? (
        // A page past the end, e.g. after deleting the last listing on the last page.
        <div className="empty">
          <p>Nothing on this page.</p>
          <button
            type="button"
            className="button"
            onClick={() => setFilter({ status, page: data.totalPages })}
          >
            Go to the last page
          </button>
        </div>
      ) : data && data.items.length === 0 ? (
        <div className="empty">
          <p>
            {status ? `No ${STATUS_LABELS[status].toLowerCase()} listings.` : 'You have no listings yet.'}
          </p>
        </div>
      ) : (
        data && (
          <>
            <ul className="listing-list" aria-busy={listings.isFetching}>
              {data.items.map((listing) => {
                const cover = listing.photos[0];
                const busy = busyId === listing.id;
                return (
                  <li key={listing.id} className="listing-row" aria-label={listing.title}>
                    <div className="thumb">
                      {cover ? <img src={apiUrl(cover.url)} alt="" loading="lazy" /> : <span>No photo</span>}
                    </div>
                    <div className="listing-info">
                      <div className="listing-title">
                        <strong>{listing.title}</strong>
                        <StatusBadge status={listing.status} />
                      </div>
                      <div>{formatPrice(listing.price, listing.currency)}</div>
                      <div className="muted small">
                        {[labels.get(listing.categoryId), listing.city, formatDate(listing.createdAt)]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <div className="listing-actions">
                      {LISTING_STATUS_TRANSITIONS[listing.status].map((to) => (
                        <button
                          key={to}
                          type="button"
                          className="button"
                          disabled={busy}
                          onClick={() => onChangeStatus(listing, to)}
                        >
                          {ACTION_LABELS[to]}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="button danger"
                        disabled={busy}
                        onClick={() => onDelete(listing)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {data.totalPages > 1 && (
              <nav className="pagination" aria-label="Pages">
                <button
                  type="button"
                  className="button"
                  disabled={page <= 1}
                  onClick={() => setFilter({ status, page: page - 1 })}
                >
                  Previous
                </button>
                <span className="muted">
                  Page {data.page} of {data.totalPages}
                </span>
                <button
                  type="button"
                  className="button"
                  disabled={page >= data.totalPages}
                  onClick={() => setFilter({ status, page: page + 1 })}
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )
      )}
      {data && data.total > 0 && (
        <p className="muted small">
          {data.total} listing{data.total === 1 ? '' : 's'}
        </p>
      )}
    </section>
  );
}
