import Link from 'next/link';
import { pagerItems } from '../lib/pagination';

type Props = {
  page: number;
  totalPages: number;
  /** URL of a page, keeping the rest of the current query. */
  hrefFor: (page: number) => string;
};

export function Pagination({ page, totalPages, hrefFor }: Props) {
  if (totalPages <= 1) return null;
  const items = pagerItems(page, totalPages);

  return (
    <nav className="pagination" aria-label="Pagination">
      {page > 1 && page <= totalPages ? (
        <Link href={hrefFor(page - 1)} rel="prev">
          ← Previous
        </Link>
      ) : (
        <span className="pagination__disabled">← Previous</span>
      )}
      {items.map((item) =>
        item.type === 'gap' ? (
          <span key={item.key} className="pagination__gap">
            …
          </span>
        ) : item.page === page ? (
          <span key={item.page} className="pagination__current" aria-current="page">
            {item.page}
          </span>
        ) : (
          <Link key={item.page} href={hrefFor(item.page)}>
            {item.page}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} rel="next">
          Next →
        </Link>
      ) : (
        <span className="pagination__disabled">Next →</span>
      )}
    </nav>
  );
}
