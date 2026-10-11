import {
  updateProfileInputSchema,
  USER_NAME_MAX,
  type Profile,
  type UpdateProfileInput,
} from '@classifieds/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { meApi } from '../api/endpoints';
import { ME_QUERY_KEY, useMe } from '../auth';
import { applyFieldErrors, Field, FormError } from '../components/form';
import { formatDate } from '../format';

/** The schema's input: every field optional, phone/city `''` means "clear". */
type ProfileFormValues = z.input<typeof updateProfileInputSchema>;

export function ProfilePage() {
  const me = useMe();
  // RequireAuth renders this page only with a loaded profile.
  if (!me.data) return null;
  return <ProfileForm profile={me.data} />;
}

function ProfileForm({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues, unknown, UpdateProfileInput>({
    // Empty phone/city clear the field (the shared schema turns '' into null).
    resolver: zodResolver(updateProfileInputSchema),
    defaultValues: { name: profile.name, phone: profile.phone ?? '', city: profile.city ?? '' },
  });

  const save = useMutation({
    mutationFn: (input: UpdateProfileInput) => meApi.update(input),
    onSuccess: (updated) => {
      queryClient.setQueryData(ME_QUERY_KEY, updated);
      reset({ name: updated.name, phone: updated.phone ?? '', city: updated.city ?? '' });
    },
    onError: (error) => applyFieldErrors(error, setError),
  });

  return (
    <section className="narrow">
      <h1>Profile</h1>
      <p className="muted">
        {profile.email} · member since {formatDate(profile.createdAt)}
      </p>
      <form noValidate onSubmit={handleSubmit((input) => save.mutate(input))}>
        <Field label="Name" htmlFor="name" error={errors.name}>
          <input id="name" autoComplete="name" maxLength={USER_NAME_MAX} {...register('name')} />
        </Field>
        <Field label="Phone" htmlFor="phone" error={errors.phone} hint="Shown to buyers on your listings">
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+380 50 123 45 67"
            {...register('phone')}
          />
        </Field>
        <Field
          label="City"
          htmlFor="city"
          error={errors.city}
          hint="Used as the default city for new listings"
        >
          <input id="city" autoComplete="address-level2" {...register('city')} />
        </Field>
        {save.isError && !Object.keys(errors).length && <FormError error={save.error} />}
        {save.isSuccess && !isDirty && (
          <p className="notice" role="status">
            Profile saved.
          </p>
        )}
        <div className="form-actions">
          <button type="submit" className="button primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>
    </section>
  );
}
