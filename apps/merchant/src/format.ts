import type { Category } from '@classifieds/shared';

/** Digits after the decimal point for a currency (2 for UAH/USD/EUR, 0 for JPY). */
export function currencyDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ??
      2
    );
  } catch {
    return 2;
  }
}

/** Formats a price in minor units; `null` is "price on request". */
export function formatPrice(price: number | null, currency: string): string {
  if (price === null) return 'Price on request';
  const digits = currencyDigits(currency);
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      // Whole amounts without ".00", fractional ones with all their digits.
      minimumFractionDigits: price % 10 ** digits === 0 ? 0 : digits,
      maximumFractionDigits: digits,
    }).format(price / 10 ** digits);
  } catch {
    return `${(price / 10 ** digits).toFixed(digits)} ${currency}`;
  }
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(iso));
}

/** `id → "Parent / Child"` labels for every category in the tree. */
export function categoryLabels(tree: readonly Category[], prefix = ''): Map<number, string> {
  const labels = new Map<number, string>();
  for (const node of tree) {
    const label = prefix ? `${prefix} / ${node.name}` : node.name;
    labels.set(node.id, label);
    for (const [id, childLabel] of categoryLabels(node.children, label)) labels.set(id, childLabel);
  }
  return labels;
}
