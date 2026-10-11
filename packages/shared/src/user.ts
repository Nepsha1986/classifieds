import { z } from 'zod';

/** Empty strings from forms mean "clear the field". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable();

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const USER_NAME_MAX = 100;

const emailField = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email'));

/**
 * Body of better-auth's `POST /api/auth/sign-up/email`. better-auth enforces the same password limits
 * (configured from these constants); the schema lets clients validate before sending.
 */
export const signUpInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(USER_NAME_MAX),
  email: emailField,
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `At least ${PASSWORD_MIN_LENGTH} characters`)
    .max(PASSWORD_MAX_LENGTH, `At most ${PASSWORD_MAX_LENGTH} characters`),
});
export type SignUpInput = z.infer<typeof signUpInputSchema>;

/** Body of better-auth's `POST /api/auth/sign-in/email`. */
export const signInInputSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
});
export type SignInInput = z.infer<typeof signInInputSchema>;

export const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{5,18}[0-9]$/;

export const updateProfileInputSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(USER_NAME_MAX),
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
