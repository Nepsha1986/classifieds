import type { Profile } from '@classifieds/shared';
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import { ApiError } from './api/client';
import { authApi, meApi } from './api/endpoints';

// Kept in sync with the 401 handler in query-client.ts.
export const ME_QUERY_KEY = ['me'] as const;

/** The signed-in user, or `null` when there is no session. */
export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async (): Promise<Profile | null> => {
      try {
        return await meApi.get();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * Switches the cache to a new session: drops every other user's data, then stores the new user.
 * `me` is overwritten rather than removed so mounted components (the header) keep observing it.
 */
function startSession(queryClient: QueryClient, user: Profile | null) {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== ME_QUERY_KEY[0] });
  queryClient.setQueryData(ME_QUERY_KEY, user);
}

/** Only same-app paths are followed after sign-in, never another origin (`//evil.example`). */
export function safeNextPath(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

/** Signs in (or up) with `action`, loads the profile, then goes to `?next=` or the start page. */
export function useAuthAction<T>(action: (input: T) => Promise<void>) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  return useMutation({
    mutationFn: async (input: T) => {
      await action(input);
      startSession(queryClient, await meApi.get());
    },
    onSuccess: () => navigate(safeNextPath(searchParams.get('next')), { replace: true }),
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => authApi.signOut(),
    onSettled: () => {
      startSession(queryClient, null);
      navigate('/login', { replace: true });
    },
  });
}

/** Route guard: renders child routes for a signed-in user, otherwise redirects to sign-in. */
export function RequireAuth() {
  const me = useMe();
  const location = useLocation();
  if (me.isPending) return <p className="muted">Loading…</p>;
  if (me.isError) return <p className="error">Could not reach the server. Try again later.</p>;
  if (!me.data) {
    const next = location.pathname + location.search;
    return <Navigate to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}

/** Sign-in / sign-up pages: a signed-in user is sent on to the app. */
export function GuestOnly() {
  const me = useMe();
  const [searchParams] = useSearchParams();
  if (me.isPending) return <p className="muted">Loading…</p>;
  if (me.data) return <Navigate to={safeNextPath(searchParams.get('next'))} replace />;
  return <Outlet />;
}
