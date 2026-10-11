import { categoryLabels } from '@classifieds/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ListingGrid } from '../components/ListingGrid';
import { Pagination } from '../components/Pagination';
import { SearchForm } from '../components/SearchForm';
import { api } from '../lib/endpoints';
import { filtersToQuery, hasActiveFilters, parseFilters } from '../lib/filters';
import { buildHref, canonicalQueryString, rawQueryString, type RawSearchParams } from '../lib/search-params';

const FEED_PAGE_SIZE = 24;

type Props = { searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { filters } = parseFilters(await searchParams, await api.categories());
  const canonical = buildHref('/', filtersToQuery(filters));
  const title = filters.q ? `Search: ${filters.q}` : hasActiveFilters(filters) ? 'Search results' : undefined;
  return {
    ...(title ? { title } : {}),
    alternates: { canonical },
    // Filter combinations are endless; let search engines index the plain feed and listing pages.
    ...(hasActiveFilters(filters) ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function HomePage({ searchParams }: Props) {
  const raw = await searchParams;
  const categories = await api.categories();
  const { filters, apiQuery, priceCurrency } = parseFilters(raw, categories);

  // One URL per search: empty form fields, invalid values and default sorts are dropped.
  const query = filtersToQuery(filters);
  if (canonicalQueryString(query) !== rawQueryString(raw)) redirect(buildHref('/', query));

  const result = await api.searchListings({ ...apiQuery, pageSize: FEED_PAGE_SIZE });
  const labels = categoryLabels(categories);
  const filtered = hasActiveFilters(filters);
  const found = result.total === 1 ? '1 listing' : `${result.total.toLocaleString('en')} listings`;

  return (
    <>
      <div className="page-heading">
        <h1>{filters.q ? `Results for “${filters.q}”` : filtered ? 'Search results' : 'Latest listings'}</h1>
        <p className="muted" role="status">
          {filtered ? `${found} found` : found}
          {priceCurrency && ` · prices in ${priceCurrency}`}
        </p>
      </div>

      <SearchForm filters={filters} categories={categories} />

      {result.items.length > 0 ? (
        <ListingGrid listings={result.items} categoryLabels={labels} />
      ) : result.total > 0 ? (
        <div className="notice">
          <p>There are no listings on this page.</p>
          <Link href={buildHref('/', filtersToQuery({ ...filters, page: 1 }))}>Go to the first page</Link>
        </div>
      ) : (
        <div className="notice">
          {filtered ? (
            <>
              <p>Nothing matches your search. Try fewer words or wider filters.</p>
              <Link href="/">Show all listings</Link>
            </>
          ) : (
            <p>No listings yet.</p>
          )}
        </div>
      )}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        hrefFor={(page) => buildHref('/', filtersToQuery({ ...filters, page }))}
      />
    </>
  );
}
