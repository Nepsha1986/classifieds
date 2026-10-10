import { z } from 'zod';

/** Empty strings from forms mean "clear the field". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable();

export const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{5,18}[0-9]$/;

export const updateProfileInputSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(100),
    phone: optionalText(32).refine((v) => v === null || PHONE_PATTERN.test(v), 'Invalid phone number'),
    city: optionalText(100),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'At least one field is required');
export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;

/** The signed-in user's own profile (`GET /api/me`). Dates are ISO strings over JSON. */
export const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  phone: z.string().nullable(),
  city: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Profile = z.infer<typeof profileSchema>;

/** What anyone can see about a seller (`GET /api/users/:id`): no email. */
export const publicUserSchema = profileSchema.pick({
  id: true,
  name: true,
  image: true,
  phone: true,
  city: true,
  createdAt: true,
});
export type PublicUser = z.infer<typeof publicUserSchema>;
