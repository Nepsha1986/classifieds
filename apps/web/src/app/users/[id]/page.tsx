import { categoryLabels, formatDate } from '@classifieds/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ListingGrid } from '../../../components/ListingGrid';
import { Pagination } from '../../../components/Pagination';
import { getUser } from '../../../lib/data';
import { api } from '../../../lib/endpoints';
import {
  buildHref,
  canonicalQueryString,
  firstParam,
  parsePage,
  rawQueryString,
  type RawSearchParams,
} from '../../../lib/search-params';

const PROFILE_PAGE_SIZE = 24;

type Props = { params: Promise<{ id: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const seller = await getUser((await params).id);
  if (!seller) return { title: 'Seller not found', robots: { index: false } };
  return {
    title: `${seller.name} — seller`,
    description: `Listings by ${seller.name}${seller.city ? ` in ${seller.city}` : ''} on Classifieds.`,
    alternates: { canonical: `/users/${seller.id}` },
  };
}

export default async function SellerPage({ params, searchParams }: Props) {
  const [{ id }, raw] = await Promise.all([params, searchParams]);
  const seller = await getUser(id);
  if (!seller) notFound();

  const page = parsePage(firstParam(raw, 'page'));
  const path = `/users/${seller.id}`;
  if (canonicalQueryString({ page }) !== rawQueryString(raw)) redirect(buildHref(path, { page }));

  const [result, categories] = await Promise.all([
    api.searchListings({ seller: seller.id, page, pageSize: PROFILE_PAGE_SIZE }),
    api.categories(),
  ]);

  return (
    <>
      <section className="panel profile">
        <h1>{seller.name}</h1>
        <p className="muted">
          {seller.city && <>{seller.city} · </>}
          On Classifieds since <time dateTime={seller.createdAt}>{formatDate(seller.createdAt)}</time>
        </p>
        {seller.phone && (
          <a className="button" href={`tel:${seller.phone.replace(/[^\d+]/g, '')}`}>
            Call {seller.phone}
          </a>
        )}
      </section>

      <div className="page-heading">
        <h2>Listings</h2>
        <p className="muted">{result.total === 1 ? '1 active listing' : `${result.total} active listings`}</p>
      </div>

      {result.items.length > 0 ? (
        <ListingGrid listings={result.items} categoryLabels={categoryLabels(categories)} />
      ) : result.total > 0 ? (
        <div className="notice">
          <p>There are no listings on this page.</p>
          <Link href={path}>Go to the first page</Link>
        </div>
      ) : (
        <div className="notice">
          <p>{seller.name} has no active listings right now.</p>
        </div>
      )}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        hrefFor={(p) => buildHref(path, { page: p })}
      />
    </>
  );
}
