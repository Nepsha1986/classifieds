import { describe, expect, it } from 'vitest';
import { updateProfileInputSchema } from './user.js';

describe('updateProfileInputSchema', () => {
  it('accepts a partial update and trims values', () => {
    expect(updateProfileInputSchema.parse({ city: '  Kyiv ' })).toEqual({ city: 'Kyiv' });
  });

  it('turns empty strings into null to clear a field', () => {
    expect(updateProfileInputSchema.parse({ phone: '', city: '' })).toEqual({ phone: null, city: null });
  });

  it('validates the phone format', () => {
    expect(updateProfileInputSchema.safeParse({ phone: '+380 (67) 123-45-67' }).success).toBe(true);
    expect(updateProfileInputSchema.safeParse({ phone: 'call me' }).success).toBe(false);
  });

  it('rejects empty objects, unknown fields and blank names', () => {
    expect(updateProfileInputSchema.safeParse({}).success).toBe(false);
    expect(updateProfileInputSchema.safeParse({ email: 'a@b.c' }).success).toBe(false);
    expect(updateProfileInputSchema.safeParse({ name: '   ' }).success).toBe(false);
  });
});
