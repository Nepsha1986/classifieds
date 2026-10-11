import { describe, expect, it } from 'vitest';
import {
  PASSWORD_MIN_LENGTH,
  signInInputSchema,
  signUpInputSchema,
  updateProfileInputSchema,
} from './user.js';

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

describe('signUpInputSchema', () => {
  it('trims the name and normalizes the email', () => {
    expect(
      signUpInputSchema.parse({ name: ' Ann ', email: ' Ann@Example.COM ', password: 'password1' }),
    ).toEqual({ name: 'Ann', email: 'ann@example.com', password: 'password1' });
  });

  it('rejects a short password, an invalid email and an empty name', () => {
    const result = signUpInputSchema.safeParse({
      name: ' ',
      email: 'nope',
      password: 'x'.repeat(PASSWORD_MIN_LENGTH - 1),
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0]).sort()).toEqual(['email', 'name', 'password']);
  });
});

describe('signInInputSchema', () => {
  it('requires an email and a password', () => {
    expect(signInInputSchema.safeParse({ email: 'a@b.io', password: '' }).success).toBe(false);
    expect(signInInputSchema.parse({ email: 'A@B.io', password: 'x' })).toEqual({
      email: 'a@b.io',
      password: 'x',
    });
  });
});
