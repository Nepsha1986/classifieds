import type { ReactNode } from 'react';
import type { FieldError, FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '../api/client';

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: FieldError | undefined;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error && <small className="muted">{hint}</small>}
      {error?.message && (
        <small className="error" role="alert" id={`${htmlFor}-error`}>
          {error.message}
        </small>
      )}
    </div>
  );
}

/** A form-level error (failed request) shown above the submit button. */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p className="error form-error" role="alert">
      {errorMessage(error)}
    </p>
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return 'Could not reach the server. Check your connection.';
  return 'Something went wrong. Please try again.';
}

/**
 * Puts the API's per-field validation errors (`details.fieldErrors` from a 400) onto the form fields.
 * Returns `true` when at least one field error was applied.
 */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): boolean {
  if (!(error instanceof ApiError) || error.status !== 400) return false;
  const fieldErrors = (error.details as { fieldErrors?: Record<string, string[] | undefined> } | undefined)
    ?.fieldErrors;
  let applied = false;
  for (const [field, messages] of Object.entries(fieldErrors ?? {})) {
    if (messages?.[0]) {
      setError(field as Path<T>, { type: 'server', message: messages[0] });
      applied = true;
    }
  }
  return applied;
}
