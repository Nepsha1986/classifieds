import {
  LISTING_DESCRIPTION_MAX,
  LISTING_TITLE_MAX,
  type Category,
  type CreateListingInput,
} from '@classifieds/shared';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
  CURRENCIES,
  leafCategoryOptions,
  listingFormResolver,
  type ListingFormValues,
} from '../listing-form';
import { useCategories } from '../queries';
import { applyFieldErrors, Field, FormError } from './form';

type Props = {
  defaultValues: ListingFormValues;
  submitLabel: string;
  pendingLabel: string;
  /** Rejects with the API error; field errors from a 400 are shown on the fields. */
  onSubmit: (input: CreateListingInput) => Promise<unknown>;
  disabled?: boolean;
};

/** The category options must exist before the form mounts, or the select loses its initial value. */
export function ListingForm(props: Props) {
  const categories = useCategories();
  if (categories.isPending) return <p className="muted">Loading…</p>;
  if (categories.isError) return <FormError error={categories.error} />;
  return <ListingFormFields {...props} categories={categories.data} />;
}

function ListingFormFields({
  defaultValues,
  submitLabel,
  pendingLabel,
  onSubmit,
  disabled = false,
  categories,
}: Props & { categories: Category[] }) {
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ListingFormValues, unknown, CreateListingInput>({
    defaultValues,
    resolver: listingFormResolver,
  });

  const [submitError, setSubmitError] = useState<unknown>(null);

  const submit = handleSubmit(async (input) => {
    setSubmitError(null);
    try {
      await onSubmit(input);
    } catch (error) {
      if (!applyFieldErrors(error, setError)) setSubmitError(error);
    }
  });

  const currency = useWatch({ control, name: 'currency' });
  const currencies = CURRENCIES.includes(currency as (typeof CURRENCIES)[number])
    ? CURRENCIES
    : [...CURRENCIES, currency];

  return (
    <form noValidate onSubmit={submit} className="listing-form">
      <fieldset disabled={disabled || isSubmitting}>
        <Field label="Title" htmlFor="title" error={errors.title}>
          <input id="title" maxLength={LISTING_TITLE_MAX} {...register('title')} />
        </Field>

        <Field label="Category" htmlFor="categoryId" error={errors.categoryId}>
          <select id="categoryId" {...register('categoryId')}>
            <option value="">Choose a category</option>
            {leafCategoryOptions(categories).map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>

        <Field label="Description" htmlFor="description" error={errors.description}>
          <textarea
            id="description"
            rows={6}
            maxLength={LISTING_DESCRIPTION_MAX}
            {...register('description')}
          />
        </Field>

        <div className="field-row">
          <Field label="Price" htmlFor="price" error={errors.price} hint="Leave empty for “price on request”">
            <input id="price" inputMode="decimal" autoComplete="off" {...register('price')} />
          </Field>
          <Field label="Currency" htmlFor="currency" error={errors.currency}>
            <select id="currency" {...register('currency')}>
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="City" htmlFor="city" error={errors.city}>
          <input id="city" autoComplete="address-level2" {...register('city')} />
        </Field>

        <FormError error={submitError} />
        <div className="form-actions">
          <button type="submit" className="button primary">
            {isSubmitting ? pendingLabel : submitLabel}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
