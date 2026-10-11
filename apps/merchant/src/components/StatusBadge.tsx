import type { ListingStatus } from '@classifieds/shared';

export const STATUS_LABELS: Record<ListingStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  sold: 'Sold',
};

export function StatusBadge({ status }: { status: ListingStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>;
}
