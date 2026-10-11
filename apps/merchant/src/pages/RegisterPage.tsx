import { PASSWORD_MIN_LENGTH, signUpInputSchema, type SignUpInput } from '@classifieds/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { authApi } from '../api/endpoints';
import { useAuthAction } from '../auth';
import { Field, FormError } from '../components/form';

export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const signUp = useAuthAction((input: SignUpInput) => authApi.signUp(input));
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpInput>({ resolver: zodResolver(signUpInputSchema) });

  return (
    <section className="auth-card">
      <h1>Create an account</h1>
      <form noValidate onSubmit={handleSubmit((input) => signUp.mutate(input))}>
        <Field label="Name" htmlFor="name" error={errors.name}>
          <input id="name" autoComplete="name" {...register('name')} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <input id="email" type="email" autoComplete="email" {...register('email')} />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          error={errors.password}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters`}
        >
          <input id="password" type="password" autoComplete="new-password" {...register('password')} />
        </Field>
        <FormError error={signUp.error} />
        <button type="submit" className="button primary" disabled={signUp.isPending}>
          {signUp.isPending ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="muted">
        Already have an account?{' '}
        <Link to={{ pathname: '/login', search: searchParams.toString() }}>Sign in</Link>
      </p>
    </section>
  );
}
