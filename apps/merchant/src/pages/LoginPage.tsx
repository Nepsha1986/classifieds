import { signInInputSchema, type SignInInput } from '@classifieds/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { authApi } from '../api/endpoints';
import { useAuthAction } from '../auth';
import { Field, FormError } from '../components/form';

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const signIn = useAuthAction((input: SignInInput) => authApi.signIn(input));
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({ resolver: zodResolver(signInInputSchema) });

  return (
    <section className="auth-card">
      <h1>Sign in</h1>
      <form noValidate onSubmit={handleSubmit((input) => signIn.mutate(input))}>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <input id="email" type="email" autoComplete="email" {...register('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <input id="password" type="password" autoComplete="current-password" {...register('password')} />
        </Field>
        <FormError error={signIn.error} />
        <button type="submit" className="button primary" disabled={signIn.isPending}>
          {signIn.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="muted">
        No account? <Link to={{ pathname: '/register', search: searchParams.toString() }}>Create one</Link>
      </p>
    </section>
  );
}
