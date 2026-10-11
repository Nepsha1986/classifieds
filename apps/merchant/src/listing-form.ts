import {
  createListingInputSchema,
  DEFAULT_CURRENCY,
  type Category,
  type CreateListingInput,
  type Listing,
} from '@classifieds/shared';
import type { FieldErrors, Resolver } from 'react-hook-form';
import { currencyDigits } from './format';

/** What the form holds: everything as typed text, converted to API input on submit. */
export type ListingFormValues = {
  title: string;
  description: string;
  /** Major units as typed ("1500", "1 500,50"); empty means "price on request". */
  price: string;
  currency: string;
  city: string;
  /** `<select>` value; empty until chosen. */
  categoryId: string;
};

export const CURRENCIES = ['UAH', 'USD', 'EUR'] as const;

export function emptyListingForm(city = ''): ListingFormValues {
  return { title: '', description: '', price: '', currency: DEFAULT_CURRENCY, city, categoryId: '' };
}

export function listingToForm(listing: Listing): ListingFormValues {
  return {
    title: listing.title,
    description: listing.description,
    price: listing.price === null ? '' : formatMajor(listing.price, listing.currency),
    currency: listing.currency,
    city: listing.city,
    categoryId: String(listing.categoryId),
  };
}

/** Minor units → plain major-unit text for an input ("12500.5" → "12500.50", whole amounts without decimals). */
export function formatMajor(minor: number, currency: string): string {
  const digits = currencyDigits(currency);
  const factor = 10 ** digits;
  return minor % factor === 0 ? String(minor / factor) : (minor / factor).toFixed(digits);
}

/**
 * Typed major units → minor units. Accepts spaces as thousands separators and a comma or dot as the
 * decimal mark. Returns `null` for an empty field and `undefined` for text that is not a price.
 */
export function parseMajor(text: string, currency: string): number | null | undefined {
  // `\s` also matches no-break spaces, which number formatting uses as thousands separators.
  const normalized = text.replace(/\s/g, '').replace(',', '.');
  if (normalized === '') return null;
  const digits = currencyDigits(currency);
  const pattern = digits > 0 ? new RegExp(`^\\d+(\\.\\d{1,${digits}})?$`) : /^\d+$/;
  if (!pattern.test(normalized)) return undefined;
  const [whole = '0', fraction = ''] = normalized.split('.');
  return Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0') || '0');
}

/**
 * Validates the form with the shared `createListingInputSchema` (the API's own rules), so the client
 * never keeps a second copy of them. Field errors are keyed by the form's field names.
 */
export const listingFormResolver: Resolver<ListingFormValues, unknown, CreateListingInput> = async (
  values,
) => {
  const errors: FieldErrors<ListingFormValues> = {};
  const price = parseMajor(values.price, values.currency || DEFAULT_CURRENCY);
  if (price === undefined) {
    errors.price = { type: 'format', message: 'Enter a price like 1500 or 1500.50, or leave it empty' };
  }

  const result = createListingInputSchema.safeParse({
    title: values.title,
    description: values.description,
    price: price ?? null,
    currency: values.currency,
    city: values.city,
    categoryId: values.categoryId === '' ? undefined : Number(values.categoryId),
  });

  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof ListingFormValues | undefined;
      if (!field || errors[field]) continue;
      errors[field] = {
        type: issue.code,
        message:
          field === 'categoryId'
            ? 'Choose a category'
            : field === 'price' && issue.code === 'too_big'
              ? 'Price is too large'
              : issue.message,
      };
    }
  }

  if (Object.keys(errors).length > 0) return { values: {}, errors };
  return { values: result.data!, errors: {} };
};

export type CategoryOptionGroup = { label: string; options: { id: number; label: string }[] };

/**
 * Listings go into leaf categories only (DECISIONS D15): one `<optgroup>` per top-level category with
 * its leaves; deeper leaves are labelled with their path below the top level.
 */
export function leafCategoryOptions(tree: readonly Category[]): CategoryOptionGroup[] {
  return tree.map((top) => ({
    label: top.name,
    options: top.children.length === 0 ? [{ id: top.id, label: top.name }] : leaves(top.children, ''),
  }));
}

function leaves(nodes: readonly Category[], prefix: string): { id: number; label: string }[] {
  return nodes.flatMap((node) => {
    const label = prefix ? `${prefix} / ${node.name}` : node.name;
    return node.children.length === 0 ? [{ id: node.id, label }] : leaves(node.children, label);
  });
}
