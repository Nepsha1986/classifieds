import { describe, expect, it } from 'vitest';
import { categoryLabels, currencyDigits, formatPrice } from './format';

describe('formatPrice', () => {
  it('formats minor units in the listing currency', () => {
    const plain = (s: string) => s.replace(/\s/g, ' ');
    expect(plain(formatPrice(1_250_050, 'UAH'))).toBe('UAH 12,500.50');
    expect(plain(formatPrice(1_250_000, 'UAH'))).toBe('UAH 12,500');
    expect(formatPrice(99_900, 'USD')).toBe('$999');
    expect(formatPrice(5000, 'JPY')).toBe('¥5,000');
  });

  it('shows price on request for null', () => {
    expect(formatPrice(null, 'UAH')).toBe('Price on request');
  });

  it('survives an unknown currency code', () => {
    expect(currencyDigits('XYZ')).toBe(2);
    expect(formatPrice(1000, 'XYZ')).toMatch(/10/);
  });
});

describe('categoryLabels', () => {
  it('labels nested categories with their path', () => {
    const labels = categoryLabels([
      {
        id: 1,
        parentId: null,
        slug: 'transport',
        name: 'Transport',
        children: [{ id: 2, parentId: 1, slug: 'cars', name: 'Cars', children: [] }],
      },
    ]);
    expect(labels.get(1)).toBe('Transport');
    expect(labels.get(2)).toBe('Transport / Cars');
  });
});
