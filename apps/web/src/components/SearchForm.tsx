import { DEFAULT_CURRENCY, type Category, type ListingSort } from '@classifieds/shared';
import Link from 'next/link';
import type { Filters } from '../lib/filters';

const SORT_LABELS: Record<ListingSort, string> = {
  relevance: 'Best match',
  newest: 'Newest first',
  oldest: 'Oldest first',
  price_asc: 'Cheapest first',
  price_desc: 'Most expensive first',
};

const CURRENCIES = ['UAH', 'USD', 'EUR'];

type Props = {
  filters: Filters;
  categories: readonly Category[];
};

/**
 * A plain GET form: submitting it navigates to `/?…`, so search works without JavaScript and every
 * result page has a shareable URL. The page then redirects to the canonical URL (empty fields dropped).
 * Fields are uncontrolled with `defaultValue`; `key` remounts the form when the URL changes.
 */
export function SearchForm({ filters, categories }: Props) {
  const defaultSort: ListingSort = filters.q ? 'relevance' : 'newest';
  const sorts: ListingSort[] = filters.q
    ? ['relevance', 'newest', 'oldest', 'price_asc', 'price_desc']
    : ['newest', 'oldest', 'price_asc', 'price_desc'];

  return (
    <form key={JSON.stringify(filters)} action="/" method="get" role="search" className="search-form">
      <div className="search-form__query">
        <label className="visually-hidden" htmlFor="search-q">
          Search
        </label>
        <input
          id="search-q"
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="What are you looking for?"
          maxLength={200}
        />
        <button type="submit" className="button">
          Search
        </button>
      </div>

      <div className="search-form__filters">
        <label>
          <span>Category</span>
          <select name="category" defaultValue={filters.category ?? ''}>
            <option value="">All categories</option>
            {categories.map((top) => (
              <optgroup key={top.id} label={top.name}>
                <option value={top.slug}>All in {top.name}</option>
                {top.children.map((child) => (
                  <option key={child.id} value={child.slug}>
                    {child.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label>
          <span>City</span>
          <input type="text" name="city" defaultValue={filters.city} placeholder="Any city" maxLength={100} />
        </label>

        <fieldset className="search-form__price">
          <legend>Price</legend>
          <input
            type="text"
            inputMode="decimal"
            name="minPrice"
            defaultValue={filters.minPrice}
            placeholder="From"
            aria-label="Minimum price"
          />
          <input
            type="text"
            inputMode="decimal"
            name="maxPrice"
            defaultValue={filters.maxPrice}
            placeholder="To"
            aria-label="Maximum price"
          />
          <select name="currency" defaultValue={filters.currency ?? ''} aria-label="Currency">
            <option value="">Any currency</option>
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </fieldset>

        <label>
          <span>Sort by</span>
          {/* The default sort submits an empty value, so adding a search query switches the default
              to "Best match" instead of pinning "Newest first". */}
          <select name="sort" defaultValue={filters.sort ?? ''}>
            {sorts.map((sort) => (
              <option key={sort} value={sort === defaultSort ? '' : sort}>
                {SORT_LABELS[sort]}
              </option>
            ))}
          </select>
        </label>

        <div className="search-form__actions">
          <button type="submit" className="button">
            Apply
          </button>
          <Link href="/" className="button button--secondary">
            Reset
          </Link>
        </div>
      </div>
      <p className="search-form__hint muted">
        Price filters compare prices in one currency ({DEFAULT_CURRENCY} unless you choose another).
      </p>
    </form>
  );
}
