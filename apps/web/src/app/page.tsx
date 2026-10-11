import { categoryLabels } from '@classifieds/shared';
import Link from 'next/link';
import { ListingGrid } from '../components/ListingGrid';
import { Pagination } from '../components/Pagination';
import { api } from '../lib/endpoints';
import { buildHref, firstParam, parsePage, type RawSearchParams } from '../lib/search-params';

const FEED_PAGE_SIZE = 24;

type Props = { searchParams: Promise<RawSearchParams> };

export default async function HomePage({ searchParams }: Props) {
  const page = parsePage(firstParam(await searchParams, 'page'));
  const [result, categories] = await Promise.all([
    api.searchListings({ page, pageSize: FEED_PAGE_SIZE }),
    api.categories(),
  ]);
  const labels = categoryLabels(categories);

  return (
    <>
      <div className="page-heading">
        <h1>Latest listings</h1>
        <p className="muted">
          {result.total === 1 ? '1 listing' : `${result.total.toLocaleString('en')} listings`}
        </p>
      </div>

      {result.items.length > 0 ? (
        <ListingGrid listings={result.items} categoryLabels={labels} />
      ) : result.total > 0 ? (
        <div className="notice">
          <p>There are no listings on this page.</p>
          <Link href="/">Go to the first page</Link>
        </div>
      ) : (
        <div className="notice">
          <p>No listings yet.</p>
        </div>
      )}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        hrefFor={(p) => buildHref('/', { page: p })}
      />
    </>
  );
}
